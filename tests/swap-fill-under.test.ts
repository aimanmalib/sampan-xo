import { readFileSync } from 'node:fs';
import {
  binToHex,
  createCompilerBch,
  decodeTransactionBch,
  encodeLockingBytecodeP2sh32,
  hash256,
  hashTransactionUiOrder,
  hexToBin,
} from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { swapIntentTemplate as template } from '../template/swap-intent.js';
import { verifyLocally } from '../src/landing-under-rate.js';
import { assertFillUnderChipnetOnly, buildFill, fillUnlockingBytecode, redeemFromFill, type FillUnderRequest } from '../src/swap-fill-under.js';
import { defaultOffer, lockingScriptId, makerLockingBytecode, offerData, offerLockingBytecode, takerLockingBytecode, takerPrivateKey, wantedCategoryHex } from './support/swap-vm.js';

/** The offer script without the pay to script hash 32 wrapper: the redeem bytecode a fill pushes. */
const bareCompiler = createCompilerBch({
  scripts: template.scripts,
  variables: Object.fromEntries(Object.entries(template.variables).map(([id, v]) => [id, { ...v, type: v.type === 'private_key' ? 'Key' : 'WalletData' }])) as never,
});
const compiled = bareCompiler.generateBytecode({ data: offerData(defaultOffer), scriptId: lockingScriptId });
if (!compiled.success) throw new Error(JSON.stringify(compiled.errors));
const redeem = compiled.bytecode;
const wanted = defaultOffer.wantedAmount;

const request = (paidAmount: bigint, over: Partial<FillUnderRequest> = {}): FillUnderRequest => ({
  network: 'chipnet',
  offer: { txid: 'aa'.repeat(32), vout: 0, satoshis: defaultOffer.offeredSatoshis, redeem, lockingBytecode: offerLockingBytecode() },
  tokenCoin: { txid: 'bb'.repeat(32), vout: 1, satoshis: 1_000n, token: { category: wantedCategoryHex, amount: 1_000n } },
  privateKey: takerPrivateKey,
  coinLockingBytecode: takerLockingBytecode,
  makerLockingBytecode,
  categoryHex: wantedCategoryHex,
  paidAmount,
  tokenOutputSatoshis: 1_000n,
  feeSatoshis: 600n,
  ...over,
});

const fixture = JSON.parse(readFileSync(new URL('./fixtures/run8-short-fill.json', import.meta.url), 'utf8')) as {
  txid: string;
  offerLockingBytecode: string;
  transaction: string;
};

describe('short fill (negative test)', () => {
  it('pays the maker wantedAmount - 1 units, and only that differs from a fill the local VM accepts', () => {
    expect(binToHex(encodeLockingBytecodeP2sh32(hash256(redeem)))).toBe(binToHex(offerLockingBytecode()));
    expect(verifyLocally(buildFill(request(wanted)))).toBe(true);
    const short = buildFill(request(wanted - 1n));
    expect(verifyLocally(short)).toMatch(/error in evaluating input index 0: .*non-truthy/);
    const tx = decodeTransactionBch(hexToBin(short.hex));
    if (typeof tx === 'string') throw new Error(tx);
    expect(tx.inputs).toHaveLength(2);
    expect(binToHex(tx.outputs[0]!.lockingBytecode)).toBe(binToHex(makerLockingBytecode));
    expect(tx.outputs[0]!.token?.amount).toBe(wanted - 1n);
    expect(tx.outputs[1]!.token?.amount).toBe(1n);
    expect(tx.outputs[1]!.valueSatoshis).toBe(defaultOffer.offeredSatoshis + 1_000n - 1_000n - 600n);
  });

  it('refuses mainnet, a coin of another category and a coin with too few units', () => {
    expect(() => assertFillUnderChipnetOnly('mainnet')).toThrow(/fill-under-amount runs on chipnet only, not mainnet/);
    expect(() => buildFill(request(wanted - 1n, { network: 'mainnet' }))).toThrow(/chipnet only/);
    expect(() => buildFill(request(wanted - 1n, { categoryHex: 'ff'.repeat(32) }))).toThrow(/does not hold fungible tokens/);
    expect(() => buildFill(request(wanted + 1n))).toThrow(/fewer than 1001/);
  });

  it('reads the redeem bytecode back from a fill, and refuses an input 0 without the fill selector', () => {
    expect(binToHex(redeemFromFill(buildFill(request(wanted)).hex))).toBe(binToHex(redeem));
    const unlocking = fillUnlockingBytecode(redeem);
    expect(unlocking[0]).toBe(0x51);
    const cancelLike = buildFill(request(wanted)).hex.replace(binToHex(unlocking), binToHex(Uint8Array.of(0x00, ...unlocking.slice(1))));
    expect(() => redeemFromFill(cancelLike)).toThrow(/not the fill selector/);
  });

  it('matches the short fill sent to chipnet in run8: 999 units to the maker, redeem hashing to the offer address', () => {
    const bytes = hexToBin(fixture.transaction);
    expect(binToHex(hashTransactionUiOrder(bytes))).toBe(fixture.txid);
    const tx = decodeTransactionBch(bytes);
    if (typeof tx === 'string') throw new Error(tx);
    expect(tx.outputs[0]!.token?.amount).toBe(999n);
    expect(binToHex(encodeLockingBytecodeP2sh32(hash256(redeemFromFill(fixture.transaction))))).toBe(fixture.offerLockingBytecode);
  });
});
