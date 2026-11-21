import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = fileURLToPath(new URL('..', import.meta.url));

/**
 * https://explorer.selene.cash/tx/<txid> opens the mainnet page, which shows "Data unavailable" for a chipnet
 * transaction. Every Selene transaction link must name the network explicitly.
 */
const documents = ['MIGRATE-TO-XO.md', 'README.md', 'docs/MAINNET-RUNS.md', 'docs/CHIPNET-RUNS.md', 'docs/debug-tool/README.md'];

const seleneTxLink = /https:\/\/explorer\.selene\.cash\/tx\/[0-9a-f]{64}[^\s)>|`]*/g;

/** Selene transaction links in `text` that do not end in `?network=chipnet`. */
const linksWithoutNetwork = (text: string): string[] =>
  [...text.matchAll(seleneTxLink)].map((match) => match[0]).filter((link) => !link.endsWith('?network=chipnet'));

describe('Selene explorer links', () => {
  it('flags a link without the network parameter and accepts one with it', () => {
    const txid = 'af2ba18fd27ca75c6fa5422a73bf602900be6019850efa3d57877e01eae0c9db';
    const bare = `[tx](https://explorer.selene.cash/tx/${txid})`;
    const chipnet = `[tx](https://explorer.selene.cash/tx/${txid}?network=chipnet)`;
    expect(linksWithoutNetwork(bare)).toEqual([`https://explorer.selene.cash/tx/${txid}`]);
    expect(linksWithoutNetwork(chipnet)).toEqual([]);
  });

  it.each(documents)('every Selene transaction link in %s opens chipnet', (file) => {
    const text = readFileSync(join(repo, file), 'utf8');
    expect(linksWithoutNetwork(text)).toEqual([]);
  });

  it('MIGRATE-TO-XO.md has Selene transaction links to check', () => {
    const text = readFileSync(join(repo, 'MIGRATE-TO-XO.md'), 'utf8');
    expect([...text.matchAll(seleneTxLink)].length).toBeGreaterThan(0);
  });
});
