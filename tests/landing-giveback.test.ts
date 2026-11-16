import { describe, expect, it } from 'vitest';
import { assertOldEnough, confirmations, giveBack } from '../src/landing-giveback.js';
import { config, fakeAccount, hash, landInvitation } from './support/landing-fake.js';

describe('landing giveBack step', () => {
  it('counts confirmations from the mined height, none while unmined', () => {
    expect(confirmations(333701, 333701)).toBe(1);
    expect(confirmations(333701, 333706)).toBe(6);
    expect(confirmations(0, 333706)).toBe(0);
    expect(confirmations(-1, 333706)).toBe(0);
  });

  it('refuses a landed coin younger than returnAfter blocks, accepts it from returnAfter confirmations', () => {
    expect(() => assertOldEnough(333701, 333705, 6)).toThrow('the landed coin has 5 of 6 confirmations (mined at block 333701, tip 333705)');
    expect(() => assertOldEnough(0, 333705, 6)).toThrow(/0 of 6 confirmations \(not mined yet\)/);
    expect(() => assertOldEnough(333701, 333706, 6)).not.toThrow();
  });

  it('spends the landed coin at input 0 with sequence returnAfter, pays the owner at output 0, adds no change', async () => {
    const landed = { outpointTransactionHash: hash, outpointIndex: 0, templateIdentifier: 'landing', valueSatoshis: 10000 };
    const { account, calls } = fakeAccount([landed]);
    const result = await giveBack(account, landInvitation(), config, true);
    const [start, payer] = calls.appended as { inputs?: unknown; outputs?: unknown; variables?: unknown; roleIdentifier?: string; actionIdentifier: string }[];
    expect(start!.actionIdentifier).toBe('giveBack');
    expect(start!.inputs).toEqual([expect.objectContaining({ inputIdentifier: 'giveBackInput', transactionIndex: 0, outpointIndex: 0, sequenceNumber: config.landing.returnAfter })]);
    expect(payer!.roleIdentifier).toBe('payer');
    expect(payer!.outputs).toEqual([expect.objectContaining({ outputIdentifier: 'giveBackOutput', transactionIndex: 0 })]);
    expect(payer!.variables).toEqual([expect.objectContaining({ variableIdentifier: 'giveBackFeeSatoshis', value: BigInt(config.landing.giveBackFeeSatoshis) })]);
    expect(calls.executed).toEqual([{ broadcastTransaction: true }]);
    expect(calls.archived).toEqual([]);
    expect(result.transactionHash).toBe('ef'.repeat(32));
  });

  it('a dry run builds without broadcasting and archives the invitation', async () => {
    const landed = { outpointTransactionHash: hash, outpointIndex: 0, templateIdentifier: 'landing', valueSatoshis: 10000 };
    const { account, calls } = fakeAccount([landed]);
    await giveBack(account, landInvitation(), config, false);
    expect(calls.executed).toEqual([{ broadcastTransaction: false }]);
    expect(calls.archived).toEqual(['c1']);
  });
});
