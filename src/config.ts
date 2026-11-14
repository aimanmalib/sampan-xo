import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type AccountName = 'maker' | 'taker';

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
  return raw as ChipnetConfig;
};
