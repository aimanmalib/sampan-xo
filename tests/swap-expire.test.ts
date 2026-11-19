import { hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { returnToMaker, finalSequence, validExpire, verifyExpire } from './support/swap-expire-vm.js';
import { defaultOffer, takerLockingBytecode, verifyFill, validFill } from './support/swap-vm.js';

/** Every rejection must come from the VM evaluating the offer input, not from building the transaction. */
const rejectedAtOffer = /error in evaluating input index 0/;

describe('Swap Intent expire path in the BCH 2026 VM', () => {
  it('accepts a return to the maker once the sequence number carries expireAfter blocks', () => {
    expect(verifyExpire(validExpire())).toBe(true);
  });

  it('accepts a longer relative lock and a smaller fee', () => {
    const output = { ...returnToMaker(), valueSatoshis: defaultOffer.offeredSatoshis };
    expect(verifyExpire({ sequenceNumber: Number(defaultOffer.expireAfter) + 5, outputs: [output] })).toBe(true);
  });

  it('rejects a relative lock shorter than expireAfter', () => {
    expect(verifyExpire({ ...validExpire(), sequenceNumber: Number(defaultOffer.expireAfter) - 1 })).toMatch(rejectedAtOffer);
  });

  it('rejects a final sequence number (relative lock disabled)', () => {
    expect(verifyExpire({ ...validExpire(), sequenceNumber: finalSequence })).toMatch(rejectedAtOffer);
  });

  it('rejects a version 1 transaction, where relative locks do not apply', () => {
    expect(verifyExpire({ ...validExpire(), version: 1 })).toMatch(rejectedAtOffer);
  });

  it('rejects a return to any other locking script', () => {
    const output = { ...returnToMaker(), lockingBytecode: takerLockingBytecode };
    expect(verifyExpire({ ...validExpire(), outputs: [output] })).toMatch(rejectedAtOffer);
  });

  it('rejects a value below offeredSatoshis less expireFeeSatoshis', () => {
    const output = { ...returnToMaker(), valueSatoshis: returnToMaker().valueSatoshis - 1n };
    expect(verifyExpire({ ...validExpire(), outputs: [output] })).toMatch(rejectedAtOffer);
  });

  it('rejects a second output, even with the full return at output 0', () => {
    // A fee of 1000 leaves room for a second output above the dust limit.
    const offer = { ...defaultOffer, expireFeeSatoshis: 1_000n };
    const second = { lockingBytecode: takerLockingBytecode, valueSatoshis: 600n };
    expect(verifyExpire(validExpire(offer), offer)).toBe(true);
    expect(verifyExpire({ ...validExpire(offer), outputs: [returnToMaker(offer), second] }, offer)).toMatch(rejectedAtOffer);
  });

  it('rejects a second input', () => {
    expect(verifyExpire({ ...validExpire(), extraInput: true })).toMatch(rejectedAtOffer);
  });

  it('rejects a return that carries tokens', () => {
    // A token genesis from the offer input (outpoint index 0), so the transaction is valid apart from the covenant.
    const token = { category: hexToBin('dd'.repeat(32)), amount: 1n };
    expect(verifyExpire({ ...validExpire(), outputs: [{ ...returnToMaker(), token }] })).toMatch(rejectedAtOffer);
  });

  it('leaves the fill path as it was: a fill needs no relative lock', () => {
    expect(verifyFill(validFill())).toBe(true);
  });
});
