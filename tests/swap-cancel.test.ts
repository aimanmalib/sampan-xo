import type { XOInvitation } from '@xo-cash/types';
import { describe, expect, it } from 'vitest';
import { cancelOffer } from '../src/swap-cancel.js';
import type { AccountEngine } from '../src/xo-engine.js';

const openHash = 'ab'.repeat(32);
const builtHash = 'cd'.repeat(32);

const openInvitation = {
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
          { variableIdentifier: 'expireAfter', value: 2n, roleIdentifier: 'maker' },
          { variableIdentifier: 'expireFeeSatoshis', value: 500n, roleIdentifier: 'maker' },
        ],
      },
    },
  ],
  result: { transactions: { openTransaction: { transactionHash: openHash } } },
} as unknown as XOInvitation;

/** A stand-in engine recording what cancelOffer appends, signs and executes. */
const fakeAccount = (unspent: { outpointTransactionHash: string; outpointIndex: number; templateIdentifier: string }[]) => {
  const calls = { appended: [] as unknown[], signed: [] as number[], executed: [] as unknown[] };
  const account = {
    swapTemplateIdentifier: 't1',
    engine: {
      listUnspentOutputs: async () => unspent,
      createInvitation: async () => ({ invitation: { invitationIdentifier: 'cancel1' } }),
      appendInvitation: async (_id: string, params: unknown) => {
        calls.appended.push(params);
      },
      listOwnInputIndexes: async () => [0],
      signInvitation: async (_id: string, index: number) => {
        calls.signed.push(index);
      },
      listMissingRequirements: async () => ({ templateRequirements: {}, inputsMissingSignatures: [], participants: [] }),
      buildInvitationTransactionFromMergedCommit: async () => ({ transactionHash: builtHash, serializedTransaction: '00' }),
      executeAction: async (_id: string, params: unknown) => {
        calls.executed.push(params);
      },
      archiveInvitation: async () => undefined,
      getInvitation: async () => ({ invitation: { invitationIdentifier: 'cancel1' } }),
    },
  } as unknown as AccountEngine;
  return { account, calls };
};

describe('cancel through the engine', () => {
  it('spends the offer coin at input 0 to the refund output at index 0, as maker, and signs it', async () => {
    const { account, calls } = fakeAccount([
      { outpointTransactionHash: openHash, outpointIndex: 1, templateIdentifier: 'other' },
      { outpointTransactionHash: openHash, outpointIndex: 0, templateIdentifier: 't1' },
    ]);
    const result = await cancelOffer(account, openInvitation, true);
    expect(result.transactionHash).toBe(builtHash);
    expect(calls.appended).toHaveLength(1);
    const params = calls.appended[0] as {
      actionIdentifier: string;
      roleIdentifier: string;
      variables: { variableIdentifier: string; roleIdentifier: string }[];
      inputs: { inputIdentifier: string; transactionIndex: number; outpointIndex: number; roleIdentifier: string }[];
      outputs: { outputIdentifier: string; transactionIndex: number }[];
    };
    expect(params.actionIdentifier).toBe('cancel');
    expect(params.roleIdentifier).toBe('maker');
    expect(params.variables.map((v) => [v.variableIdentifier, v.roleIdentifier])).toEqual([
      ['offeredSatoshis', 'maker'],
      ['wantedCategory', 'maker'],
      ['wantedAmount', 'maker'],
      ['makerLockingScript', 'maker'],
      ['expireAfter', 'maker'],
      ['expireFeeSatoshis', 'maker'],
    ]);
    expect(params.inputs).toMatchObject([{ inputIdentifier: 'cancelInput', transactionIndex: 0, outpointIndex: 0, roleIdentifier: 'maker' }]);
    expect(params.outputs).toMatchObject([{ outputIdentifier: 'refundOutput', transactionIndex: 0 }]);
    expect(calls.signed).toEqual([0]);
    expect(calls.executed).toEqual([{ broadcastTransaction: true }]);
  });

  it('refuses when the engine no longer holds the offer coin', async () => {
    const { account, calls } = fakeAccount([]);
    await expect(cancelOffer(account, openInvitation, true)).rejects.toThrow(`no unspent offer from ${openHash}`);
    expect(calls.appended).toHaveLength(0);
  });
});
