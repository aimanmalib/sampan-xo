import { readdirSync, readFileSync } from 'node:fs';
import type { XOInvitation } from '@xo-cash/types';
import { deserializeInvitation } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { minimumTokenAmount, readLandingVariables, readLandTransactionHash, startConvert, takeConvert } from '../src/landing-convert.js';
import { landingVariableIdentifiers, landingVariables, ownerLockingScriptHex } from '../src/landing-land.js';
import { config, fakeAccount, hash, landInvitation, tokenCoin } from './support/landing-fake.js';

describe('landing run steps', () => {
  it('commits the six landing variables from the config, the owner as locking bytecode', () => {
    const variables = landingVariables(config);
    expect(variables.map((v) => v.variableIdentifier)).toEqual([...landingVariableIdentifiers]);
    expect(ownerLockingScriptHex(config)).toMatch(/^76a914[0-9a-f]{40}88ac$/);
    expect(() => ownerLockingScriptHex({ ...config, landing: { ...config.landing, ownerAddress: null } })).toThrow(/ownerAddress/);
  });

  it('reads the landing variables without role fields, in template order, and the land txid', () => {
    const read = readLandingVariables(landInvitation());
    expect(read).toEqual(landingVariables(config));
    expect(readLandTransactionHash(landInvitation())).toBe(hash);
    expect(() => readLandingVariables(landInvitation({ commits: [] }))).toThrow(/lacks landedSatoshis/);
    expect(() => readLandTransactionHash(landInvitation({ result: undefined }))).toThrow(/no recorded transaction/);
  });

  it('rounds the minimum token amount up, as the covenant does', () => {
    expect(minimumTokenAmount(10000n, 1n, 100n)).toBe(100n);
    expect(minimumTokenAmount(10001n, 1n, 100n)).toBe(101n);
    expect(minimumTokenAmount(7n, 3n, 2n)).toBe(11n);
  });

  it('starts convert with the landed coin of the land transaction at input 0', async () => {
    const landed = { outpointTransactionHash: hash, outpointIndex: 0, templateIdentifier: 'landing', valueSatoshis: 10000 };
    const { account, calls } = fakeAccount([{ ...landed, outpointIndex: 1, templateIdentifier: 'wallet' }, landed]);
    await startConvert(account, landInvitation());
    const inputs = calls.appended[0]!.inputs as { inputIdentifier: string; transactionIndex: number; outpointIndex: number }[];
    expect(inputs).toEqual([expect.objectContaining({ inputIdentifier: 'convertInput', transactionIndex: 0, outpointIndex: 0 })]);
    await expect(startConvert(fakeAccount([]).account, landInvitation())).rejects.toThrow(/no unspent landed coin/);
  });

  it('takes convert with one token coin at input 1, owner at output 0, payout at output 1, and no change', async () => {
    const { account, calls } = fakeAccount([tokenCoin('99', { outpointIndex: 1 }), tokenCoin('5', { tokenNftCapability: 'none' }), tokenCoin('998000')]);
    await takeConvert(account, {} as XOInvitation, config);
    expect(calls.accepted).toEqual([{ roleIdentifier: 'converter' }]);
    const appended = calls.appended[0]!;
    expect(appended.inputs).toEqual([expect.objectContaining({ transactionIndex: 1, outpointIndex: 2, roleIdentifier: 'converter' })]);
    expect(appended.outputs).toEqual([
      expect.objectContaining({ outputIdentifier: 'ownerTokenOutput', transactionIndex: 0 }),
      expect.objectContaining({ outputIdentifier: 'converterPayoutOutput', transactionIndex: 1 }),
    ]);
    const values = Object.fromEntries((appended.variables as { variableIdentifier: string; value: unknown }[]).map((v) => [v.variableIdentifier, v.value]));
    expect(values).toEqual({ converterLockingScript: '76a9', converterCoinSatoshis: 1000n, converterCoinTokens: 998000n, convertFeeSatoshis: BigInt(config.landing.convertFeeSatoshis) });
    expect(calls.signed).toEqual([1]);
    await expect(takeConvert(fakeAccount([tokenCoin('99')]).account, {} as XOInvitation, config)).rejects.toThrow(/no coin with 100/);
  });

  it('every saved landing invitation is valid; land and convert files record their broadcast', () => {
    const folder = new URL('../invitations/', import.meta.url);
    for (const name of readdirSync(folder).filter((file) => /^landing\d+-.*\.json$/.test(file))) {
      const parsed = deserializeInvitation(readFileSync(new URL(name, folder), 'utf8'));
      if (/-(land|convert|giveBack)\.json$/.test(name)) {
        const results = Object.values(parsed.result?.transactions ?? {});
        expect(results.some((r) => /^[0-9a-f]{64}$/.test(r.transactionHash) && 'broadcastedAtTimestamp' in r), name).toBe(true);
      }
    }
  });
});
