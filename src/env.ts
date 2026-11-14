import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { AccountName } from './config.js';

export const mnemonicVariable = (account: AccountName): string => `${account.toUpperCase()}_MNEMONIC`;

/** Parses KEY=VALUE lines. Comments and blank lines are skipped; surrounding quotes are removed. */
export const parseEnv = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
};

export const readEnvFile = (path: string): Record<string, string> =>
  existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};

/** Returns the mnemonic for one account, from the process environment first, then the .env file. */
export const readMnemonic = (account: AccountName, envPath: string): string => {
  const name = mnemonicVariable(account);
  const value = process.env[name] ?? readEnvFile(envPath)[name] ?? '';
  if (value === '') throw new Error(`${name} is not set (see .env.example)`);
  return value;
};

/** Writes a new .env readable by the owner only. Refuses to overwrite an existing file. */
export const writeNewEnvFile = (path: string, values: Record<string, string>): void => {
  if (existsSync(path)) throw new Error(`${path} already exists; refusing to overwrite wallet phrases`);
  const body = Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  writeFileSync(path, body, { mode: 0o600, flag: 'wx' });
  chmodSync(path, 0o600);
};
