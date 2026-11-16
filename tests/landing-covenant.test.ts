import { hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
  converterLockingBytecode,
  defaultLanding,
  otherCategoryHex,
  ownerLockingBytecode,
  strangerLockingBytecode,
  validConvert,
  validGiveBack,
  verifyConvert,
  verifyGiveBack,
} from './support/landing-vm.js';

/** Every rejection must come from the VM evaluating the landing input (input 0 unless the test moves it). */
const rejectedAt = (index: number) => new RegExp(`error in evaluating input index ${index}`);

describe('Landing covenant: convert', () => {
  it('passes at the exact minimum', () => {
    expect(verifyConvert(validConvert())).toBe(true);
  });

  it('passes at the rounded up minimum when the rate does not divide the landed value', () => {
    const landing = { ...defaultLanding, landedSatoshis: 10_050n };
    expect(validConvert(landing).ownerTokens).toBe(101n);
    expect(verifyConvert(validConvert(landing), landing)).toBe(true);
    expect(verifyConvert({ ...validConvert(landing), ownerTokens: 100n }, landing)).toMatch(rejectedAt(0));
  });

  it('fails one base unit below the minimum', () => {
    expect(verifyConvert({ ...validConvert(), ownerTokens: 99n })).toMatch(rejectedAt(0));
  });

  it('fails when output 0 pays a different locking bytecode', () => {
    expect(verifyConvert({ ...validConvert(), ownerLockingBytecode: strangerLockingBytecode })).toMatch(rejectedAt(0));
  });

  it('fails when output 0 carries another token category', () => {
    expect(verifyConvert({ ...validConvert(), categoryHex: otherCategoryHex })).toMatch(rejectedAt(0));
  });

  it('needs the category in display order: the same bytes reversed fail', () => {
    const reversed = Buffer.from(hexToBin(defaultLanding.tokenCategoryHex)).reverse().toString('hex');
    expect(verifyConvert({ ...validConvert(), categoryHex: reversed })).toMatch(rejectedAt(0));
  });

  it('fails with an extra output', () => {
    expect(verifyConvert({ ...validConvert(), extraOutput: true })).toMatch(rejectedAt(0));
  });

  it('fails when the landing coin is not input 0', () => {
    expect(verifyConvert({ ...validConvert(), landingInputIndex: 1 })).toMatch(rejectedAt(1));
  });

  it('pays a P2SH owner by its full 23-byte locking bytecode', () => {
    const p2shOwner = hexToBin(`a914${'ab'.repeat(20)}87`);
    const landing = { ...defaultLanding, ownerLockingScript: p2shOwner };
    expect(verifyConvert(validConvert(landing), landing)).toBe(true);
    expect(verifyConvert({ ...validConvert(landing), ownerLockingBytecode: ownerLockingBytecode }, landing)).toMatch(rejectedAt(0));
  });
});

describe('Landing covenant: giveBack', () => {
  it('fails before the coin is returnAfter blocks old', () => {
    expect(verifyGiveBack({ ...validGiveBack(), sequenceNumber: 5 })).toMatch(rejectedAt(0));
  });

  it('fails with the default final sequence (relative lock disabled)', () => {
    expect(verifyGiveBack({ ...validGiveBack(), sequenceNumber: 0xffffffff })).toMatch(rejectedAt(0));
  });

  it('passes once the coin is old enough', () => {
    expect(verifyGiveBack(validGiveBack())).toBe(true);
    expect(verifyGiveBack({ ...validGiveBack(), sequenceNumber: 20 })).toBe(true);
  });

  it('passes with exactly 1000 satoshis kept as fee and fails with 1001', () => {
    expect(verifyGiveBack(validGiveBack(defaultLanding, 1_000n))).toBe(true);
    expect(verifyGiveBack(validGiveBack(defaultLanding, 1_001n))).toMatch(rejectedAt(0));
  });

  it('fails with two outputs', () => {
    const [refund] = validGiveBack(defaultLanding, 1_000n).outputs;
    const outputs = [refund!, { lockingBytecode: converterLockingBytecode, valueSatoshis: 546n }];
    expect(verifyGiveBack({ ...validGiveBack(), outputs })).toMatch(rejectedAt(0));
  });

  it('fails to another address', () => {
    const outputs = [{ lockingBytecode: strangerLockingBytecode, valueSatoshis: 9_500n }];
    expect(verifyGiveBack({ ...validGiveBack(), outputs })).toMatch(rejectedAt(0));
  });

  it('fails when the output carries a token', () => {
    // A token output needs a token input; the landing coin has none, so the transaction is refused as a whole.
    const token = { amount: 1n, category: hexToBin(defaultLanding.tokenCategoryHex) };
    const outputs = [{ lockingBytecode: ownerLockingBytecode, valueSatoshis: 9_500n, token }];
    expect(verifyGiveBack({ ...validGiveBack(), outputs })).not.toBe(true);
  });
});
