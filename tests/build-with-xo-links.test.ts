import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = fileURLToPath(new URL('..', import.meta.url));

/**
 * A Selene transaction page without `?network=chipnet` opens mainnet and shows "Data unavailable" for a
 * chipnet transaction. This also holds for the `<txid>` pattern a reader is told to fill in.
 */
const seleneTx = /https:\/\/explorer\.selene\.cash\/tx\/(?:[0-9a-f]{64}|<txid>)[^\s)>|`]*/g;

const withoutNetwork = (text: string): string[] =>
  [...text.matchAll(seleneTx)].map((match) => match[0]).filter((link) => !link.endsWith('?network=chipnet'));

describe('Selene links in BUILD-WITH-XO.md', () => {
  it('flags the <txid> pattern without the network parameter', () => {
    expect(withoutNetwork('`https://explorer.selene.cash/tx/<txid>`')).toEqual(['https://explorer.selene.cash/tx/<txid>']);
    expect(withoutNetwork('`https://explorer.selene.cash/tx/<txid>?network=chipnet`')).toEqual([]);
  });

  it('every Selene transaction link or pattern opens chipnet', () => {
    const text = readFileSync(join(repo, 'BUILD-WITH-XO.md'), 'utf8');
    expect([...text.matchAll(seleneTx)].length).toBeGreaterThan(0);
    expect(withoutNetwork(text)).toEqual([]);
  });
});
