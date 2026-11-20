import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { loadMainnetConfig } from '../src/landing-network.js';
import { buildRunsTable, checkRunsSources } from '../src/runs-table.js';
import {
  checkSwapStep,
  describeOutputs,
  loadMainnetSwapValues,
  loadSwapRunConfig,
  mainnetSwapConfigPath,
  mainnetSwapLimits,
  swapAccount,
} from '../src/swap-network.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const committed = JSON.parse(readFileSync(mainnetSwapConfigPath, 'utf8')) as { network: string; swap: Record<string, unknown> };
const dirs: string[] = [];
const temporary = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'swap-network-'));
  dirs.push(dir);
  return dir;
};
/** A copy of the committed config/mainnet-swap.json with some swap values replaced. */
const withSwap = (swap: Record<string, unknown>): string => {
  const path = join(temporary(), 'mainnet-swap.json');
  writeFileSync(path, JSON.stringify({ ...committed, swap: { ...committed.swap, ...swap } }));
  return path;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('mainnet Swap Intent limits', () => {
  it('loads the committed config inside the limits', () => {
    const values = loadMainnetSwapValues();
    expect(values.offeredSatoshis).toBeGreaterThanOrEqual(mainnetSwapLimits.minOfferedSatoshis);
    expect(values.offeredSatoshis).toBeLessThanOrEqual(mainnetSwapLimits.maxOfferedSatoshis);
    expect(values.expireFeeSatoshis).toBeLessThanOrEqual(mainnetSwapLimits.maxExpireFeeSatoshis);
    expect(values.expireAfterBlocks).toBeLessThanOrEqual(mainnetSwapLimits.maxExpireAfterBlocks);
  });

  it('rejects offeredSatoshis outside 546 to 5000', () => {
    expect(() => loadMainnetSwapValues(withSwap({ offeredSatoshis: 5001 }))).toThrow(/offeredSatoshis must be from 546 to 5000/);
    expect(() => loadMainnetSwapValues(withSwap({ offeredSatoshis: 545 }))).toThrow(/offeredSatoshis/);
    expect(() => loadMainnetSwapValues(withSwap({ offeredSatoshis: 20000 }))).toThrow(/offeredSatoshis/);
  });

  it('rejects an expire fee above 1000 or not below the offer, and an expiry outside 1 to 12 blocks', () => {
    expect(() => loadMainnetSwapValues(withSwap({ expireFeeSatoshis: 1001 }))).toThrow(/expireFeeSatoshis/);
    expect(() => loadMainnetSwapValues(withSwap({ expireFeeSatoshis: 0 }))).toThrow(/expireFeeSatoshis/);
    expect(() => loadMainnetSwapValues(withSwap({ offeredSatoshis: 600, expireFeeSatoshis: 600 }))).toThrow(/below swap.offeredSatoshis/);
    expect(() => loadMainnetSwapValues(withSwap({ expireAfterBlocks: 0 }))).toThrow(/expireAfterBlocks must be from 1 to 12/);
    expect(() => loadMainnetSwapValues(withSwap({ expireAfterBlocks: 13 }))).toThrow(/expireAfterBlocks/);
  });

  it('rejects a config for another network', () => {
    const path = join(temporary(), 'mainnet-swap.json');
    writeFileSync(path, JSON.stringify({ ...committed, network: 'chipnet' }));
    expect(() => loadMainnetSwapValues(path)).toThrow(/expected network mainnet/);
  });
});

describe('mainnet Swap Intent steps', () => {
  it('rejects fill and its parts on mainnet', () => {
    for (const step of ['fill', 'fill-start', 'fill-take', 'fill-finish', 'expire-early']) {
      expect(() => checkSwapStep(step, 'swapmain1', 'mainnet')).toThrow(/not allowed on mainnet/);
    }
    expect(() => swapAccount('taker', 'mainnet')).toThrow(/no taker account/);
  });

  it('rejects a mainnet run name other than swapmain<n>', () => {
    for (const run of ['run1', 'mainnet1', 'swapmain', 'swapmain1x', 'landing2']) {
      expect(() => checkSwapStep('open', run, 'mainnet')).toThrow(/swapmain<n>/);
    }
    for (const step of ['open', 'expire', 'cancel']) expect(() => checkSwapStep(step, 'swapmain1', 'mainnet')).not.toThrow();
    expect(swapAccount('maker', 'mainnet')).toBe('payer');
  });

  it('leaves the chipnet default unchanged', () => {
    expect(loadSwapRunConfig('chipnet')).toEqual(loadConfig());
    expect(() => checkSwapStep('fill', 'run5', 'chipnet')).not.toThrow();
    expect(swapAccount('taker', 'chipnet')).toBe('taker');
  });

  it('maps mainnet values from config/mainnet-swap.json and servers from config/mainnet.json', () => {
    const config = loadSwapRunConfig('mainnet');
    const main = loadMainnetConfig();
    const values = loadMainnetSwapValues();
    expect(config.network).toBe('mainnet');
    expect(config.addressPrefix).toBe('bitcoincash');
    expect(config.electrumServers).toEqual(main.electrumServers);
    expect(config.swap.engineDatabasePath).toBe(main.engineDatabasePath);
    expect(config.swap.offeredSatoshis).toBe(values.offeredSatoshis);
    expect(config.swap.expireFeeSatoshis).toBe(values.expireFeeSatoshis);
    expect(config.testToken.category).toBe(values.wantedCategory);
  });

  it('refuses fill on mainnet from the command line before any engine starts', () => {
    const child = spawnSync(process.execPath, ['--import', 'tsx', join(repo, 'scripts', 'run.ts'), 'fill-start', 'swapmain1', '--network', 'mainnet'], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
    });
    expect(child.status).toBe(2);
    expect(child.stderr).toMatch(/not allowed on mainnet/);
  }, 90_000);
});

describe('dry run outputs', () => {
  it('prints value and address of each output', () => {
    // Version 2, no inputs, one output of 2000 sat to a P2PKH script of twenty zero bytes, lock time 0.
    const p2pkh = `76a914${'00'.repeat(20)}88ac`;
    const tx = `02000000` + `00` + `01` + `d007000000000000` + `19` + p2pkh + `00000000`;
    const [line] = describeOutputs(tx, 'bitcoincash');
    expect(line).toMatch(/^output 0: 2000 sat to bitcoincash:q/);
    expect(line).toContain(p2pkh);
  });
});

describe('runs table sources', () => {
  it('reads docs/MAINNET-SWAP-RUNS.md as a third runs list', () => {
    const sources = loadConfig().runsTable.sources;
    expect(() => checkRunsSources(sources)).not.toThrow();
    expect(() => checkRunsSources(sources.filter((s) => s.runs !== 'docs/MAINNET-SWAP-RUNS.md'))).toThrow(/MAINNET-SWAP-RUNS/);
    const root = temporary();
    mkdirSync(join(root, 'docs'));
    mkdirSync(join(root, 'invitations'));
    mkdirSync(join(root, 'template', 'used'), { recursive: true });
    const id = 'e'.repeat(64);
    writeFileSync(join(root, 'invitations', 'swapmain1-open.json'), JSON.stringify({ templateIdentifier: id }));
    writeFileSync(join(root, 'template', 'used', `${id}.json`), '{}');
    const txid = 'f'.repeat(64);
    writeFileSync(join(root, 'docs', 'MAINNET-SWAP-RUNS.md'), `| 2026-11-20 01:00 | swapmain1 | open | ${txid} | invitations/swapmain1-open.json | ok |\n`);
    const table = buildRunsTable(root, sources);
    expect(table).toContain(`| mainnet | swapmain1 | open | [${txid}](https://blockchair.com/bitcoin-cash/transaction/${txid})`);
  });
});
