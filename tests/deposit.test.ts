import { binToHex, createVirtualMachineBch2026, decodeTransactionBch, hexToBin, type Output } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { deriveFundingKey } from '../src/accounts.js';
import { loadConfig } from '../src/config.js';
import { planDeposit } from '../src/deposit.js';
import type { Utxo } from '../src/spend.js';

// Public BIP39 test phrase; it holds nothing on any network.
const config = loadConfig();
const from = deriveFundingKey('legal winner thank year wave sausage worth useful legal winner thank yellow', config);
const engine = hexToBin('76a914' + '11'.repeat(20) + '88ac');
const settings = { feeRateSatoshisPerByte: 1, dustSatoshis: 546 };
const category = 'cd'.repeat(32);

const coins: Utxo[] = [
  { txid: 'aa'.repeat(32), vout: 1, satoshis: 100_000n },
  { txid: 'bb'.repeat(32), vout: 0, satoshis: 1_000n, token: { category, amount: 1_000_000n } },
];

/** VM check with the spent outputs as they are on chain, tokens included. */
const verify = (hex: string, spent: Utxo[]): string | true => {
  const transaction = decodeTransactionBch(hexToBin(hex));
  if (typeof transaction === 'string') return transaction;
  const sourceOutputs: Output[] = spent.map((u) => ({
    lockingBytecode: from.lockingBytecode,
    valueSatoshis: u.satoshis,
    ...(u.token ? { token: { category: hexToBin(u.token.category), amount: u.token.amount } } : {}),
  }));
  return createVirtualMachineBch2026(true).verify({ sourceOutputs, transaction });
};

describe('deposit', () => {
  it('moves plain and token coins to the engine wallet, keeps the tokens, and passes the VM', () => {
    const deposit = planDeposit(from, coins, engine, settings);
    expect(verify(deposit.hex, coins)).toBe(true);
    const transaction = decodeTransactionBch(hexToBin(deposit.hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    expect(transaction.outputs).toHaveLength(2);
    expect(transaction.outputs.every((o) => binToHex(o.lockingBytecode) === binToHex(engine))).toBe(true);
    expect(transaction.outputs[0]).toMatchObject({ valueSatoshis: 1_000n, token: { amount: 1_000_000n } });
    expect(binToHex(transaction.outputs[0]!.token!.category)).toBe(category);
    expect(deposit.changeSatoshis + deposit.feeSatoshis).toBe(100_000n);
  });

  it('refuses a spend that would burn tokens', () => {
    expect(() => planDeposit(from, coins, engine, settings)).not.toThrow();
    const nft: Utxo = { txid: 'cc'.repeat(32), vout: 0, satoshis: 1_000n, token: { category, amount: 0n, nft: {} } };
    expect(() => planDeposit(from, [coins[0]!, nft], engine, settings)).toThrow(/NFT/);
  });
});
