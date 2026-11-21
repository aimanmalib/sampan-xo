import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { compareCoins, electrumScriptHash, parseCheckCoinsArgs } from '../src/check-coins.js';
import { coinFromElectrum, largestPlainCoin, plainCoins, tokenCoin, type CoinRecord } from '../src/plain-coins.js';
import { openOffer } from '../src/swap-open.js';
import type { AccountEngine } from '../src/xo-engine.js';

const category = 'ab'.repeat(32);
const otherCategory = 'cd'.repeat(32);
const coin = (id: string, valueSatoshis: number, token: Partial<CoinRecord> = {}): CoinRecord => ({
  outpointTransactionHash: id.repeat(64).slice(0, 64),
  outpointIndex: 0,
  valueSatoshis,
  ...token,
});

const plain = coin('1', 2_000);
const smallPlain = coin('2', 900);
const fungible = coin('3', 50_000, { tokenCategory: category, tokenAmount: '1000' });
const nftOnly = coin('4', 40_000, { tokenCategory: otherCategory, tokenNftCapability: 'none', tokenNftCommitment: '' });
const categoryOnly = coin('5', 30_000, { tokenCategory: otherCategory });

describe('plainCoins', () => {
  it('never picks a token coin as satoshis, even when it is worth more than every plain coin', () => {
    expect(plainCoins([fungible, smallPlain, plain])).toEqual([plain, smallPlain]);
    expect(largestPlainCoin([fungible, smallPlain, plain], 'test wallet')).toBe(plain);
  });

  it('skips an NFT coin with no fungible amount and a coin that only names a category', () => {
    expect(plainCoins([nftOnly, categoryOnly, smallPlain])).toEqual([smallPlain]);
    expect(plainCoins([coin('6', 70_000, { tokenAmount: '5' })])).toEqual([]);
  });

  it('throws a clear error, not a token coin, when there is no plain coin', () => {
    expect(() => largestPlainCoin([fungible, nftOnly], 'taker engine wallet')).toThrow(
      'the taker engine wallet has no spendable plain coin (coins holding tokens are never spent as satoshis)',
    );
  });
});

describe('tokenCoin', () => {
  it('picks a coin by category and minimum amount', () => {
    const coins = [plain, coin('7', 800, { tokenCategory: category, tokenAmount: '10' }), fungible, nftOnly];
    expect(tokenCoin(coins, category, 500n)).toBe(fungible);
    expect(tokenCoin(coins, category, 10n)?.outpointTransactionHash).toBe('7'.repeat(64));
    expect(tokenCoin(coins, category, 1001n)).toBeUndefined();
    expect(tokenCoin(coins, otherCategory, 1n)).toBeUndefined();
  });
});

describe('coinFromElectrum', () => {
  it('maps raw Electrum token_data to the engine field names', () => {
    const raw = [
      { tx_hash: 'aa'.repeat(32), tx_pos: 1, value: 1000, token_data: { category, amount: '250' } },
      { tx_hash: 'bb'.repeat(32), tx_pos: 0, value: 800, token_data: { category: otherCategory, amount: '0', nft: { capability: 'none', commitment: '01' } } },
      { tx_hash: 'cc'.repeat(32), tx_pos: 2, value: 5000 },
    ];
    expect(raw.map(coinFromElectrum)).toEqual([
      { outpointTransactionHash: 'aa'.repeat(32), outpointIndex: 1, valueSatoshis: 1000, tokenCategory: category, tokenAmount: '250' },
      {
        outpointTransactionHash: 'bb'.repeat(32),
        outpointIndex: 0,
        valueSatoshis: 800,
        tokenCategory: otherCategory,
        tokenNftCapability: 'none',
        tokenNftCommitment: '01',
      },
      { outpointTransactionHash: 'cc'.repeat(32), outpointIndex: 2, valueSatoshis: 5000 },
    ]);
    expect(plainCoins(raw.map(coinFromElectrum)).map((c) => c.outpointIndex)).toEqual([2]);
  });
});

describe('open coin selection', () => {
  it('funds the offer with the plain coin when a larger token coin is in the wallet', async () => {
    const appended: Array<Record<string, unknown>> = [];
    const stop = new Error('stop after coin selection');
    const account = {
      swapTemplateIdentifier: 't1',
      engine: {
        getTemplate: async () => ({ start: [{ action: 'open' }] }),
        createInvitation: async () => ({ invitation: { invitationIdentifier: 'i1' } }),
        generateLockingBytecodeFromDefaultPolicy: async () => '76a9',
        appendInvitation: async (_id: string, params: Record<string, unknown>) => void appended.push(params),
        listSpendableUnspentOutputs: async () => [fungible, plain, nftOnly],
        addChangeToInvitation: async () => {
          throw stop;
        },
        archiveInvitation: async () => undefined,
      },
    } as unknown as AccountEngine;
    await expect(openOffer(account, loadConfig(), false)).rejects.toBe(stop);
    const inputs = appended.flatMap((params) => (params.inputs as Array<{ outpointTransactionHash: Uint8Array }> | undefined) ?? []);
    expect(inputs.map((input) => Buffer.from(input.outpointTransactionHash).toString('hex'))).toEqual([plain.outpointTransactionHash]);
  });
});

describe('check-coins', () => {
  it('refuses any network other than chipnet and needs a known account', () => {
    expect(parseCheckCoinsArgs(['taker'])).toEqual({ account: 'taker' });
    expect(parseCheckCoinsArgs(['maker', '--network', 'chipnet'])).toEqual({ account: 'maker' });
    expect(() => parseCheckCoinsArgs(['maker', '--network', 'mainnet'])).toThrow('check-coins runs on chipnet only, got --network mainnet');
    expect(() => parseCheckCoinsArgs(['--network=mainnet', 'owner'])).toThrow(/chipnet only/);
    expect(() => parseCheckCoinsArgs(['payer'])).toThrow(/usage/);
  });

  it('reports a coin the engine records without its token as a mismatch', () => {
    const fromElectrum = [fungible, plain];
    expect(compareCoins([fungible, plain], fromElectrum)).toMatchObject({ electrumTokenCoins: 1, missingInEngine: [], tokenMismatches: [] });
    const unmarked = { ...fungible, tokenCategory: undefined, tokenAmount: undefined };
    expect(compareCoins([unmarked, plain], fromElectrum).tokenMismatches).toHaveLength(1);
    expect(compareCoins([plain], fromElectrum).missingInEngine).toEqual([`${fungible.outpointTransactionHash}:0`]);
  });

  it('computes the Electrum script hash of a locking bytecode', () => {
    // sha256 of the empty script, byte order reversed.
    expect(electrumScriptHash('')).toBe('55b852781b9995a44c939b64e441ae2724b96f99c8f4fb9a141cfc9842c4b0e3');
  });
});
