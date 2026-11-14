import { readdirSync, readFileSync } from 'node:fs';
import type { XOInvitation } from '@xo-cash/types';
import { deserializeInvitation } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { invitationPath } from '../src/invitation-file.js';
import { readOfferVariables, readOpenTransactionHash } from '../src/swap-fill.js';
import { finishAction } from '../src/swap-open.js';
import { stopAccountEngine, type AccountEngine } from '../src/xo-engine.js';

const hash = 'ab'.repeat(32);
const lateError = Object.assign(new Error('Unspent output "x:1" not found in store'), { name: 'UnspentOutputNotFoundInStoreError' });

const invitation = (extra: Partial<XOInvitation> = {}): XOInvitation =>
  ({
    invitationIdentifier: 'i1',
    templateIdentifier: 't1',
    actionIdentifier: 'open',
    createdAtTimestamp: 1,
    commits: [
      { data: { variables: [{ variableIdentifier: 'offeredSatoshis', value: 20000n, roleIdentifier: 'maker' }] } },
      {
        data: {
          variables: [
            { variableIdentifier: 'wantedCategory', value: 'cd'.repeat(32), roleIdentifier: 'maker' },
            { variableIdentifier: 'wantedAmount', value: 1000n, roleIdentifier: 'maker' },
            { variableIdentifier: 'makerLockingScript', value: '76a9', roleIdentifier: 'maker' },
            { variableIdentifier: 'other', value: 1n },
          ],
        },
      },
    ],
    ...extra,
  }) as unknown as XOInvitation;

const broadcastResult = { result: { transactions: { fillTransaction: { transactionHash: hash, broadcastedAtTimestamp: 2 } } } };

/** A stand-in engine with just the calls finishAction makes. */
const fakeAccount = (executeError: Error | undefined, stored: XOInvitation): AccountEngine =>
  ({
    engine: {
      listMissingRequirements: async () => ({ templateRequirements: {}, inputsMissingSignatures: [], participants: [] }),
      buildInvitationTransactionFromMergedCommit: async () => ({ transactionHash: hash, serializedTransaction: '00' }),
      executeAction: async () => {
        if (executeError) throw executeError;
      },
      getInvitation: async () => ({ invitation: stored }),
      archiveInvitation: async () => undefined,
    },
  }) as unknown as AccountEngine;

describe('fill inputs read from the open invitation', () => {
  it('takes the four offer variables without role or merge fields, in template order', () => {
    expect(readOfferVariables(invitation())).toEqual([
      { variableIdentifier: 'offeredSatoshis', value: 20000n },
      { variableIdentifier: 'wantedCategory', value: 'cd'.repeat(32) },
      { variableIdentifier: 'wantedAmount', value: 1000n },
      { variableIdentifier: 'makerLockingScript', value: '76a9' },
    ]);
  });

  it('refuses an open invitation without the variables or without a recorded transaction', () => {
    expect(() => readOfferVariables(invitation({ commits: [] }))).toThrow(/lacks offeredSatoshis/);
    expect(() => readOpenTransactionHash(invitation())).toThrow(/no recorded transaction/);
    const recorded = invitation({ result: { transactions: { openTransaction: { transactionHash: hash } } } } as never);
    expect(readOpenTransactionHash(recorded)).toBe(hash);
  });
});

describe('finishAction after a broadcast', () => {
  it('accepts the late reservation error when the broadcast was recorded', async () => {
    const result = await finishAction(fakeAccount(lateError, invitation(broadcastResult as never)), 'i1', true);
    expect(result.transactionHash).toBe(hash);
  });

  it('rethrows it when no broadcast was recorded, and rethrows other errors', async () => {
    await expect(finishAction(fakeAccount(lateError, invitation()), 'i1', true)).rejects.toThrow(/not found in store/);
    await expect(finishAction(fakeAccount(new Error('boom'), invitation(broadcastResult as never)), 'i1', true)).rejects.toThrow('boom');
  });
});

describe('engine stop', () => {
  it('returns after the configured timeout when Engine.stop never settles', async () => {
    const config = loadConfig();
    const never = { engine: { stop: () => new Promise(() => undefined) } } as unknown as AccountEngine;
    const started = Date.now();
    await stopAccountEngine(never, { ...config, swap: { ...config.swap, engineStopTimeoutSeconds: 0.05 } });
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('saved invitations', () => {
  it('names files <run>-<step>.json and rejects other names', () => {
    expect(invitationPath('run1', 'fill-start')).toMatch(/invitations\/run1-fill-start\.json$/);
    expect(() => invitationPath('../x', 'open')).toThrow(/bad run/);
  });

  it('every saved invitation is a valid XO invitation; every broadcast step file records its broadcast', () => {
    const folder = new URL('../invitations/', import.meta.url);
    const files = readdirSync(folder).filter((name) => name.endsWith('.json'));
    for (const name of files) {
      const parsed = deserializeInvitation(readFileSync(new URL(name, folder), 'utf8'));
      if (/-(open|fill|cancel)\.json$/.test(name)) {
        const results = Object.values(parsed.result?.transactions ?? {});
        expect(results.some((r) => /^[0-9a-f]{64}$/.test(r.transactionHash) && 'broadcastedAtTimestamp' in r), name).toBe(true);
      }
    }
  });
});
