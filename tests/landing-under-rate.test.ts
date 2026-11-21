import { binToHex, decodeTransactionBch, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { templateLandingBytecode, type LandingParams } from '../src/landing-bytecode.js';
import { minimumTokenAmount } from '../src/landing-convert.js';
import { assertChipnetOnly, buildConvert, convertUnlockingBytecode, verifyLocally, type UnderRateRequest } from '../src/landing-under-rate.js';
import { makerLockingBytecode, takerLockingBytecode, takerPrivateKey, wantedCategoryHex } from './support/swap-vm.js';

const params: LandingParams = { ownerLockingScript: binToHex(makerLockingBytecode), category: wantedCategoryHex, rateNum: 1, rateDen: 100, returnAfter: 6 };
const landedSatoshis = 10_000n;
const required = minimumTokenAmount(landedSatoshis, 1n, 100n);

const request = (ownerTokens: bigint, over: Partial<UnderRateRequest> = {}): UnderRateRequest => ({
  network: 'chipnet',
  landed: {
    txid: 'aa'.repeat(32),
    vout: 0,
    satoshis: landedSatoshis,
    redeem: templateLandingBytecode(params, false),
    lockingBytecode: templateLandingBytecode(params, true),
  },
  tokenCoin: { txid: 'bb'.repeat(32), vout: 1, satoshis: 5_000n, token: { category: wantedCategoryHex, amount: 500n } },
  privateKey: takerPrivateKey,
  coinLockingBytecode: takerLockingBytecode,
  ownerLockingBytecode: makerLockingBytecode,
  categoryHex: wantedCategoryHex,
  ownerTokens,
  tokenOutputSatoshis: 1000n,
  feeSatoshis: 600n,
  ...over,
});

describe('under-rate convert (negative test)', () => {
  it('passes the local VM at the minimum and fails it one unit under, the only difference being the token amount', () => {
    expect(required).toBe(100n);
    expect(verifyLocally(buildConvert(request(required)))).toBe(true);
    const under = buildConvert(request(required - 1n));
    expect(verifyLocally(under)).toMatch(/error in evaluating input index 0: .*non-truthy/);
    const tx = decodeTransactionBch(hexToBin(under.hex));
    if (typeof tx === 'string') throw new Error(tx);
    expect(tx.inputs).toHaveLength(2);
    expect(tx.outputs).toHaveLength(2);
    expect(tx.outputs[0]!.token?.amount).toBe(99n);
    expect(tx.outputs[1]!.token?.amount).toBe(401n);
    expect(tx.outputs[1]!.valueSatoshis).toBe(landedSatoshis + 5_000n - 1000n - 600n);
  });

  it('unlocks the landed coin with the convert selector and the redeem bytecode', () => {
    const redeem = templateLandingBytecode(params, false);
    const unlocking = convertUnlockingBytecode(redeem);
    expect(unlocking[0]).toBe(0x00);
    expect(binToHex(unlocking)).toContain(binToHex(redeem));
  });

  it('refuses mainnet, a coin of another category and a coin with too few units', () => {
    expect(() => assertChipnetOnly('mainnet')).toThrow(/chipnet only/);
    expect(() => buildConvert(request(99n, { network: 'mainnet' }))).toThrow(/chipnet only/);
    expect(() => buildConvert(request(99n, { categoryHex: 'ff'.repeat(32) }))).toThrow(/does not hold fungible tokens/);
    expect(() => buildConvert(request(600n))).toThrow(/fewer than 600/);
  });
});
