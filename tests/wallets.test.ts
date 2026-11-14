import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveFundingKey } from '../src/accounts.js';
import { loadConfig } from '../src/config.js';
import { mnemonicVariable, parseEnv, writeNewEnvFile } from '../src/env.js';

// Standard BIP39 test vector phrase; it is public and holds nothing.
const testPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'swap-intent-env-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('funding keys', () => {
  it('derives a chipnet P2PKH address and its token-aware form', () => {
    const key = deriveFundingKey(testPhrase, loadConfig());
    expect(key.address).toMatch(/^bchtest:q[0-9a-z]{41}$/);
    expect(key.tokenAddress).toMatch(/^bchtest:z[0-9a-z]{41}$/);
    expect(key.address.slice(9, 40)).toBe(key.tokenAddress.slice(9, 40));
    expect(key.lockingBytecode).toHaveLength(25);
  });

  it('gives different addresses to different phrases', () => {
    const other = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    expect(deriveFundingKey(testPhrase, loadConfig()).address).not.toBe(deriveFundingKey(other, loadConfig()).address);
  });
});

describe('.env handling', () => {
  it('parses names, quotes and comments', () => {
    expect(parseEnv('# c\nA=1\nB="two words"\n\nbad\n')).toEqual({ A: '1', B: 'two words' });
    expect(mnemonicVariable('maker')).toBe('MAKER_MNEMONIC');
  });

  it('writes a new file with owner-only permissions and refuses to overwrite it', () => {
    const path = join(tempDir(), '.env');
    writeNewEnvFile(path, { MAKER_MNEMONIC: testPhrase });
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(parseEnv(readFileSync(path, 'utf8')).MAKER_MNEMONIC).toBe(testPhrase);
    expect(() => writeNewEnvFile(path, { MAKER_MNEMONIC: 'x' })).toThrow(/refusing to overwrite/);
  });
});
