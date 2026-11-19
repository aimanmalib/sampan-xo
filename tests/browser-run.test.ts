import { readFileSync } from 'node:fs';
import type { XOInvitation } from '@xo-cash/types';
import { p2pkhTemplate } from '@xo-cash/templates';
import { deserializeInvitation, generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { addressToLockingBytecode } from '../src/send.js';
import { fillInputTransactionIndex, finishFill } from '../src/swap-fill.js';
import { identifierOf } from '../src/used-templates.js';
import type { AccountEngine } from '../src/xo-engine.js';

const hash = 'cd'.repeat(32);
const commit = (commitIdentifier: string) => ({ commitIdentifier, data: {} });
const taken = { invitationIdentifier: 'i1', commits: [commit('a'), commit('b'), commit('c')] } as unknown as XOInvitation;

/** A stand-in maker engine that owns, by its own count, inputs 0, 1 and 2, but can only unlock input 0. */
const fakeMaker = (storedCommits: string[], fillInputMissing: boolean) => {
  const calls: string[] = [];
  const account = {
    engine: {
      getInvitation: async () => ({ invitation: { ...taken, commits: storedCommits.map(commit), result: { transactions: { fillTransaction: { transactionHash: hash, broadcastedAtTimestamp: 1 } } } } }),
      updateInvitation: async () => void calls.push('update'),
      listOwnInputIndexes: async () => [0, 1, 2],
      listMissingRequirements: async () => ({
        templateRequirements: {},
        inputsMissingSignatures: fillInputMissing && !calls.includes('sign 0') ? [{ inputIdentifier: 'fillInput' }] : [],
        participants: [],
      }),
      signInvitation: async (_id: string, index: number) => {
        if (index !== fillInputTransactionIndex) throw Object.assign(new Error('no unlocking script'), { name: 'TemplateUnlockingScriptNotFoundError' });
        calls.push(`sign ${index}`);
      },
      buildInvitationTransactionFromMergedCommit: async () => ({ transactionHash: hash, serializedTransaction: '00' }),
      executeAction: async () => void calls.push('execute'),
      archiveInvitation: async () => undefined,
    },
  } as unknown as AccountEngine;
  return { account, calls };
};

describe('fill finish by the maker', () => {
  it('signs only the offer input, even when the engine counts the taker inputs as its own', async () => {
    const { account, calls } = fakeMaker(['a', 'b'], true);
    const result = await finishFill(account, taken, true);
    expect(calls).toEqual(['update', 'sign 0', 'execute']);
    expect(result.transactionHash).toBe(hash);
  });

  it('resumes after a failed finish: no update when every taker commit is stored, no second signature', async () => {
    const { account, calls } = fakeMaker(['a', 'b', 'c', 'maker-signature'], false);
    await finishFill(account, taken, true);
    expect(calls).toEqual(['execute']);
  });
});

describe('addresses for scripts/send.ts', () => {
  it('decodes a chipnet P2PKH address to its locking bytecode', () => {
    expect(addressToLockingBytecode('bchtest:qz3zugr6rdmx8xy0ykqfu6r0me6vhj6juuysc3qunc', 'bchtest')).toBe('76a914a22e207a1b7663988f25809e686fde74cbcb52e788ac');
  });

  it('refuses other networks and malformed addresses', () => {
    expect(() => addressToLockingBytecode('bitcoincash:qz3zugr6rdmx8xy0ykqfu6r0me6vhj6juuysc3qunc', 'bchtest')).toThrow(/not a bchtest address/);
    expect(() => addressToLockingBytecode('bchtest:qz3zugr6rdmx8xy0ykqfu6r0me6vhj6juuysc3qund', 'bchtest')).toThrow(/bad address/);
  });
});

describe('browser1 run files (taker part done in the XO debug tool)', () => {
  const load = (step: string) => deserializeInvitation(readFileSync(new URL(`../invitations/browser1-${step}.json`, import.meta.url), 'utf8'));
  const walletIdentifier = generateTemplateIdentifier(parseTemplate(p2pkhTemplate));

  it('names one Swap Intent template, kept in template/used, for the swap steps and the wallet template for the two transfers', () => {
    // The run used the template before the expire action was added; its exact JSON is kept under its identifier.
    const swapIdentifier = load('open').templateIdentifier;
    const used = readFileSync(new URL(`../template/used/${swapIdentifier}.json`, import.meta.url), 'utf8');
    expect(identifierOf(used)).toBe(swapIdentifier);
    expect((JSON.parse(used) as { name: string }).name).toBe('Swap Intent');
    for (const step of ['open', 'fill-start', 'fill-taken', 'fill']) expect(load(step).templateIdentifier, step).toBe(swapIdentifier);
    for (const step of ['fund-sats', 'fund-tokens']) expect(load(step).templateIdentifier, step).toBe(walletIdentifier);
  });

  it('the exported taker file carries the taker role and unlocking bytecode for two inputs, and the final file only adds the offer input', () => {
    const exported = load('fill-taken');
    const final = load('fill');
    expect(exported.commits.some((c) => c.data.roleIdentifier === 'taker')).toBe(true);
    const unlocked = exported.commits.flatMap((c) => c.data.inputs ?? []).filter((input) => input.unlockingBytecode !== undefined);
    expect(unlocked).toHaveLength(2);
    expect(final.commits.slice(0, exported.commits.length).map((c) => c.commitIdentifier)).toEqual(exported.commits.map((c) => c.commitIdentifier));
    expect(final.commits).toHaveLength(exported.commits.length + 1);
    const transactions = Object.values(final.result?.transactions ?? {});
    expect(transactions.some((t) => /^[0-9a-f]{64}$/.test(t.transactionHash) && 'broadcastedAtTimestamp' in t)).toBe(true);
  });
});
