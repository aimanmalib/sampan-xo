import { binToHex, decodeTransactionBch, encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import type { XOInvitation } from '@xo-cash/types';
import { swapIntentTemplate } from '../template/swap-intent.js';
import { deriveFundingKey } from './accounts.js';
import { broadcast, connectChipnet, listUnspent } from './electrum.js';
import type { LandingRunConfig } from './landing-run-config.js';
import { verifyLocally, type BuiltConvert } from './landing-under-rate.js';
import { readOfferLockingBytecode } from './swap-expire.js';
import { fillInputTransactionIndex, readOpenTransactionHash } from './swap-fill.js';
import { assertFillUnderChipnetOnly, buildFill, redeemFromFill, type FillUnderRequest } from './swap-fill-under.js';
import { lockingBytecodeToAddress, type AccountEngine } from './xo-engine.js';

const readVariable = (open: XOInvitation, identifier: string): unknown => {
  for (const commit of open.commits) {
    const found = commit.data.variables?.find((variable) => variable.variableIdentifier === identifier);
    if (found !== undefined) return found.value;
  }
  throw new Error(`open invitation ${open.invitationIdentifier} has no ${identifier}`);
};

/**
 * The maker's engine first: it takes the taker's short commit, signs the offer input and builds the fill without
 * broadcasting (its outputs are printed, the invitation is archived). The redeem bytecode comes from that build.
 */
const engineAttempt = async (account: AccountEngine, taken: XOInvitation, log: (line: string) => void): Promise<string | undefined> => {
  const { engine } = account;
  const identifier = taken.invitationIdentifier;
  try {
    // A second run (dry run, then the send) finds the taker's commits and its own signature already stored.
    const stored = await engine.getInvitation(identifier);
    const known = new Set(stored?.invitation.commits.map((commit) => commit.commitIdentifier) ?? []);
    if (!taken.commits.every((commit) => known.has(commit.commitIdentifier))) await engine.updateInvitation(taken);
    const { inputsMissingSignatures } = await engine.listMissingRequirements(identifier);
    if (inputsMissingSignatures.some((input) => input.inputIdentifier === 'fillInput')) await engine.signInvitation(identifier, fillInputTransactionIndex);
    const built = await engine.buildInvitationTransactionFromMergedCommit(identifier);
    const decoded = decodeTransactionBch(hexToBin(built.serializedTransaction));
    if (typeof decoded === 'string') throw new Error(decoded);
    log(`engine built txid ${built.transactionHash} (not sent)`);
    decoded.outputs.forEach((output, index) => {
      const token = output.token === undefined ? '' : ` with ${output.token.amount} units of ${binToHex(output.token.category)}`;
      log(`engine output ${index}: ${output.valueSatoshis} sat${token}`);
    });
    return built.serializedTransaction;
  } catch (error) {
    log(`engine error: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
    return undefined;
  } finally {
    await engine.archiveInvitation(identifier);
  }
};

/**
 * Builds the short fill of a run's offer coin with a token coin of the taker account's plain P2PKH address, checks it
 * in the local VM next to the same fill paying wantedAmount, and (unless dry run) sends it once to chipnet. Prints every
 * step; the node's answer is printed verbatim. Stops before broadcasting if the local VM accepts the short fill.
 */
export const runFillUnder = async (
  maker: AccountEngine,
  open: XOInvitation,
  taken: XOInvitation,
  config: LandingRunConfig,
  takerMnemonic: string,
  send: boolean,
  log: (line: string) => void = console.log,
): Promise<void> => {
  assertFillUnderChipnetOnly(config.network);
  const category = String(readVariable(open, 'wantedCategory'));
  const wanted = BigInt(readVariable(open, 'wantedAmount') as bigint);
  const built = await engineAttempt(maker, taken, log);
  if (built === undefined) throw new Error('the engine built no fill, so the redeem bytecode is unknown; nothing sent');
  const redeem = redeemFromFill(built);
  const lockingBytecode = hexToBin(readOfferLockingBytecode(open));
  if (binToHex(encodeLockingBytecodeP2sh32(hash256(redeem))) !== binToHex(lockingBytecode)) throw new Error('the redeem bytecode does not hash to the offer address');
  const key = deriveFundingKey(takerMnemonic, config);
  const client = await connectChipnet(config);
  try {
    const openHash = readOpenTransactionHash(open);
    const offerCoin = (await listUnspent(client, lockingBytecodeToAddress(binToHex(lockingBytecode), config.addressPrefix))).find((u) => u.txid === openHash);
    if (offerCoin === undefined) throw new Error(`no unspent offer from ${openHash}`);
    const tokenCoin = (await listUnspent(client, key.address)).find((u) => u.token?.category === category && u.token.nft === undefined && u.token.amount >= wanted);
    if (tokenCoin === undefined) throw new Error(`the taker address ${key.address} has no coin with ${wanted} units of ${category}`);
    const base: Omit<FillUnderRequest, 'paidAmount' | 'feeSatoshis'> = {
      network: config.network,
      offer: { txid: offerCoin.txid, vout: offerCoin.vout, satoshis: offerCoin.satoshis, redeem, lockingBytecode },
      tokenCoin,
      privateKey: key.privateKey,
      coinLockingBytecode: key.lockingBytecode,
      makerLockingBytecode: hexToBin(String(readVariable(open, 'makerLockingScript'))),
      categoryHex: category,
      tokenOutputSatoshis: swapIntentTemplate.constants.tokenOutputSatoshis.value,
    };
    // Signatures are Schnorr (fixed size), so a draft's size is the final size.
    const build = (paidAmount: bigint): BuiltConvert => {
      const draft = buildFill({ ...base, paidAmount, feeSatoshis: 0n });
      return buildFill({ ...base, paidAmount, feeSatoshis: BigInt((draft.hex.length / 2) * config.testToken.feeRateSatoshisPerByte) });
    };
    const full = build(wanted);
    const short = build(wanted - 1n);
    const fullResult = verifyLocally(full);
    const shortResult = verifyLocally(short);
    log(`offer coin ${offerCoin.txid}:${offerCoin.vout} (${offerCoin.satoshis} sat); token coin ${tokenCoin.txid}:${tokenCoin.vout}`);
    log(`local VM, maker paid ${wanted} units (wantedAmount): ${String(fullResult)}`);
    log(`local VM, maker paid ${wanted - 1n} units: ${String(shortResult)}`);
    log(`short fill txid ${short.txid}`);
    log(`short fill transaction ${short.hex}`);
    if (fullResult !== true) throw new Error('the fill paying wantedAmount fails locally; the test would not isolate the amount');
    if (shortResult === true) throw new Error('the local VM accepts the short fill; not sending it (covenant fault to report)');
    if (!send) return log('dry run: not sent');
    try {
      log(`node ACCEPTED the short fill: ${await broadcast(client, short.hex)}`);
      process.exitCode = 1;
    } catch (error) {
      log(`node refused: ${error instanceof Error ? error.message : String(error)}`);
    }
    const lookup = await client.request('blockchain.transaction.get', short.txid);
    log(`blockchain.transaction.get ${short.txid}: ${lookup instanceof Error ? lookup.message : 'FOUND'}`);
  } finally {
    await client.disconnect();
  }
};
