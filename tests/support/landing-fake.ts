import type { XOInvitation } from '@xo-cash/types';
import { loadConfig } from '../../src/config.js';
import { landingVariables } from '../../src/landing-land.js';
import type { AccountEngine } from '../../src/xo-engine.js';

export const config = loadConfig();
export const hash = 'ab'.repeat(32);

export const landInvitation = (extra: Partial<XOInvitation> = {}): XOInvitation =>
  ({
    invitationIdentifier: 'land1',
    commits: [
      { data: { variables: landingVariables(config).slice(0, 3).map((v) => ({ ...v, roleIdentifier: 'payer' })) } },
      { data: { variables: [...landingVariables(config).slice(3), { variableIdentifier: 'other', value: 1n }] } },
    ],
    result: { transactions: { landTransaction: { transactionHash: hash, broadcastedAtTimestamp: 2 } } },
    ...extra,
  }) as unknown as XOInvitation;

export type Utxo = { outpointTransactionHash: string; outpointIndex: number; templateIdentifier: string; valueSatoshis: number; tokenCategory?: string; tokenAmount?: string; tokenNftCapability?: string };

/** A stand-in engine recording what the convert steps append and sign. */
export const fakeAccount = (utxos: Utxo[]) => {
  const calls = { appended: [] as Record<string, unknown>[], signed: [] as number[], accepted: [] as unknown[], executed: [] as unknown[], archived: [] as string[] };
  const account = {
    landingTemplateIdentifier: 'landing',
    engine: {
      listUnspentOutputs: async () => utxos,
      listSpendableUnspentOutputs: async () => utxos,
      createInvitation: async () => ({ invitation: { invitationIdentifier: 'c1' } }),
      acceptInvitation: async (_i: unknown, role: unknown) => (calls.accepted.push(role), { invitation: { invitationIdentifier: 'c1' } }),
      appendInvitation: async (_id: string, params: Record<string, unknown>) => (calls.appended.push(params), { invitation: { invitationIdentifier: 'c1' } }),
      generateLockingBytecodeFromDefaultPolicy: async () => '76a9',
      listOwnInputIndexes: async () => [1],
      signInvitation: async (_id: string, index: number) => void calls.signed.push(index),
      getInvitation: async () => ({ invitation: { invitationIdentifier: 'c1' } }),
      listMissingRequirements: async () => ({ templateRequirements: {}, inputsMissingSignatures: [], participants: [] }),
      buildInvitationTransactionFromMergedCommit: async () => ({ transactionHash: 'ef'.repeat(32), serializedTransaction: '02' }),
      executeAction: async (_id: string, options: unknown) => void calls.executed.push(options),
      archiveInvitation: async (id: string) => void calls.archived.push(id),
      addChangeToInvitation: async () => {
        throw new Error('follow-up actions must not add change');
      },
    },
  } as unknown as AccountEngine;
  return { account, calls };
};

export const tokenCoin = (tokenAmount: string, extra: Partial<Utxo> = {}): Utxo => ({
  outpointTransactionHash: 'cd'.repeat(32),
  outpointIndex: 2,
  templateIdentifier: 'wallet',
  valueSatoshis: 1000,
  tokenCategory: config.testToken.category!,
  tokenAmount,
  ...extra,
});
