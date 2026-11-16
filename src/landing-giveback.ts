import type { XOInvitation } from '@xo-cash/types';
import type { ChipnetConfig } from './config.js';
import { connectChipnet, getTipHeight, getTransactionHeight } from './electrum.js';
import { readLandTransactionHash, startFollowUp } from './landing-convert.js';
import { finishAction, signOwnInputs, type ActionResult } from './swap-open.js';
import type { AccountEngine } from './xo-engine.js';

/**
 * Confirmations of a coin mined at minedHeight when the tip is tipHeight; 0 while unmined. A relative lock of n blocks
 * (BIP68) lets the spend into the next block once the coin has n confirmations, so the node accepts it into its mempool.
 */
export const confirmations = (minedHeight: number, tipHeight: number): number => (minedHeight > 0 ? tipHeight - minedHeight + 1 : 0);

/** Throws a plain message when the landed coin is younger than returnAfter blocks; the engine does not check this. */
export const assertOldEnough = (minedHeight: number, tipHeight: number, returnAfter: number): void => {
  const seen = confirmations(minedHeight, tipHeight);
  if (seen < returnAfter) {
    const where = minedHeight > 0 ? `mined at block ${minedHeight}, tip ${tipHeight}` : 'not mined yet';
    throw new Error(`the landed coin has ${seen} of ${returnAfter} confirmations (${where}); giveBack is not final before then`);
  }
};

/** Reads the land transaction height and the tip from chipnet Electrum, then applies assertOldEnough. */
export const checkLandAge = async (land: XOInvitation, config: ChipnetConfig): Promise<void> => {
  const client = await connectChipnet(config);
  try {
    const minedHeight = await getTransactionHeight(client, readLandTransactionHash(land));
    assertOldEnough(minedHeight, await getTipHeight(client), config.landing.returnAfter);
  } finally {
    await client.disconnect();
  }
};

/**
 * giveBack (payer; the template lets anyone do it): the landed coin at input 0 with sequence returnAfter, and one
 * output that pays the owner landedSatoshis less giveBackFeeSatoshis. No change: the covenant needs one input and
 * one output, and the landed coin's unlocking script needs no signature.
 */
export const giveBack = async (account: AccountEngine, land: XOInvitation, config: ChipnetConfig, broadcast: boolean): Promise<ActionResult> => {
  const { engine, landingTemplateIdentifier: templateIdentifier } = account;
  const { returnAfter, giveBackFeeSatoshis } = config.landing;
  const started = await startFollowUp(account, land, 'giveBack', 'giveBackInput', returnAfter);
  const invitationIdentifier = started.invitationIdentifier;
  const role = { roleIdentifier: 'payer' };
  await engine.appendInvitation(invitationIdentifier, {
    templateIdentifier,
    actionIdentifier: 'giveBack',
    ...role,
    variables: [{ variableIdentifier: 'giveBackFeeSatoshis', value: BigInt(giveBackFeeSatoshis), ...role }],
    outputs: [{ outputIdentifier: 'giveBackOutput', transactionIndex: 0, ...role }],
  });
  await signOwnInputs(account, invitationIdentifier);
  return finishAction(account, invitationIdentifier, broadcast);
};
