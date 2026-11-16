import { hexToBin } from '@bitauth/libauth';
import type { XOInvitation, XOInvitationVariable } from '@xo-cash/types';
import type { ChipnetConfig } from './config.js';
import { landingVariableIdentifiers } from './landing-land.js';
import { finishAction, signOwnInputs, type ActionResult } from './swap-open.js';
import type { AccountEngine } from './xo-engine.js';

/** Reads the landing variables from a land invitation, without their role and merge references. */
export const readLandingVariables = (land: XOInvitation): XOInvitationVariable[] => {
  const found = new Map<string, XOInvitationVariable>();
  for (const commit of land.commits) {
    for (const { variableIdentifier, value } of commit.data.variables ?? []) {
      if ((landingVariableIdentifiers as readonly string[]).includes(variableIdentifier)) found.set(variableIdentifier, { variableIdentifier, value });
    }
  }
  const missing = landingVariableIdentifiers.filter((identifier) => !found.has(identifier));
  if (missing.length > 0) throw new Error(`land invitation ${land.invitationIdentifier} lacks ${missing.join(', ')}`);
  return landingVariableIdentifiers.map((identifier) => found.get(identifier)!);
};

/** Transaction hash of the land action, from the result recorded on the land invitation. */
export const readLandTransactionHash = (land: XOInvitation): string => {
  const hash = land.result?.transactions?.['landTransaction']?.transactionHash;
  if (hash === undefined) throw new Error(`land invitation ${land.invitationIdentifier} has no recorded transaction`);
  return hash;
};

/** Finds the still unspent landed coin of a land invitation in this account's engine. */
export const findLandedCoin = async ({ engine, landingTemplateIdentifier }: AccountEngine, land: XOInvitation) => {
  const landHash = readLandTransactionHash(land);
  const coin = (await engine.listUnspentOutputs()).find(
    (utxo) => utxo.outpointTransactionHash === landHash && utxo.templateIdentifier === landingTemplateIdentifier,
  );
  if (coin === undefined) throw new Error(`no unspent landed coin from ${landHash} in this engine`);
  return coin;
};

/** Smallest token amount the covenant accepts: ceil(landedSatoshis * rateNum / rateDen), as the template computes it. */
export const minimumTokenAmount = (landedSatoshis: bigint, rateNum: bigint, rateDen: bigint): bigint =>
  (landedSatoshis * rateNum + rateDen - 1n) / rateDen;

/**
 * Starts a follow-up action on a landed coin: the landing variables and the landed coin at input 0. The payer takes
 * no role here; it only supplies the coin its engine tracks.
 */
export const startFollowUp = async (account: AccountEngine, land: XOInvitation, actionIdentifier: 'convert' | 'giveBack', inputIdentifier: string, sequenceNumber: number): Promise<XOInvitation> => {
  const { engine, landingTemplateIdentifier: templateIdentifier } = account;
  const coin = await findLandedCoin(account, land);
  const created = await engine.createInvitation({ templateIdentifier, actionIdentifier });
  const stored = await engine.appendInvitation(created.invitation.invitationIdentifier, {
    templateIdentifier,
    actionIdentifier,
    variables: readLandingVariables(land),
    inputs: [{ inputIdentifier, transactionIndex: 0, outpointTransactionHash: hexToBin(coin.outpointTransactionHash), outpointIndex: coin.outpointIndex, sequenceNumber }],
  });
  return stored.invitation;
};

/** convert, payer part one: the landed coin at input 0 with sequence 0. */
export const startConvert = (account: AccountEngine, land: XOInvitation): Promise<XOInvitation> => startFollowUp(account, land, 'convert', 'convertInput', 0);

/**
 * convert, converter part: joins as converter and adds one token coin as input 1, the owner token output at output 0
 * and its payout (landed satoshis and the rest of its tokens) at output 1. No change output: the covenant needs as
 * many outputs as inputs, and the payout already carries everything left. Signs its own input.
 */
export const takeConvert = async (account: AccountEngine, started: XOInvitation, config: ChipnetConfig): Promise<XOInvitation> => {
  const { engine, landingTemplateIdentifier: templateIdentifier } = account;
  const accepted = await engine.acceptInvitation(started, { roleIdentifier: 'converter' });
  const invitationIdentifier = accepted.invitation.invitationIdentifier;
  const { landedSatoshis, rateNum, rateDen, convertFeeSatoshis } = config.landing;
  const needed = minimumTokenAmount(BigInt(landedSatoshis), BigInt(rateNum), BigInt(rateDen));
  const tokenCoin = (await engine.listSpendableUnspentOutputs()).find(
    (utxo) => utxo.tokenCategory === config.testToken.category && utxo.tokenNftCapability === undefined && BigInt(utxo.tokenAmount ?? '0') >= needed,
  );
  if (tokenCoin === undefined) throw new Error(`the converter engine wallet has no coin with ${needed} test token units`);
  const role = { roleIdentifier: 'converter' };
  const converterLockingScript = await engine.generateLockingBytecodeFromDefaultPolicy('receive');
  await engine.appendInvitation(invitationIdentifier, {
    templateIdentifier,
    actionIdentifier: 'convert',
    ...role,
    variables: [
      { variableIdentifier: 'converterLockingScript', value: converterLockingScript, ...role },
      { variableIdentifier: 'converterCoinSatoshis', value: BigInt(tokenCoin.valueSatoshis), ...role },
      { variableIdentifier: 'converterCoinTokens', value: BigInt(tokenCoin.tokenAmount ?? '0'), ...role },
      { variableIdentifier: 'convertFeeSatoshis', value: BigInt(convertFeeSatoshis), ...role },
    ],
    outputs: [
      { outputIdentifier: 'ownerTokenOutput', transactionIndex: 0, ...role },
      { outputIdentifier: 'converterPayoutOutput', transactionIndex: 1, ...role },
    ],
    inputs: [{ transactionIndex: 1, outpointTransactionHash: hexToBin(tokenCoin.outpointTransactionHash), outpointIndex: tokenCoin.outpointIndex, sequenceNumber: 0, ...role }],
  });
  await signOwnInputs(account, invitationIdentifier);
  const stored = await engine.getInvitation(invitationIdentifier);
  return stored!.invitation;
};

/** A follow-up, payer part two: stores the other party's commits, completes the landed coin input and broadcasts. */
export const finishFollowUp = async (account: AccountEngine, taken: XOInvitation, broadcast: boolean): Promise<ActionResult> => {
  await account.engine.updateInvitation(taken);
  await signOwnInputs(account, taken.invitationIdentifier);
  return finishAction(account, taken.invitationIdentifier, broadcast);
};
