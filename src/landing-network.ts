import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ElectrumServerConfig } from './config.js';

/**
 * Network choice for the Landing scripts. Chipnet is the default and uses config/chipnet.json unchanged.
 * Mainnet exists for one minimum Landing run (land, then giveBack) and uses config/mainnet.json.
 */
export type Network = 'chipnet' | 'mainnet';

/** Mainnet accounts: payer funds the landing address, owner only receives. No converter on mainnet. */
export type MainnetAccountName = 'payer' | 'owner';

/** Hard limits of the mainnet run, checked on load so that a config edit cannot raise them by mistake. */
export const mainnetLimits = { maxLandedSatoshis: 20_000, minLandedSatoshis: 546, maxGiveBackFeeSatoshis: 1000 } as const;

export interface MainnetLandingConfig {
  /** Token-aware mainnet address of the owner account, the only place returned coins may go. Null until generated. */
  ownerAddress: string | null;
  landedSatoshis: number;
  giveBackFeeSatoshis: number;
  /** Contract parameters read from the deployed Sampan landing contract; null until that fixture exists. */
  tokenCategory: string | null;
  rateNum: number | null;
  rateDen: number | null;
  returnAfter: number | null;
}

export interface MainnetConfig {
  network: 'mainnet';
  addressPrefix: 'bitcoincash';
  fundingDerivationPath: string;
  accounts: MainnetAccountName[];
  electrumServers: ElectrumServerConfig[];
  explorers: string[];
  /** Folder for the mainnet XO engine databases, kept apart from the chipnet ones. */
  engineDatabasePath: string;
  landing: MainnetLandingConfig;
}

export const configPathFor = (network: Network): string =>
  fileURLToPath(new URL(`../config/${network}.json`, import.meta.url));

/** Reads `--network <name>` or `--network=<name>` from script arguments. Default chipnet; anything else is an error. */
export const parseNetworkArg = (argv: readonly string[]): Network => {
  const index = argv.findIndex((arg) => arg === '--network' || arg.startsWith('--network='));
  if (index < 0) return 'chipnet';
  const arg = argv[index] ?? '';
  const value = arg.includes('=') ? arg.split('=')[1] : argv[index + 1];
  if (value !== 'chipnet' && value !== 'mainnet') throw new Error(`--network must be chipnet or mainnet, got ${String(value)}`);
  return value;
};

/** Removes `--network <name>` so the remaining arguments keep their positions. */
export const withoutNetworkArg = (argv: readonly string[]): string[] => {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--network') i += 1;
    else if (!arg.startsWith('--network=')) out.push(arg);
  }
  return out;
};

const optionalPositive = (value: unknown): boolean => value === null || (Number.isSafeInteger(value) && (value as number) > 0);

/** Reads and checks config/mainnet.json, including the limits of the minimum run. */
export const loadMainnetConfig = (path: string = configPathFor('mainnet')): MainnetConfig => {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<MainnetConfig>;
  if (raw.network !== 'mainnet' || raw.addressPrefix !== 'bitcoincash') {
    throw new Error(`config ${path}: expected network mainnet with the bitcoincash prefix`);
  }
  if (typeof raw.fundingDerivationPath !== 'string' || !/^m(\/\d+'?)+$/.test(raw.fundingDerivationPath)) {
    throw new Error(`config ${path}: fundingDerivationPath must look like m/44'/145'/0'/0/0`);
  }
  const accounts = raw.accounts ?? [];
  if (accounts.length !== 2 || !accounts.includes('payer') || !accounts.includes('owner')) {
    throw new Error(`config ${path}: accounts must be payer and owner`);
  }
  if (!Array.isArray(raw.electrumServers) || raw.electrumServers.length < 2) {
    throw new Error(`config ${path}: electrumServers must list at least two mainnet servers`);
  }
  if (typeof raw.engineDatabasePath !== 'string' || raw.engineDatabasePath === '.xo') {
    throw new Error(`config ${path}: engineDatabasePath must be set and differ from the chipnet one`);
  }
  const l = raw.landing;
  if (!l) throw new Error(`config ${path}: landing section is missing`);
  if (l.ownerAddress !== null && !/^bitcoincash:[qpzr][0-9a-z]{41,}$/.test(String(l.ownerAddress))) {
    throw new Error(`config ${path}: landing.ownerAddress must be null or a bitcoincash address`);
  }
  const { maxLandedSatoshis, minLandedSatoshis, maxGiveBackFeeSatoshis } = mainnetLimits;
  if (!Number.isSafeInteger(l.landedSatoshis) || l.landedSatoshis! < minLandedSatoshis || l.landedSatoshis! > maxLandedSatoshis) {
    throw new Error(`config ${path}: landing.landedSatoshis must be from ${minLandedSatoshis} to ${maxLandedSatoshis}`);
  }
  const fee = l.giveBackFeeSatoshis;
  if (!Number.isSafeInteger(fee) || fee! <= 0 || fee! > maxGiveBackFeeSatoshis) {
    throw new Error(`config ${path}: landing.giveBackFeeSatoshis must be from 1 to ${maxGiveBackFeeSatoshis}`);
  }
  if (l.tokenCategory !== null && !/^[0-9a-f]{64}$/.test(String(l.tokenCategory))) {
    throw new Error(`config ${path}: landing.tokenCategory must be null or 64 lowercase hex characters`);
  }
  for (const key of ['rateNum', 'rateDen', 'returnAfter'] as const) {
    if (!optionalPositive(l[key])) throw new Error(`config ${path}: landing.${key} must be null or a positive integer`);
  }
  return raw as MainnetConfig;
};
