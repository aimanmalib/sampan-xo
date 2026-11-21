import { decodeTransactionBch, hexToBin, binToHex } from '@bitauth/libauth';
import { landingTemplate } from '../template/landing.js';
import { deriveFundingKey } from './accounts.js';
import { broadcast, connectChipnet, listUnspent } from './electrum.js';
import { loadInvitation } from './invitation-file.js';
import { paramsFromConfig, templateLandingBytecode } from './landing-bytecode.js';
import { minimumTokenAmount, readLandTransactionHash } from './landing-convert.js';
import type { LandingRunConfig } from './landing-run-config.js';
import { assertChipnetOnly, buildConvert, verifyLocally, type BuiltConvert, type UnderRateRequest } from './landing-under-rate.js';

/**
 * Builds the under-rate convert of a run's landed coin with a token coin of the owner account's plain P2PKH address,
 * checks it in the local VM next to the same convert at the minimum, and (unless dry run) sends it once to chipnet.
 * Prints every step; the node's answer is printed verbatim. Stops before broadcasting if the local VM accepts it.
 */
export const runUnderRate = async (config: LandingRunConfig, run: string, ownerMnemonic: string, send: boolean, log = console.log): Promise<void> => {
  assertChipnetOnly(config.network);
  const landHash = readLandTransactionHash(loadInvitation(run, 'land'));
  const category = config.testToken.category;
  if (category === null) throw new Error('config testToken.category is not set');
  const params = paramsFromConfig({ ...config.landing, category });
  const redeem = templateLandingBytecode(params, false);
  const lockingBytecode = templateLandingBytecode(params, true);
  const { landedSatoshis, rateNum, rateDen } = config.landing;
  const required = minimumTokenAmount(BigInt(landedSatoshis), BigInt(rateNum), BigInt(rateDen));
  const key = deriveFundingKey(ownerMnemonic, config);
  const client = await connectChipnet(config);
  try {
    const raw = await client.request('blockchain.transaction.get', landHash);
    if (raw instanceof Error) throw raw;
    const landTx = decodeTransactionBch(hexToBin(String(raw)));
    if (typeof landTx === 'string') throw new Error(landTx);
    const vout = landTx.outputs.findIndex((o) => binToHex(o.lockingBytecode) === binToHex(lockingBytecode));
    if (vout < 0) throw new Error(`land transaction ${landHash} has no output to the landing address of config/chipnet.json`);
    const landed = { txid: landHash, vout, satoshis: landTx.outputs[vout]!.valueSatoshis, redeem, lockingBytecode };
    const tokenCoin = (await listUnspent(client, key.address)).find((u) => u.token?.category === category && u.token.nft === undefined && u.token.amount >= required);
    if (tokenCoin === undefined) throw new Error(`the owner address ${key.address} has no coin with ${required} units of ${category}`);
    const base: Omit<UnderRateRequest, 'ownerTokens' | 'feeSatoshis'> = {
      network: config.network,
      landed,
      tokenCoin,
      privateKey: key.privateKey,
      coinLockingBytecode: key.lockingBytecode,
      ownerLockingBytecode: hexToBin(params.ownerLockingScript),
      categoryHex: category,
      tokenOutputSatoshis: landingTemplate.constants.tokenOutputSatoshis.value,
    };
    // Signatures are Schnorr (fixed size), so a draft's size is the final size.
    const build = (ownerTokens: bigint): BuiltConvert => {
      const draft = buildConvert({ ...base, ownerTokens, feeSatoshis: 0n });
      return buildConvert({ ...base, ownerTokens, feeSatoshis: BigInt((draft.hex.length / 2) * config.testToken.feeRateSatoshisPerByte) });
    };
    const atMinimum = build(required);
    const under = build(required - 1n);
    log(`landed coin ${landHash}:${vout} (${landed.satoshis} sat); token coin ${tokenCoin.txid}:${tokenCoin.vout}`);
    log(`local VM, owner paid ${required} units (the minimum): ${String(verifyLocally(atMinimum))}`);
    const local = verifyLocally(under);
    log(`local VM, owner paid ${required - 1n} units: ${String(local)}`);
    log(`under-rate txid ${under.txid}`);
    log(`under-rate transaction ${under.hex}`);
    if (verifyLocally(atMinimum) !== true) throw new Error('the convert at the minimum fails locally; the test would not isolate the rate');
    if (local === true) throw new Error('the local VM accepts the under-rate convert; not sending it (covenant fault to report)');
    if (!send) return log('dry run: not sent');
    try {
      log(`node ACCEPTED the under-rate convert: ${await broadcast(client, under.hex)}`);
      process.exitCode = 1;
    } catch (error) {
      log(`node refused: ${error instanceof Error ? error.message : String(error)}`);
    }
    const lookup = await client.request('blockchain.transaction.get', under.txid);
    log(`blockchain.transaction.get ${under.txid}: ${lookup instanceof Error ? lookup.message : 'FOUND'}`);
  } finally {
    await client.disconnect();
  }
};
