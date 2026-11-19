import { binToHex } from '@bitauth/libauth';
import { compileLockingBytecodeFromTemplateLockingScriptIdentifier } from '@xo-cash/engine';
import { generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { swapIntentTemplate } from '../template/swap-intent.js';
import {
  defaultOffer,
  makerPrivateKey,
  offerLockingBytecode,
  otherCategoryHex,
  p2pkhLockingBytecode,
  publicKeyHex,
  strangerPrivateKey,
  takerLockingBytecode,
  validFill,
  verifyCancel,
  verifyFill,
} from './support/swap-vm.js';

describe('Swap Intent template', () => {
  it('passes the XO template parser and gets a stable identifier', () => {
    const parsed = parseTemplate(swapIntentTemplate);
    expect(Object.keys(parsed.actions).sort()).toEqual(['cancel', 'expire', 'fill', 'open']);
    expect(parsed.start).toEqual([{ action: 'open', role: 'maker', generate: ['makerKey'] }]);
    expect(generateTemplateIdentifier(parsed)).toBe(generateTemplateIdentifier(parseTemplate(swapIntentTemplate)));
  });

  it('declares the four offer variables from the specification and the two expire variables, each with a name and description', () => {
    const variables = swapIntentTemplate.variables;
    for (const id of ['offeredSatoshis', 'wantedCategory', 'wantedAmount', 'makerLockingScript', 'expireAfter', 'expireFeeSatoshis'] as const) {
      expect(variables[id].name.length).toBeGreaterThan(0);
      expect(variables[id].description.length).toBeGreaterThan(0);
    }
    expect(swapIntentTemplate.lockingScripts.offerLockingScript.state.variables).toEqual([
      'offeredSatoshis',
      'wantedCategory',
      'wantedAmount',
      'makerLockingScript',
      'expireAfter',
      'expireFeeSatoshis',
    ]);
  });

  it('compiles the same offer locking bytecode in the XO engine as in the test harness', () => {
    const fromEngine = compileLockingBytecodeFromTemplateLockingScriptIdentifier(
      parseTemplate(swapIntentTemplate),
      'offerLockingScript',
      {
        offeredSatoshis: defaultOffer.offeredSatoshis,
        wantedCategory: defaultOffer.wantedCategoryHex,
        wantedAmount: defaultOffer.wantedAmount,
        makerLockingScript: binToHex(defaultOffer.makerLockingScript),
        expireAfter: defaultOffer.expireAfter,
        expireFeeSatoshis: defaultOffer.expireFeeSatoshis,
        'makerKey.public_key': publicKeyHex(makerPrivateKey),
      },
    );
    const harness = offerLockingBytecode();
    expect(binToHex(fromEngine)).toBe(binToHex(harness));
    // OP_HASH256 <32 bytes> OP_EQUAL: pay to script hash 32.
    expect(binToHex(harness)).toMatch(/^aa20[0-9a-f]{64}87$/);
  });
});

/** Every rejection must come from the VM evaluating the offer input, not from building the transaction. */
const rejectedAtOffer = /error in evaluating input index 0/;

describe('Swap Intent covenant in the BCH 2026 VM', () => {
  it('fill: accepts the wanted category and amount paid to the maker at the offer index', () => {
    expect(verifyFill(validFill())).toBe(true);
  });

  it('fill: accepts more tokens than wanted', () => {
    expect(verifyFill({ ...validFill(), paymentAmount: defaultOffer.wantedAmount + 1n })).toBe(true);
  });

  it('fill: rejects fewer tokens than wanted', () => {
    expect(verifyFill({ ...validFill(), paymentAmount: defaultOffer.wantedAmount - 1n })).toMatch(rejectedAtOffer);
  });

  it('fill: rejects the wrong token category', () => {
    expect(verifyFill({ ...validFill(), paymentCategoryHex: otherCategoryHex })).toMatch(rejectedAtOffer);
  });

  it('fill: rejects a payment to someone other than the maker', () => {
    expect(verifyFill({ ...validFill(), paymentLockingBytecode: takerLockingBytecode })).toMatch(rejectedAtOffer);
  });

  it('fill: rejects a correct payment at another output index', () => {
    expect(verifyFill({ ...validFill(), paymentIndex: 1 })).toMatch(rejectedAtOffer);
  });

  it('fill: an offer at input 1 is paid at output 1', () => {
    expect(verifyFill({ ...validFill(), offerInputIndex: 1, paymentIndex: 1 })).toBe(true);
    expect(verifyFill({ ...validFill(), offerInputIndex: 1, paymentIndex: 0 })).toMatch(/error in evaluating input index 1/);
  });

  it('cancel: accepts the maker signature', () => {
    expect(verifyCancel(makerPrivateKey)).toBe(true);
  });

  it('cancel: rejects a signature from any other key', () => {
    expect(verifyCancel(strangerPrivateKey)).toMatch(rejectedAtOffer);
  });

  it('cancel: an unsigned spend that does not pay the wanted tokens is rejected', () => {
    const toStranger = p2pkhLockingBytecode(strangerPrivateKey);
    expect(verifyCancel(strangerPrivateKey, 'fillUnlockingBytecode', defaultOffer, toStranger)).toMatch(rejectedAtOffer);
  });
});
