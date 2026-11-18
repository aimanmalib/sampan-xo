import { hexToBin } from '@bitauth/libauth';
import type { XOInvitation, XOInvitationVariable } from '@xo-cash/types';
import { finishAction, signOwnInputs, type ActionResult } from './swap-open.js';
import type { AccountEngine } from './xo-engine.js';

/** The four offer variables, as the maker committed them in the open invitation. */
export const offerVariableIdentifiers = ['offeredSatoshis', 'wantedCategory', 'wantedAmount', 'makerLockingScript'] as const;

/** Transaction index of the offer coin in a fill; the covenant pays the maker at the same output index. */
export const fillInputTransactionIndex = 0;

/** Reads the offer variables from an open invitation, without their role and merge references. */
export const readOfferVariables = (open: XOInvitation): XOInvitationVariable[] => {
  const found = new Map<string, XOInvitationVariable>();
  for (const commit of open.commits) {
    for (const variable of commit.data.variables ?? []) {
      if ((offerVariableIdentifiers as readonly string[]).includes(variable.variableIdentifier)) {
        found.set(variable.variableIdentifier, { variableIdentifier: variable.variableIdentifier, value: variable.value });
      }
    }
  }
  const missing = offerVariableIdentifiers.filter((identifier) => !found.has(identifier));
  if (missing.length > 0) throw new Error(`open invitation ${open.invitationIdentifier} lacks ${missing.join(', ')}`);
  return offerVariableIdentifiers.map((identifier) => found.get(identifier)!);
};

/** Transaction hash of the open action, from the result recorded on the open invitation. */
export const readOpenTransactionHash = (open: XOInvitation): string => {
  const hash = open.result?.transactions?.['openTransaction']?.transactionHash;
  if (hash === undefined) throw new Error(`open invitation ${open.invitationIdentifier} has no recorded transaction`);
  return hash;
};

/** Finds the still unspent offer coin of an open invitation in this account's engine. */
export const findOfferCoin = async ({ engine, swapTemplateIdentifier }: AccountEngine, open: XOInvitation) => {
  const openHash = readOpenTransactionHash(open);
  const offer = (await engine.listUnspentOutputs()).find(
    (utxo) => utxo.outpointTransactionHash === openHash && utxo.templateIdentifier === swapTemplateIdentifier,
  );
  if (offer === undefined) throw new Error(`no unspent offer from ${openHash} in this engine`);
  return offer;
};

/**
 * fill, maker part one: starts the fill invitation with the offer coin at input 0 and the offer variables, so the
 * taker can build the payment. The maker takes no role in fill; it only supplies the coin it can unlock.
 */
export const startFill = async (account: AccountEngine, open: XOInvitation): Promise<XOInvitation> => {
  const { engine, swapTemplateIdentifier: templateIdentifier } = account;
  const offer = await findOfferCoin(account, open);
  const created = await engine.createInvitation({ templateIdentifier, actionIdentifier: 'fill' });
  const stored = await engine.appendInvitation(created.invitation.invitationIdentifier, {
    templateIdentifier,
    actionIdentifier: 'fill',
    variables: readOfferVariables(open),
    inputs: [
      {
        inputIdentifier: 'fillInput',
        transactionIndex: fillInputTransactionIndex,
        outpointTransactionHash: hexToBin(offer.outpointTransactionHash),
        outpointIndex: offer.outpointIndex,
        sequenceNumber: 0,
      },
    ],
  });
  return stored.invitation;
};

/**
 * fill, taker part: joins as taker, adds the token payment to the maker at output 0, the payout of the offered
 * satoshis to a fresh taker script, its own token and plain coins, and change; then signs its own inputs.
 */
export const takeFill = async (account: AccountEngine, started: XOInvitation, wantedCategory: string, wantedAmount: bigint): Promise<XOInvitation> => {
  const { engine, swapTemplateIdentifier: templateIdentifier } = account;
  const accepted = await engine.acceptInvitation(started, { roleIdentifier: 'taker' });
  const invitationIdentifier = accepted.invitation.invitationIdentifier;
  const spendable = await engine.listSpendableUnspentOutputs();
  const tokenCoin = spendable.find((utxo) => utxo.tokenCategory === wantedCategory && BigInt(utxo.tokenAmount ?? '0') >= wantedAmount);
  const plainCoin = spendable.filter((utxo) => utxo.tokenCategory === undefined).sort((a, b) => b.valueSatoshis - a.valueSatoshis)[0];
  if (tokenCoin === undefined || plainCoin === undefined) throw new Error('the taker engine wallet needs a coin with the wanted tokens and a plain coin');
  const role = { roleIdentifier: 'taker' };
  const takerLockingScript = await engine.generateLockingBytecodeFromDefaultPolicy('receive');
  await engine.appendInvitation(invitationIdentifier, {
    templateIdentifier,
    actionIdentifier: 'fill',
    ...role,
    variables: [{ variableIdentifier: 'takerLockingScript', value: takerLockingScript, ...role }],
    outputs: [
      { outputIdentifier: 'makerPaymentOutput', transactionIndex: 0, ...role },
      { outputIdentifier: 'takerPayoutOutput', ...role },
    ],
    inputs: [tokenCoin, plainCoin].map((utxo) => ({
      outpointTransactionHash: hexToBin(utxo.outpointTransactionHash),
      outpointIndex: utxo.outpointIndex,
      sequenceNumber: 0,
      ...role,
    })),
  });
  await engine.addChangeToInvitation(invitationIdentifier);
  await signOwnInputs(account, invitationIdentifier);
  const stored = await engine.getInvitation(invitationIdentifier);
  return stored!.invitation;
};

/**
 * fill, maker part two: stores the taker's commits, completes the offer input and broadcasts.
 * Only the offer input is completed. The engine counts as its own every input whose coin it once created, so when
 * the maker funded the taker's wallet (the debug tool run), the taker's coins were listed as the maker's too and
 * signing them failed with TemplateUnlockingScriptNotFoundError.
 */
export const finishFill = async (account: AccountEngine, taken: XOInvitation, broadcast: boolean): Promise<ActionResult> => {
  const { engine } = account;
  const invitationIdentifier = taken.invitationIdentifier;
  // A finish that failed after signing keeps its signature commit; the taker's file is then already contained.
  const stored = await engine.getInvitation(invitationIdentifier);
  const known = new Set(stored?.invitation.commits.map((commit) => commit.commitIdentifier) ?? []);
  if (!taken.commits.every((commit) => known.has(commit.commitIdentifier))) await engine.updateInvitation(taken);
  const { inputsMissingSignatures } = await engine.listMissingRequirements(invitationIdentifier);
  if (inputsMissingSignatures.some((input) => input.inputIdentifier === 'fillInput')) {
    await engine.signInvitation(invitationIdentifier, fillInputTransactionIndex);
  }
  return finishAction(account, invitationIdentifier, broadcast);
};
