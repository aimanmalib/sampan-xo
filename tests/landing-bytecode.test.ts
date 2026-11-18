import { readFileSync } from 'node:fs';
import { binToHex, decodeAuthenticationInstructions, decodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
  cashcRedeem,
  checkDeployed,
  compareRedeems,
  type CashcArtifact,
  type DeployedFixture,
} from '../src/landing-bytecode.js';
import { landingTemplate } from '../template/landing.js';

const read = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as T;
const fixture = read<DeployedFixture>('landing-deployed.json');
const artifact = read<CashcArtifact>('landing-artifact.json');

/** Flips one hex digit of a string at a character position. */
const flipAt = (hex: string, at: number): string => hex.slice(0, at) + (hex[at] === '0' ? '1' : '0') + hex.slice(at + 1);

describe('Landing template against the deployed Sampan contract', () => {
  it('compiles to the deployed redeem bytecode, which is also cashc output for the same parameters', () => {
    const report = checkDeployed(fixture, artifact);
    expect(report.identical).toBe(true);
    expect(report.templateRedeem).toBe(fixture.redeemBytecode);
    expect(report.cashcRedeem).toBe(fixture.redeemBytecode);
    expect(report.templateLocking).toMatch(/^aa20[0-9a-f]{64}87$/);
  });

  it('rejects a fixture with one byte of the raw transaction changed: it no longer hashes to the txid', () => {
    const tampered = { ...fixture, rawTx: flipAt(fixture.rawTx, fixture.rawTx.length - 20) };
    expect(() => checkDeployed(tampered, artifact)).toThrow(/does not hash to txid/);
  });

  it('rejects a fixture whose stated redeem bytecode or prevout is not the one on chain', () => {
    expect(() => checkDeployed({ ...fixture, redeemBytecode: flipAt(fixture.redeemBytecode, 3) }, artifact)).toThrow(/last push/);
    expect(() => checkDeployed({ ...fixture, prevoutLockingBytecode: flipAt(fixture.prevoutLockingBytecode, 10) }, artifact)).toThrow(
      /prevoutLockingBytecode/,
    );
    expect(() => checkDeployed({ ...fixture, params: { ...fixture.params, rateNum: fixture.params.rateNum + 1 } }, artifact)).toThrow(
      /params/,
    );
  });

  it('is not identical for other parameters (rate plus one)', () => {
    const params = { ...fixture.params, rateNum: fixture.params.rateNum + 1 };
    const report = compareRedeems(params, artifact);
    expect(report.templateRedeem).not.toBe(fixture.redeemBytecode);
    expect(compareRedeems(params, artifact, landingTemplate, fixture.redeemBytecode).identical).toBe(false);
    // The template and cashc still agree with each other for the new parameters.
    expect(report.identical).toBe(true);
  });

  it('turns red when one opcode is removed from the template script', () => {
    const scripts = { ...landingTemplate.scripts, convertChecks: landingTemplate.scripts.convertChecks.replace(/ OP_NIP OP_NIP$/, ' OP_NIP') };
    const sabotaged = { ...landingTemplate, scripts };
    expect(checkDeployed(fixture, artifact, sabotaged).identical).toBe(false);
    expect(checkDeployed(fixture, artifact).identical).toBe(true);
  });

  it('turns red when the category is pushed in display order instead of transaction order', () => {
    const scripts = { ...landingTemplate.scripts, landingConstructorArguments: '<returnAfter> <rateDen> <rateNum> <tokenCategory> <ownerLockingScript>' };
    expect(checkDeployed(fixture, artifact, { ...landingTemplate, scripts }).identical).toBe(false);
  });

  it('unlocks with the cashc function selector: the deployed giveBack pushed 1 before the redeem bytecode', () => {
    const tx = decodeTransaction(hexToBin(fixture.rawTx));
    if (typeof tx === 'string') throw new Error(tx);
    const [selector] = decodeAuthenticationInstructions(tx.inputs[fixture.input]!.unlockingBytecode);
    expect(selector?.opcode).toBe(0x51);
    expect(landingTemplate.scripts.giveBackUnlockingBytecode).toBe('OP_1');
    expect(landingTemplate.scripts.convertUnlockingBytecode).toBe('OP_0');
  });

  it('builds the cashc redeem bytecode from the artifact, arguments last parameter first', () => {
    const redeem = binToHex(cashcRedeem(artifact, fixture.params));
    // OP_6 (returnAfter 6) first, then the 25-byte owner locking bytecode just before OP_5 OP_PICK.
    expect(redeem.startsWith('56')).toBe(true);
    expect(redeem).toContain(`19${fixture.params.ownerLockingScript}5579`);
    expect(() => cashcRedeem({ ...artifact, constructorInputs: artifact.constructorInputs.slice(1) }, fixture.params)).toThrow(
      /unexpected constructor/,
    );
  });
});
