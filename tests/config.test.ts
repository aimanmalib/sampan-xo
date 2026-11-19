import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const dirs: string[] = [];
const write = (value: unknown): string => {
  const dir = mkdtempSync(join(tmpdir(), 'swap-intent-config-'));
  dirs.push(dir);
  const path = join(dir, 'chipnet.json');
  writeFileSync(path, JSON.stringify(value));
  return path;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('config', () => {
  it('loads the shipped chipnet config', () => {
    const config = loadConfig();
    expect(config.network).toBe('chipnet');
    expect(config.addressPrefix).toBe('bchtest');
    expect(config.electrumServers.length).toBeGreaterThan(0);
  });

  it('rejects any network other than chipnet', () => {
    const base = loadConfig();
    expect(() => loadConfig(write({ ...base, network: 'mainnet' }))).toThrow(/only chipnet/);
    expect(() => loadConfig(write({ ...base, addressPrefix: 'bitcoincash' }))).toThrow(/only chipnet/);
  });

  it('rejects a malformed derivation path', () => {
    expect(() => loadConfig(write({ ...loadConfig(), fundingDerivationPath: '44/1/0' }))).toThrow(/fundingDerivationPath/);
  });
});

describe('test token config', () => {
  it('rejects a token amount that is not a positive decimal string', () => {
    const base = loadConfig();
    expect(() => loadConfig(write({ ...base, testToken: { ...base.testToken, tokenAmount: '0' } }))).toThrow(/tokenAmount/);
    expect(() => loadConfig(write({ ...base, testToken: { ...base.testToken, tokenAmount: 1.5 } }))).toThrow(/tokenAmount/);
  });

  it('accepts a null category or 64 hex characters, nothing else', () => {
    const base = loadConfig();
    const withCategory = (category: unknown) => write({ ...base, testToken: { ...base.testToken, category } });
    expect(loadConfig(withCategory(null)).testToken.category).toBeNull();
    expect(loadConfig(withCategory('ab'.repeat(32))).testToken.category).toBe('ab'.repeat(32));
    expect(() => loadConfig(withCategory('AB'.repeat(32)))).toThrow(/category/);
  });

  it('requires the swap run values', () => {
    const shipped = loadConfig();
    expect(shipped.swap.offeredSatoshis).toBeGreaterThan(0);
    expect(() => loadConfig(write({ ...shipped, swap: undefined }))).toThrow(/swap needs/);
    expect(() => loadConfig(write({ ...shipped, swap: { ...shipped.swap, wantedAmount: '-1' } }))).toThrow(/swap needs/);
  });
});

describe('swap expiry config', () => {
  it('rejects an expire age outside 1 to 65535 blocks and an expire fee outside 0 to 1000', () => {
    const base = loadConfig();
    for (const expireAfterBlocks of [0, 65536, 1.5]) {
      expect(() => loadConfig(write({ ...base, swap: { ...base.swap, expireAfterBlocks } }))).toThrow(/expireAfterBlocks/);
    }
    for (const expireFeeSatoshis of [-1, 1001, 0.5]) {
      expect(() => loadConfig(write({ ...base, swap: { ...base.swap, expireFeeSatoshis } }))).toThrow(/expireFeeSatoshis/);
    }
    expect(loadConfig(write({ ...base, swap: { ...base.swap, expireAfterBlocks: 1, expireFeeSatoshis: 0 } })).swap.expireFeeSatoshis).toBe(0);
  });
});

describe('landing config', () => {
  it('ships the landing values with a six block return age', () => {
    const { landing, accounts } = loadConfig();
    expect(accounts).toEqual(['maker', 'taker', 'owner']);
    expect(landing.returnAfter).toBe(6);
    expect(landing.giveBackFeeSatoshis).toBeLessThanOrEqual(1000);
    expect(landing.ownerAddress === null || landing.ownerAddress.startsWith('bchtest:')).toBe(true);
  });

  it('rejects missing or invalid landing values', () => {
    const base = loadConfig();
    const withLanding = (patch: Record<string, unknown>) => write({ ...base, landing: { ...base.landing, ...patch } });
    expect(() => loadConfig(write({ ...base, landing: undefined }))).toThrow(/landing section/);
    expect(() => loadConfig(withLanding({ rateDen: 0 }))).toThrow(/landing.rateDen/);
    expect(() => loadConfig(withLanding({ landedSatoshis: 1.5 }))).toThrow(/landing.landedSatoshis/);
    expect(() => loadConfig(withLanding({ returnAfter: 70000 }))).toThrow(/16 bits/);
    expect(() => loadConfig(withLanding({ giveBackFeeSatoshis: 1001 }))).toThrow(/0 to 1000/);
    expect(() => loadConfig(withLanding({ convertFeeSatoshis: 0 }))).toThrow(/landing.convertFeeSatoshis/);
    expect(() => loadConfig(withLanding({ ownerAddress: 'bitcoincash:qq' }))).toThrow(/ownerAddress/);
    expect(loadConfig(withLanding({ ownerAddress: null })).landing.ownerAddress).toBeNull();
  });
});
