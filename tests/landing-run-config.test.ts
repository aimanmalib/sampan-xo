import { describe, expect, it } from 'vitest';
import { deriveFundingKey } from '../src/accounts.js';
import { loadConfig } from '../src/config.js';
import { paramsFromConfig } from '../src/landing-bytecode.js';
import { landingVariables } from '../src/landing-land.js';
import type { MainnetConfig } from '../src/landing-network.js';
import { loadRunConfig, mainnetRunConfig, networkAccount, runNamePattern } from '../src/landing-run-config.js';

// Standard BIP39 test vector phrase; it is public and holds nothing.
const testPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const chipnet = loadConfig();
const owner = deriveFundingKey(testPhrase, { fundingDerivationPath: "m/44'/145'/0'/0/0", addressPrefix: 'bitcoincash' });

const mainnet = (landing: Partial<MainnetConfig['landing']> = {}): MainnetConfig => ({
  network: 'mainnet',
  addressPrefix: 'bitcoincash',
  fundingDerivationPath: "m/44'/145'/0'/0/0",
  accounts: ['payer', 'owner'],
  electrumServers: [
    { host: 'one.example', port: 50004, transport: 'wss' },
    { host: 'two.example', port: 50004, transport: 'wss' },
  ],
  explorers: ['https://explorer.example/tx/'],
  engineDatabasePath: '.xo-test-mainnet',
  landing: {
    ownerAddress: owner.tokenAddress,
    landedSatoshis: 5000,
    giveBackFeeSatoshis: 1000,
    category: 'ab'.repeat(32),
    rateNum: 3,
    rateDen: 7,
    returnAfter: 6,
    ...landing,
  },
});

describe('Landing run config', () => {
  it('is the chipnet config unchanged on chipnet', () => {
    expect(loadRunConfig('chipnet')).toEqual(chipnet);
  });

  it('maps the mainnet config: its servers, engine folder, category and contract values, never chipnet ones', () => {
    const run = mainnetRunConfig(mainnet(), chipnet);
    expect(run.network).toBe('mainnet');
    expect(run.addressPrefix).toBe('bitcoincash');
    expect(run.electrumServers.map((s) => s.host)).toEqual(['one.example', 'two.example']);
    expect(run.explorers).toEqual(['https://explorer.example/tx/']);
    expect(run.swap.engineDatabasePath).toBe('.xo-test-mainnet');
    expect(run.testToken.category).toBe('ab'.repeat(32));
    expect(run.landing).toEqual({
      ownerAddress: owner.tokenAddress,
      landedSatoshis: 5000,
      giveBackFeeSatoshis: 1000,
      rateNum: 3,
      rateDen: 7,
      returnAfter: 6,
      convertFeeSatoshis: 0,
    });
    expect(run.faucets).toEqual([]);
    expect(run.accounts).toEqual([]);
  });

  it('commits on mainnet the same parameters check-bytecode compiles for that config', () => {
    const config = mainnet();
    const values = Object.fromEntries(landingVariables(mainnetRunConfig(config, chipnet)).map((v) => [v.variableIdentifier, v.value]));
    const params = paramsFromConfig(config.landing);
    expect(values).toEqual({
      landedSatoshis: 5000n,
      ownerLockingScript: params.ownerLockingScript,
      tokenCategory: params.category,
      rateNum: BigInt(params.rateNum),
      rateDen: BigInt(params.rateDen),
      returnAfter: BigInt(params.returnAfter),
    });
  });

  it('refuses a mainnet config with an unset contract value', () => {
    for (const key of ['ownerAddress', 'category', 'rateNum', 'rateDen', 'returnAfter'] as const) {
      expect(() => mainnetRunConfig(mainnet({ [key]: null }), chipnet), key).toThrow(/must all be set/);
    }
  });

  it('lets the payer stand in for maker on mainnet and has no converter there', () => {
    expect(networkAccount('maker', 'chipnet')).toBe('maker');
    expect(networkAccount('taker', 'chipnet')).toBe('taker');
    expect(networkAccount('maker', 'mainnet')).toBe('payer');
    expect(networkAccount('owner', 'mainnet')).toBe('owner');
    expect(() => networkAccount('taker', 'mainnet')).toThrow(/no taker account on mainnet/);
  });

  it('keeps run names apart: landing<n> on chipnet, mainnet<n> on mainnet', () => {
    expect(runNamePattern('chipnet').test('landing4')).toBe(true);
    expect(runNamePattern('chipnet').test('mainnet1')).toBe(false);
    expect(runNamePattern('mainnet').test('mainnet1')).toBe(true);
    expect(runNamePattern('mainnet').test('landing4')).toBe(false);
  });
});
