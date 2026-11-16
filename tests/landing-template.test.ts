import { binToHex } from '@bitauth/libauth';
import { compileLockingBytecodeFromTemplateLockingScriptIdentifier } from '@xo-cash/engine';
import { generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { landingTemplate } from '../template/landing.js';
import { defaultLanding, evaluateNumber, landingLockingBytecode } from './support/landing-vm.js';

describe('Landing template', () => {
  it('passes the XO template parser with land as the start action and convert, giveBack as follow-ups', () => {
    const parsed = parseTemplate(landingTemplate);
    expect(Object.keys(parsed.actions).sort()).toEqual(['convert', 'giveBack', 'land']);
    expect(parsed.start).toEqual([{ action: 'land', role: 'payer' }]);
    const follow = parsed.lockingScripts.landingLockingScript?.roles;
    expect(follow?.converter?.actions).toEqual([{ action: 'convert', role: 'converter' }]);
    expect(follow?.payer?.actions).toEqual([{ action: 'giveBack', role: 'payer' }]);
    expect(generateTemplateIdentifier(parsed)).toBe(generateTemplateIdentifier(parseTemplate(landingTemplate)));
  });

  it('names and describes every variable, and keeps the constructor parameters in the landing script state', () => {
    for (const variable of Object.values(landingTemplate.variables)) {
      expect(variable.name.length).toBeGreaterThan(0);
      expect(variable.description.length).toBeGreaterThan(0);
    }
    expect(landingTemplate.lockingScripts.landingLockingScript.state.variables).toEqual([
      'landedSatoshis',
      'ownerLockingScript',
      'tokenCategory',
      'rateNum',
      'rateDen',
      'returnAfter',
    ]);
  });

  it('carries returnAfter as the sequence number of the giveBack input, in a version 2 transaction', () => {
    expect(landingTemplate.inputs.giveBackInput.sequenceNumber).toBe('$(<returnAfter>)');
    expect(landingTemplate.transactions.giveBackTransaction.version).toBe(2);
  });

  it('compiles the same landing locking bytecode in the XO engine as in the test harness', () => {
    const fromEngine = compileLockingBytecodeFromTemplateLockingScriptIdentifier(
      parseTemplate(landingTemplate),
      'landingLockingScript',
      {
        landedSatoshis: defaultLanding.landedSatoshis,
        ownerLockingScript: binToHex(defaultLanding.ownerLockingScript),
        tokenCategory: defaultLanding.tokenCategoryHex,
        rateNum: defaultLanding.rateNum,
        rateDen: defaultLanding.rateDen,
        returnAfter: defaultLanding.returnAfter,
      },
    );
    const harness = landingLockingBytecode();
    expect(binToHex(fromEngine)).toBe(binToHex(harness));
    // OP_HASH256 <32 bytes> OP_EQUAL: pay to script hash 32.
    expect(binToHex(harness)).toMatch(/^aa20[0-9a-f]{64}87$/);
  });

  it('gives a different landing address for a different rate', () => {
    const other = landingLockingBytecode({ ...defaultLanding, rateNum: 2n });
    expect(binToHex(other)).not.toBe(binToHex(landingLockingBytecode()));
  });

  it('computes the smallest token amount the covenant accepts, rounding up', () => {
    expect(evaluateNumber('convertTokenAmount', defaultLanding)).toBe(100n);
    expect(evaluateNumber('convertTokenAmount', { ...defaultLanding, landedSatoshis: 10_050n })).toBe(101n);
    expect(evaluateNumber('convertTokenAmount', { ...defaultLanding, rateNum: 3n, rateDen: 7n })).toBe(4286n);
  });

  it('computes the converter payout and the giveBack value from the variables', () => {
    const extra = { converterCoinSatoshis: 2_000n, converterCoinTokens: 998_000n, convertFeeSatoshis: 700n };
    expect(evaluateNumber('converterPayoutSatoshis', defaultLanding, extra)).toBe(10_300n);
    expect(evaluateNumber('converterPayoutTokens', defaultLanding, extra)).toBe(997_900n);
    expect(evaluateNumber('giveBackSatoshis', defaultLanding, { giveBackFeeSatoshis: 500n })).toBe(9_500n);
  });
});
