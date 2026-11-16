import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** maker and taker run the Swap Intent; for the Landing template maker pays, taker converts, owner only receives. */
export type AccountName = 'maker' | 'taker' | 'owner';

export interface ElectrumServerConfig {
  host: string;
  port: number;
  transport: 'wss' | 'ws' | 'tcp' | 'tcp_tls';
}

export interface ChipnetConfig {
  network: 'chipnet';
  addressPrefix: 'bchtest';
  fundingDerivationPath: string;
  accounts: AccountName[];
  electrumServers: ElectrumServerConfig[];
  explorers: string[];
  faucets: string[];
  minimumFundingSatoshis: number;
  testToken: TestTokenConfig;
  swap: SwapConfig;
  landing: LandingConfig;
}

/** Values of the chipnet Landing runs (the Sampan landing address ported to XO). The token is `testToken.category`. */
export interface LandingConfig {
  /** Token-aware chipnet address of the owner account, the only place landed coins may go. Null until generated. */
  ownerAddress: string | null;
  /** Satoshis the payer sends to the landing address in one `land` action. */
  landedSatoshis: number;
  /** Minimum token base units per rateDen satoshis, as in the original contract. */
  rateNum: number;
  rateDen: number;
  /** Relative age in blocks after which `giveBack` may return the BCH. */
  returnAfter: number;
  /** Satoshis kept as fee by `giveBack`; the contract allows at most 1000. */
  giveBackFeeSatoshis: number;
}

/** Values of the chipnet Swap Intent runs. */
export interface SwapConfig {
  /** Folder for the XO engine databases, relative to the repository root. One database per account. */
  engineDatabasePath: string;
  offeredSatoshis: number;
  /** Decimal string of test token units the maker asks for. */
  wantedAmount: string;
  /** Longest wait for Engine.stop() before a script exits anyway. */
  engineStopTimeoutSeconds: number;
}

/** The fungible test token used as the wanted token. Created outside XO by `scripts/mint-test-token.ts`. */
export interface TestTokenConfig {
  feeRateSatoshisPerByte: number;
  dustSatoshis: number;
  takerFundingSatoshis: number;
  tokenOutputSatoshis: number;
  /** Decimal string; token amounts can exceed the safe integer range. */
  tokenAmount: string;
  /** Category (display order hex) once minted on chipnet, else null. */
  category: string | null;
}

export const defaultConfigPath = fileURLToPath(new URL('../config/chipnet.json', import.meta.url));

/** Reads and checks the chipnet config. Any other network is rejected: this repository is chipnet only. */
export const loadConfig = (path: string = defaultConfigPath): ChipnetConfig => {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<ChipnetConfig>;
  if (raw.network !== 'chipnet' || raw.addressPrefix !== 'bchtest') {
    throw new Error(`config ${path}: only chipnet with the bchtest prefix is supported`);
  }
  if (typeof raw.fundingDerivationPath !== 'string' || !/^m(\/\d+'?)+$/.test(raw.fundingDerivationPath)) {
    throw new Error(`config ${path}: fundingDerivationPath must look like m/44'/1'/0'/0/0`);
  }
  if (!Array.isArray(raw.electrumServers) || raw.electrumServers.length === 0) {
    throw new Error(`config ${path}: electrumServers must list at least one chipnet server`);
  }
  const token = raw.testToken;
  if (!token || !/^[1-9]\d*$/.test(String(token.tokenAmount))) {
    throw new Error(`config ${path}: testToken.tokenAmount must be a positive decimal string`);
  }
  if (token.category !== null && !/^[0-9a-f]{64}$/.test(String(token.category))) {
    throw new Error(`config ${path}: testToken.category must be null or 64 lowercase hex characters`);
  }
  const swap = raw.swap;
  if (!swap || typeof swap.engineDatabasePath !== 'string' || !(swap.offeredSatoshis > 0) || !/^[1-9]\d*$/.test(String(swap.wantedAmount)) || !(swap.engineStopTimeoutSeconds > 0)) {
    throw new Error(`config ${path}: swap needs engineDatabasePath, a positive offeredSatoshis, a positive decimal wantedAmount and a positive engineStopTimeoutSeconds`);
  }
  checkLanding(raw.landing, path);
  return raw as ChipnetConfig;
};

const positiveInteger = (value: unknown): boolean => Number.isSafeInteger(value) && (value as number) > 0;

const checkLanding = (landing: Partial<LandingConfig> | undefined, path: string): void => {
  if (!landing) throw new Error(`config ${path}: landing section is missing`);
  if (landing.ownerAddress !== null && !/^bchtest:[qpzr][0-9a-z]{41,}$/.test(String(landing.ownerAddress))) {
    throw new Error(`config ${path}: landing.ownerAddress must be null or a bchtest address`);
  }
  for (const key of ['landedSatoshis', 'rateNum', 'rateDen', 'returnAfter'] as const) {
    if (!positiveInteger(landing[key])) throw new Error(`config ${path}: landing.${key} must be a positive integer`);
  }
  // BIP68 block-based relative locks carry the age in the low 16 bits of the sequence number.
  if ((landing.returnAfter as number) > 0xffff) throw new Error(`config ${path}: landing.returnAfter must fit in 16 bits`);
  const fee = landing.giveBackFeeSatoshis;
  if (!Number.isSafeInteger(fee) || (fee as number) < 0 || (fee as number) > 1000) {
    throw new Error(`config ${path}: landing.giveBackFeeSatoshis must be an integer from 0 to 1000`);
  }
  if ((fee as number) >= (landing.landedSatoshis as number)) {
    throw new Error(`config ${path}: landing.giveBackFeeSatoshis must be below landing.landedSatoshis`);
  }
};
