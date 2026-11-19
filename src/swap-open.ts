import { hexToBin } from '@bitauth/libauth';
import type { XOInvitation } from '@xo-cash/types';
import type { ChipnetConfig } from './config.js';
import type { AccountEngine } from './xo-engine.js';

export interface ActionResult {
  invitation: XOInvitation;
  transactionHash: string;
  serializedTransaction: string;
}

/** Signs every input this account committed to the invitation. */
export const signOwnInputs = async ({ engine }: AccountEngine, invitationIdentifier: string): Promise<void> => {
  for (const inputIndex of await engine.listOwnInputIndexes(invitationIdentifier)) {
    await engine.signInvitation(invitationIdentifier, inputIndex);
  }
};

/** Throws when the engine still reports missing requirements, with the engine's own list. */
export const assertComplete = async ({ engine }: AccountEngine, invitationIdentifier: string): Promise<void> => {
  const missing = await engine.listMissingRequirements(invitationIdentifier);
  const empty =
    Object.keys(missing.templateRequirements).length === 0 && missing.inputsMissingSignatures.length === 0 && missing.participants.length === 0;
  if (!empty) {
    throw new Error(`invitation ${invitationIdentifier} is not complete: ${JSON.stringify(missing, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))}`);
  }
};

/**
 * The engine broadcasts, records the broadcast on the invitation, then clears the coin reservations. The spent coins
 * may already be gone from its store by then (its monitor saw the spend), and the clearing step throws
 * UnspentOutputNotFoundInStoreError after a successful broadcast. That error is accepted only when the stored
 * invitation carries the broadcast result for the expected transaction.
 */
export const isLateReservationError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'UnspentOutputNotFoundInStoreError';

/** The node refused the transaction (for example `non-BIP68-final`); nothing was broadcast. */
export const isBroadcastRefusedError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'TransactionBroadcastFailedError';

const hasBroadcastResult = (invitation: XOInvitation, transactionHash: string): boolean =>
  Object.values(invitation.result?.transactions ?? {}).some(
    (result) => result.transactionHash === transactionHash && 'broadcastedAtTimestamp' in result,
  );

/** Builds the transaction; broadcasts it when asked, else archives the invitation so its coins are released. */
export const finishAction = async (account: AccountEngine, invitationIdentifier: string, broadcast: boolean): Promise<ActionResult> => {
  const { engine } = account;
  await assertComplete(account, invitationIdentifier);
  const built = await engine.buildInvitationTransactionFromMergedCommit(invitationIdentifier);
  try {
    await engine.executeAction(invitationIdentifier, { broadcastTransaction: broadcast });
  } catch (error) {
    // A refused broadcast leaves the invitation holding its coins; archive it so the same step can be run again.
    if (isBroadcastRefusedError(error)) await engine.archiveInvitation(invitationIdentifier);
    const stored = await engine.getInvitation(invitationIdentifier);
    if (!broadcast || !isLateReservationError(error) || !stored || !hasBroadcastResult(stored.invitation, built.transactionHash)) throw error;
    console.error(`note: broadcast recorded; the engine then failed to clear a spent coin reservation: ${String(error)}`);
  }
  if (!broadcast) await engine.archiveInvitation(invitationIdentifier);
  const stored = await engine.getInvitation(invitationIdentifier);
  if (!stored) throw new Error(`invitation ${invitationIdentifier} is not stored`);
  return { invitation: stored.invitation, transactionHash: built.transactionHash, serializedTransaction: built.serializedTransaction };
};

/**
 * open (maker): locks swap.offeredSatoshis in a new offer asking for swap.wantedAmount test tokens, paid to a fresh
 * maker receive script; anyone may return it to that script after swap.expireAfterBlocks blocks. Funded from one plain engine coin; the engine adds the change and the fee.
 */
export const openOffer = async (account: AccountEngine, config: ChipnetConfig, broadcast: boolean): Promise<ActionResult> => {
  const { engine, swapTemplateIdentifier: templateIdentifier } = account;
  if (config.testToken.category === null) throw new Error('testToken.category is not set; run the test token setup first');
  const template = await engine.getTemplate(templateIdentifier);
  const intent = template?.start?.find((entry) => entry.action === 'open');
  const created = await engine.createInvitation({ templateIdentifier, actionIdentifier: 'open', intent });
  const invitationIdentifier = created.invitation.invitationIdentifier;
  const makerLockingScript = await engine.generateLockingBytecodeFromDefaultPolicy('receive');
  const role = { roleIdentifier: 'maker' };
  await engine.appendInvitation(invitationIdentifier, {
    templateIdentifier,
    actionIdentifier: 'open',
    ...role,
    variables: [
      { variableIdentifier: 'offeredSatoshis', value: BigInt(config.swap.offeredSatoshis), ...role },
      { variableIdentifier: 'wantedCategory', value: config.testToken.category, ...role },
      { variableIdentifier: 'wantedAmount', value: BigInt(config.swap.wantedAmount), ...role },
      { variableIdentifier: 'makerLockingScript', value: makerLockingScript, ...role },
      { variableIdentifier: 'expireAfter', value: BigInt(config.swap.expireAfterBlocks), ...role },
      { variableIdentifier: 'expireFeeSatoshis', value: BigInt(config.swap.expireFeeSatoshis), ...role },
    ],
    outputs: [{ outputIdentifier: 'offerOutput', ...role }],
  });
  const coins = await engine.listSpendableUnspentOutputs();
  const coin = coins
    .filter((utxo) => utxo.tokenCategory === undefined)
    .sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];
  if (coin === undefined) throw new Error('the maker engine wallet has no spendable plain coin; run scripts/deposit.ts maker');
  await engine.appendInvitation(invitationIdentifier, {
    templateIdentifier,
    actionIdentifier: 'open',
    inputs: [{ outpointTransactionHash: hexToBin(coin.outpointTransactionHash), outpointIndex: coin.outpointIndex, sequenceNumber: 0, ...role }],
  });
  await engine.addChangeToInvitation(invitationIdentifier);
  await signOwnInputs(account, invitationIdentifier);
  return finishAction(account, invitationIdentifier, broadcast);
};
