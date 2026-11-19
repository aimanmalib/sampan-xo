import { hexToBin } from '@bitauth/libauth';
import type { XOInvitation } from '@xo-cash/types';
import { describe, expect, it } from 'vitest';
import { assertExpired, confirmations, expireOffer, readExpireAfter, readOfferLockingBytecode, type OfferCoin } from '../src/swap-expire.js';
import type { AccountEngine } from '../src/xo-engine.js';

const openHash = 'ab'.repeat(32);
const builtHash = 'cd'.repeat(32);
const offerScript = 'aa20' + '11'.repeat(32) + '87';

const open = (expireAfter: unknown = 2n): XOInvitation =>
  ({
    invitationIdentifier: 'open1',
    templateIdentifier: 't1',
    actionIdentifier: 'open',
    createdAtTimestamp: 1,
    commits: [
      {
        data: {
          variables: [
            { variableIdentifier: 'offeredSatoshis', value: 20000n, roleIdentifier: 'maker' },
            { variableIdentifier: 'wantedCategory', value: 'ef'.repeat(32), roleIdentifier: 'maker' },
            { variableIdentifier: 'wantedAmount', value: 1000n, roleIdentifier: 'maker' },
            { variableIdentifier: 'makerLockingScript', value: '76a9', roleIdentifier: 'maker' },
            { variableIdentifier: 'expireAfter', value: expireAfter, roleIdentifier: 'maker' },
            { variableIdentifier: 'expireFeeSatoshis', value: 500n, roleIdentifier: 'maker' },
          ],
          outputs: [{ outputIdentifier: 'offerOutput', roleIdentifier: 'maker', lockingBytecode: hexToBin(offerScript) }],
        },
      },
      { data: { outputs: [{ valueSatoshis: 1n, lockingBytecode: hexToBin('76a9') }] } },
    ],
    result: { transactions: { openTransaction: { transactionHash: openHash } } },
  }) as unknown as XOInvitation;

const coin = (minedHeight: number, tipHeight: number): OfferCoin => ({ outpointTransactionHash: openHash, outpointIndex: 0, minedHeight, tipHeight });

/** A stand-in engine recording what expireOffer appends, signs and executes. */
const fakeAccount = (missingSignature: boolean) => {
  const calls = { appended: [] as Record<string, unknown>[], signed: [] as number[], executed: [] as unknown[] };
  const account = {
    swapTemplateIdentifier: 't1',
    engine: {
      createInvitation: async () => ({ invitation: { invitationIdentifier: 'expire1' } }),
      appendInvitation: async (_id: string, params: Record<string, unknown>) => {
        calls.appended.push(params);
      },
      listMissingRequirements: async () => ({
        templateRequirements: {},
        inputsMissingSignatures: missingSignature && calls.signed.length === 0 ? [{ inputIdentifier: 'expireInput' }] : [],
        participants: [],
      }),
      signInvitation: async (_id: string, index: number) => {
        calls.signed.push(index);
      },
      buildInvitationTransactionFromMergedCommit: async () => ({ transactionHash: builtHash, serializedTransaction: '00' }),
      executeAction: async (_id: string, params: unknown) => {
        calls.executed.push(params);
      },
      archiveInvitation: async () => undefined,
      getInvitation: async () => ({ invitation: { invitationIdentifier: 'expire1' } }),
    },
  } as unknown as AccountEngine;
  return { account, calls };
};

describe('expire age', () => {
  it('counts confirmations from the mined block, none while unmined', () => {
    expect(confirmations(100, 100)).toBe(1);
    expect(confirmations(100, 101)).toBe(2);
    expect(confirmations(0, 101)).toBe(0);
  });

  it('refuses before expireAfter confirmations and allows from then on', () => {
    expect(() => assertExpired(100, 100, 2)).toThrow('the offer has 1 of 2 confirmations (mined at block 100, tip 100)');
    expect(() => assertExpired(0, 100, 2)).toThrow(/not mined yet/);
    expect(() => assertExpired(100, 101, 2)).not.toThrow();
  });
});

describe('expire inputs read from the open invitation', () => {
  it('reads expireAfter and the offer locking bytecode', () => {
    expect(readExpireAfter(open())).toBe(2);
    expect(readOfferLockingBytecode(open())).toBe(offerScript);
  });

  it('refuses an expireAfter outside the 16 bit block range', () => {
    expect(() => readExpireAfter(open(0n))).toThrow(/no usable expireAfter/);
    expect(() => readExpireAfter(open(0x10000n))).toThrow(/no usable expireAfter/);
  });
});

describe('expire through the engine', () => {
  it('spends the offer at input 0 with sequence expireAfter, returns it at output 0 as expirer, and completes the keyless input', async () => {
    const { account, calls } = fakeAccount(true);
    const result = await expireOffer(account, open(), coin(100, 101), true);
    expect(result.transactionHash).toBe(builtHash);
    expect(calls.appended).toHaveLength(2);
    const [start, joined] = calls.appended as [
      { actionIdentifier: string; roleIdentifier?: string; variables: { variableIdentifier: string; roleIdentifier?: string }[]; inputs: unknown[] },
      { roleIdentifier: string; outputs: unknown[] },
    ];
    expect(start.actionIdentifier).toBe('expire');
    expect(start.roleIdentifier).toBeUndefined();
    expect(start.variables.map((v) => v.variableIdentifier)).toEqual([
      'offeredSatoshis',
      'wantedCategory',
      'wantedAmount',
      'makerLockingScript',
      'expireAfter',
      'expireFeeSatoshis',
    ]);
    expect(start.variables.every((v) => v.roleIdentifier === undefined)).toBe(true);
    expect(start.inputs).toMatchObject([{ inputIdentifier: 'expireInput', transactionIndex: 0, outpointIndex: 0, sequenceNumber: 2 }]);
    expect(joined.roleIdentifier).toBe('expirer');
    expect(joined.outputs).toMatchObject([{ outputIdentifier: 'expireOutput', transactionIndex: 0, roleIdentifier: 'expirer' }]);
    expect(calls.signed).toEqual([0]);
    expect(calls.executed).toEqual([{ broadcastTransaction: true }]);
  });

  it('builds nothing while the offer is too young, unless asked to try early', async () => {
    const young = fakeAccount(false);
    await expect(expireOffer(young.account, open(), coin(100, 100), true)).rejects.toThrow(/1 of 2 confirmations/);
    expect(young.calls.appended).toHaveLength(0);
    const early = fakeAccount(false);
    await expireOffer(early.account, open(), coin(100, 100), false, true);
    expect(early.calls.signed).toEqual([]);
    expect(early.calls.executed).toEqual([{ broadcastTransaction: false }]);
  });
});
