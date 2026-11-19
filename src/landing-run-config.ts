import type { AccountName, ChipnetConfig } from './config.js';
import { loadConfig } from './config.js';
import { loadMainnetConfig, type MainnetAccountName, type MainnetConfig, type Network } from './landing-network.js';

/**
 * The settings the Landing scripts read, for either network. A ChipnetConfig is one as it is; the mainnet config is
 * mapped onto the same shape by mainnetRunConfig, so the land and giveBack code is the same on both networks.
 */
export type LandingRunConfig = Omit<ChipnetConfig, 'network' | 'addressPrefix'> & {
  network: Network;
  addressPrefix: 'bchtest' | 'bitcoincash';
};

/**
 * Mainnet view of the Landing settings. Contract values, servers, explorers and the engine folder come from
 * config/mainnet.json; only the fee rate, dust limit and engine stop timeout are taken from the chipnet config.
 * There is no convert on mainnet, so the convert fee is set to 0 and the swap values are never used.
 */
export const mainnetRunConfig = (main: MainnetConfig, chipnet: ChipnetConfig): LandingRunConfig => {
  const { ownerAddress, landedSatoshis, giveBackFeeSatoshis, category, rateNum, rateDen, returnAfter } = main.landing;
  if (ownerAddress === null || category === null || rateNum === null || rateDen === null || returnAfter === null) {
    throw new Error('config/mainnet.json: landing.ownerAddress, category, rateNum, rateDen and returnAfter must all be set');
  }
  return {
    ...chipnet,
    network: 'mainnet',
    addressPrefix: main.addressPrefix,
    fundingDerivationPath: main.fundingDerivationPath,
    accounts: [],
    electrumServers: main.electrumServers,
    explorers: main.explorers,
    faucets: [],
    testToken: { ...chipnet.testToken, category },
    swap: { ...chipnet.swap, engineDatabasePath: main.engineDatabasePath },
    landing: { ownerAddress, landedSatoshis, giveBackFeeSatoshis, rateNum, rateDen, returnAfter, convertFeeSatoshis: 0 },
  };
};

/** Loads the Landing settings of one network. */
export const loadRunConfig = (network: Network): LandingRunConfig =>
  network === 'mainnet' ? mainnetRunConfig(loadMainnetConfig(), loadConfig()) : loadConfig();

/** The account that plays a chipnet account's part on a network: on mainnet the payer stands in for maker. */
export const networkAccount = (account: AccountName, network: Network): AccountName | MainnetAccountName => {
  if (network === 'chipnet') return account;
  if (account === 'maker') return 'payer';
  if (account === 'owner') return 'owner';
  throw new Error(`there is no ${account} account on mainnet: the mainnet run is land then giveBack only`);
};

/** Run names: landing<n> on chipnet, mainnet<n> on mainnet. */
export const runNamePattern = (network: Network): RegExp => (network === 'mainnet' ? /^mainnet\d+$/ : /^landing\d+$/);
