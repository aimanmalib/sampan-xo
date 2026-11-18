import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveFundingKey } from '../src/accounts.js';
import { loadConfig } from '../src/config.js';
import { mnemonicVariable } from '../src/env.js';
import { configPathFor, loadMainnetConfig, mainnetLimits, parseNetworkArg, withoutNetworkArg } from '../src/landing-network.js';

// Standard BIP39 test vector phrase; it is public and holds nothing.
const testPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const dirs: string[] = [];
const write = (value: unknown): string => {
  const dir = mkdtempSync(join(tmpdir(), 'landing-network-'));
  dirs.push(dir);
  const path = join(dir, 'mainnet.json');
  writeFileSync(path, JSON.stringify(value));
  return path;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('--network argument', () => {
  it('defaults to chipnet and reads both spellings', () => {
    expect(parseNetworkArg(['land', '--run', 'landing3'])).toBe('chipnet');
    expect(parseNetworkArg(['land', '--network', 'mainnet'])).toBe('mainnet');
    expect(parseNetworkArg(['--network=chipnet', 'balance'])).toBe('chipnet');
  });

  it('rejects any other network or a missing value', () => {
    expect(() => parseNetworkArg(['--network', 'testnet4'])).toThrow(/chipnet or mainnet/);
    expect(() => parseNetworkArg(['--network'])).toThrow(/chipnet or mainnet/);
  });

  it('removes the flag and keeps the other arguments in order', () => {
    expect(withoutNetworkArg(['add', '--network', 'mainnet', '--dry-run'])).toEqual(['add', '--dry-run']);
    expect(withoutNetworkArg(['--network=mainnet', 'balance'])).toEqual(['balance']);
  });
});

describe('mainnet config', () => {
  const shipped = () => loadMainnetConfig();
  const withLanding = (patch: Record<string, unknown>) => write({ ...shipped(), landing: { ...shipped().landing, ...patch } });

  it('loads the shipped file within the limits of the minimum run', () => {
    const config = shipped();
    expect(config.network).toBe('mainnet');
    expect(config.accounts).toEqual(['payer', 'owner']);
    expect(config.electrumServers.length).toBeGreaterThanOrEqual(2);
    expect(config.engineDatabasePath).not.toBe(loadConfig().swap.engineDatabasePath);
    expect(config.landing.ownerAddress).toMatch(/^bitcoincash:z/);
    expect(config.landing.landedSatoshis).toBeLessThanOrEqual(mainnetLimits.maxLandedSatoshis);
    expect(config.landing.giveBackFeeSatoshis).toBeLessThanOrEqual(mainnetLimits.maxGiveBackFeeSatoshis);
  });

  it('rejects amounts above the limits', () => {
    expect(() => loadMainnetConfig(withLanding({ landedSatoshis: 20_001 }))).toThrow(/landedSatoshis/);
    expect(() => loadMainnetConfig(withLanding({ landedSatoshis: 545 }))).toThrow(/landedSatoshis/);
    expect(() => loadMainnetConfig(withLanding({ giveBackFeeSatoshis: 1001 }))).toThrow(/giveBackFeeSatoshis/);
    expect(() => loadMainnetConfig(withLanding({ giveBackFeeSatoshis: 0 }))).toThrow(/giveBackFeeSatoshis/);
  });

  it('rejects chipnet values, one server, the chipnet engine folder and bad contract parameters', () => {
    expect(() => loadMainnetConfig(write({ ...shipped(), network: 'chipnet' }))).toThrow(/mainnet/);
    expect(() => loadMainnetConfig(write({ ...shipped(), addressPrefix: 'bchtest' }))).toThrow(/bitcoincash prefix/);
    expect(() => loadMainnetConfig(write({ ...shipped(), electrumServers: shipped().electrumServers.slice(0, 1) }))).toThrow(/two/);
    expect(() => loadMainnetConfig(write({ ...shipped(), engineDatabasePath: '.xo' }))).toThrow(/engineDatabasePath/);
    expect(() => loadMainnetConfig(write({ ...shipped(), accounts: ['maker', 'owner'] }))).toThrow(/payer and owner/);
    expect(() => loadMainnetConfig(withLanding({ ownerAddress: 'bchtest:qq' }))).toThrow(/ownerAddress/);
    expect(() => loadMainnetConfig(withLanding({ category: 'AB'.repeat(32) }))).toThrow(/category/);
    expect(() => loadMainnetConfig(withLanding({ returnAfter: 0 }))).toThrow(/returnAfter/);
    expect(loadMainnetConfig(withLanding({ ownerAddress: null, rateNum: 3 })).landing.rateNum).toBe(3);
  });

  it('cannot be loaded as the chipnet config, and the chipnet config stays chipnet', () => {
    expect(() => loadConfig(configPathFor('mainnet'))).toThrow(/only chipnet/);
    expect(configPathFor('chipnet')).toMatch(/config[/\\]chipnet\.json$/);
    expect(loadConfig(configPathFor('chipnet')).network).toBe('chipnet');
  });
});

describe('mainnet accounts', () => {
  it('use MAINNET_ variable names and never the chipnet ones', () => {
    expect(mnemonicVariable('payer', 'mainnet')).toBe('MAINNET_PAYER_MNEMONIC');
    expect(mnemonicVariable('owner', 'mainnet')).toBe('MAINNET_OWNER_MNEMONIC');
    expect(mnemonicVariable('owner')).toBe('OWNER_MNEMONIC');
  });

  it('derive bitcoincash addresses on the mainnet path, different from the chipnet ones', () => {
    const mainnet = deriveFundingKey(testPhrase, loadMainnetConfig());
    const chipnet = deriveFundingKey(testPhrase, loadConfig());
    expect(mainnet.address).toMatch(/^bitcoincash:q[0-9a-z]{41}$/);
    expect(mainnet.tokenAddress).toMatch(/^bitcoincash:z[0-9a-z]{41}$/);
    expect(mainnet.lockingBytecode).not.toEqual(chipnet.lockingBytecode);
  });
});
