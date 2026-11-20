import { binToHex, hexToBin } from '@bitauth/libauth';
import type { XOInvitation } from '@xo-cash/types';
import type { ChipnetConfig } from './config.js';
import { connectChipnet, getTipHeight, getTransactionHeight, listUnspent } from './electrum.js';
import { readOfferVariables, readOpenTransactionHash } from './swap-fill.js';
import { finishAction, type ActionResult } from './swap-open.js';
import { lockingBytecodeToAddress, type AccountEngine } from './xo-engine.js';

/** Transaction index of the offer coin in an expire; the covenant allows this one input only. */
export const expireInputTransactionIndex = 0;

/**
 * Confirmations of a coin mined at minedHeight when the tip is tipHeight; 0 while unmined. A relative lock of n blocks
 * (BIP68) lets the spend into the next block once the coin has n confirmations, so the node accepts it into its mempool.
 */
export const confirmations = (minedHeight: number, tipHeight: number): number => (minedHeight > 0 ? tipHeight - minedHeight + 1 : 0);

/** Throws a plain message while the offer is younger than expireAfter blocks; the engine does not check this. */
export const assertExpired = (minedHeight: number, tipHeight: number, expireAfter: number): void => {
  const seen = confirmations(minedHeight, tipHeight);
  if (seen < expireAfter) {
    const where = minedHeight > 0 ? `mined at block ${minedHeight}, tip ${tipHeight}` : 'not mined yet';
    throw new Error(`the offer has ${seen} of ${expireAfter} confirmations (${where}); expire is not final before then`);
  }
};

/** The expireAfter value the maker committed in the open invitation. */
export const readExpireAfter = (open: XOInvitation): number => {
  const value = readOfferVariables(open).find((variable) => variable.variableIdentifier === 'expireAfter')?.value;
  if (typeof value !== 'bigint' || value < 1n || value > 0xffffn) throw new Error(`open invitation ${open.invitationIdentifier} has no usable expireAfter`);
  return Number(value);
};

/** Locking bytecode of the offer output, as the maker committed it in the open invitation. */
export const readOfferLockingBytecode = (open: XOInvitation): string => {
  for (const commit of open.commits) {
    const offer = commit.data.outputs?.find((output) => output.outputIdentifier === 'offerOutput' && output.lockingBytecode !== undefined);
    if (offer?.lockingBytecode !== undefined) return binToHex(offer.lockingBytecode);
  }
  throw new Error(`open invitation ${open.invitationIdentifier} has no offerOutput locking bytecode`);
};

export interface OfferCoin {
  outpointTransactionHash: string;
  outpointIndex: number;
  minedHeight: number;
  tipHeight: number;
}

/**
 * Finds the unspent offer coin of an open invitation through Electrum, by the offer address, with its height, so the
 * age can be checked before anything is built. The engine itself does not check the age of a coin.
 */
export const locateOffer = async (open: XOInvitation, config: Pick<ChipnetConfig, 'electrumServers'> & { network: string; addressPrefix: string }): Promise<OfferCoin> => {
  const openHash = readOpenTransactionHash(open);
  const address = lockingBytecodeToAddress(readOfferLockingBytecode(open), config.addressPrefix);
  const client = await connectChipnet(config);
  try {
    const coin = (await listUnspent(client, address)).find((utxo) => utxo.txid === openHash);
    if (coin === undefined) throw new Error(`no unspent offer from ${openHash} at ${address}; it was filled, cancelled or expired`);
    return { outpointTransactionHash: coin.txid, outpointIndex: coin.vout, minedHeight: await getTransactionHeight(client, openHash), tipHeight: await getTipHeight(client) };
  } finally {
    await client.disconnect();
  }
};

/**
 * expire (expirer, anyone): the offer coin at input 0 with sequence expireAfter, and one output that returns
 * offeredSatoshis less expireFeeSatoshis to the maker locking script; both values come from the open invitation.
 * No change and no signature: the covenant needs one input and one output, and the expire path takes no key.
 * With `early` set the age check is skipped, so the node's own rejection of a too early spend can be recorded.
 */
export const expireOffer = async (account: AccountEngine, open: XOInvitation, offer: OfferCoin, broadcast: boolean, early = false): Promise<ActionResult> => {
  const { engine, swapTemplateIdentifier: templateIdentifier } = account;
  const expireAfter = readExpireAfter(open);
  if (!early) assertExpired(offer.minedHeight, offer.tipHeight, expireAfter);
  const created = await engine.createInvitation({ templateIdentifier, actionIdentifier: 'expire' });
  const invitationIdentifier = created.invitation.invitationIdentifier;
  await engine.appendInvitation(invitationIdentifier, {
    templateIdentifier,
    actionIdentifier: 'expire',
    variables: readOfferVariables(open),
    inputs: [
      {
        inputIdentifier: 'expireInput',
        transactionIndex: expireInputTransactionIndex,
        outpointTransactionHash: hexToBin(offer.outpointTransactionHash),
        outpointIndex: offer.outpointIndex,
        sequenceNumber: expireAfter,
      },
    ],
  });
  const role = { roleIdentifier: 'expirer' };
  await engine.appendInvitation(invitationIdentifier, {
    templateIdentifier,
    actionIdentifier: 'expire',
    ...role,
    outputs: [{ outputIdentifier: 'expireOutput', transactionIndex: 0, ...role }],
  });
  const { inputsMissingSignatures } = await engine.listMissingRequirements(invitationIdentifier);
  if (inputsMissingSignatures.some((input) => input.inputIdentifier === 'expireInput')) {
    await engine.signInvitation(invitationIdentifier, expireInputTransactionIndex);
  }
  return finishAction(account, invitationIdentifier, broadcast);
};
