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
