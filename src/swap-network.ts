import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { binToHex, decodeTransaction, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { loadConfig, type AccountName, type ChipnetConfig } from './config.js';
import { loadMainnetConfig, type MainnetAccountName, type MainnetConfig, type Network } from './landing-network.js';
import type { LandingRunConfig } from './landing-run-config.js';

/**
 * Network choice for the Swap Intent runs. Chipnet is the default and uses config/chipnet.json unchanged. Mainnet
 * exists for one minimum run (open, then expire back to the maker; cancel only as the safe way back) with the
 * values of config/mainnet-swap.json and the servers, explorers and engine folder of config/mainnet.json.
 */

/** Hard limits of the mainnet Swap Intent run, checked in code so that a config edit cannot raise them. */
export const mainnetSwapLimits = {
  minOfferedSatoshis: 546,
  maxOfferedSatoshis: 5000,
  minExpireAfterBlocks: 1,
  maxExpireAfterBlocks: 12,
  maxExpireFeeSatoshis: 1000,
} as const;

/** Steps allowed on mainnet. No fill: it needs real tokens, and no token is created on mainnet. */
export const mainnetSwapSteps = ['open', 'expire', 'cancel'] as const;

export interface MainnetSwapValues {
  offeredSatoshis: number;
  expireAfterBlocks: number;
  expireFeeSatoshis: number;
  /** Category the offer asks for. The offer is never filled on mainnet; it only has to be a valid category. */
  wantedCategory: string;
  /** Decimal string of token units the offer asks for. */
  wantedAmount: string;
}

export const mainnetSwapConfigPath = fileURLToPath(new URL('../config/mainnet-swap.json', import.meta.url));

const integerIn = (value: unknown, min: number, max: number): boolean => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Reads and checks config/mainnet-swap.json against mainnetSwapLimits. */
export const loadMainnetSwapValues = (path: string = mainnetSwapConfigPath): MainnetSwapValues => {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { network?: unknown; swap?: Partial<MainnetSwapValues> };
  if (raw.network !== 'mainnet' || raw.swap === undefined) throw new Error(`config ${path}: expected network mainnet and a swap section`);
  const s = raw.swap;
  const l = mainnetSwapLimits;
  if (!integerIn(s.offeredSatoshis, l.minOfferedSatoshis, l.maxOfferedSatoshis)) {
    throw new Error(`config ${path}: swap.offeredSatoshis must be from ${l.minOfferedSatoshis} to ${l.maxOfferedSatoshis}`);
  }
  if (!integerIn(s.expireAfterBlocks, l.minExpireAfterBlocks, l.maxExpireAfterBlocks)) {
    throw new Error(`config ${path}: swap.expireAfterBlocks must be from ${l.minExpireAfterBlocks} to ${l.maxExpireAfterBlocks}`);
  }
  if (!integerIn(s.expireFeeSatoshis, 1, l.maxExpireFeeSatoshis) || (s.expireFeeSatoshis as number) >= (s.offeredSatoshis as number)) {
    throw new Error(`config ${path}: swap.expireFeeSatoshis must be from 1 to ${l.maxExpireFeeSatoshis}, below swap.offeredSatoshis`);
  }
  if (!/^[0-9a-f]{64}$/.test(String(s.wantedCategory))) throw new Error(`config ${path}: swap.wantedCategory must be 64 lowercase hex characters`);
  if (!/^[1-9]\d*$/.test(String(s.wantedAmount))) throw new Error(`config ${path}: swap.wantedAmount must be a positive decimal string`);
  return s as MainnetSwapValues;
};

/**
 * Mainnet view of the Swap Intent settings, in the shape the chipnet code reads. Only the fee rate, dust limit and
 * engine stop timeout come from the chipnet config.
 */
export const mainnetSwapRunConfig = (main: MainnetConfig, values: MainnetSwapValues, chipnet: ChipnetConfig): LandingRunConfig => ({
  ...chipnet,
  network: 'mainnet',
  addressPrefix: main.addressPrefix,
  fundingDerivationPath: main.fundingDerivationPath,
  accounts: [],
  electrumServers: main.electrumServers,
  explorers: main.explorers,
  faucets: [],
  testToken: { ...chipnet.testToken, category: values.wantedCategory },
  swap: {
    ...chipnet.swap,
    engineDatabasePath: main.engineDatabasePath,
    offeredSatoshis: values.offeredSatoshis,
    wantedAmount: values.wantedAmount,
    expireAfterBlocks: values.expireAfterBlocks,
    expireFeeSatoshis: values.expireFeeSatoshis,
  },
});

/** Loads the Swap Intent settings of one network. */
export const loadSwapRunConfig = (network: Network): LandingRunConfig =>
  network === 'mainnet' ? mainnetSwapRunConfig(loadMainnetConfig(), loadMainnetSwapValues(), loadConfig()) : loadConfig();

/**
 * Throws unless the step and run name may be used on the network. On chipnet nothing changes; on mainnet only the
 * steps in mainnetSwapSteps, and run names swapmain<n>.
 */
export const checkSwapStep = (step: string, run: string, network: Network): void => {
  if (network === 'chipnet') return;
  if (!(mainnetSwapSteps as readonly string[]).includes(step)) {
    throw new Error(`step ${step} is not allowed on mainnet; only ${mainnetSwapSteps.join(', ')}`);
  }
  if (!/^swapmain\d+$/.test(run)) throw new Error(`mainnet Swap Intent run names are swapmain<n>, got ${run}`);
};

/** The account that plays a Swap Intent part on a network: on mainnet the payer is the maker, and there is no taker. */
export const swapAccount = (account: AccountName, network: Network): AccountName | MainnetAccountName => {
  if (network === 'chipnet') return account;
  if (account === 'maker') return 'payer';
  throw new Error(`there is no ${account} account in the mainnet Swap Intent run`);
};

/** One line per output of a serialized transaction: index, satoshis, address (or bytecode), token if any. */
export const describeOutputs = (serializedTransaction: string, prefix: 'bchtest' | 'bitcoincash'): string[] => {
  const decoded = decodeTransaction(hexToBin(serializedTransaction));
  if (typeof decoded === 'string') throw new Error(decoded);
  return decoded.outputs.map((output, index) => {
    const address = lockingBytecodeToCashAddress({ bytecode: output.lockingBytecode, prefix, tokenSupport: output.token !== undefined });
    const where = typeof address === 'string' ? 'a script with no address' : address.address;
    const token = output.token === undefined ? '' : ` token ${binToHex(output.token.category)}`;
    return `output ${index}: ${output.valueSatoshis} sat to ${where} (bytecode ${binToHex(output.lockingBytecode)})${token}`;
  });
};
