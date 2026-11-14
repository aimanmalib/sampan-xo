import { createVirtualMachineBch2026, decodeTransactionBch, hexToBin, type Output } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { deriveFundingKey } from '../src/accounts.js';
import { loadConfig } from '../src/config.js';
import { buildSpend, type Utxo } from '../src/spend.js';
import { planFund, planMint, type TestTokenSettings } from '../src/test-token.js';

// Public BIP39 test phrases; they hold nothing on any network.
const config = loadConfig();
const maker = deriveFundingKey('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', config);
const taker = deriveFundingKey('legal winner thank year wave sausage worth useful legal winner thank yellow', config);

// Frozen settings: the tests check the transaction shape, not the values in config/chipnet.json.
const settings: TestTokenSettings = {
  feeRateSatoshisPerByte: 1,
  dustSatoshis: 546,
  takerFundingSatoshis: 100_000,
  tokenOutputSatoshis: 1_000,
  tokenAmount: '1000000',
};

const coin = (byte: string, vout: number, satoshis: bigint, token?: Utxo['token']): Utxo => ({
  txid: byte.repeat(32),
  vout,
  satoshis,
  ...(token ? { token } : {}),
});

/** Verifies a signed transaction in the BCH 2026 VM with standard rules; each input is a maker P2PKH coin. */
const verify = (hex: string, spent: Utxo[]): string | true => {
  const transaction = decodeTransactionBch(hexToBin(hex));
  if (typeof transaction === 'string') return transaction;
  const sourceOutputs: Output[] = spent.map((u) => ({ lockingBytecode: maker.lockingBytecode, valueSatoshis: u.satoshis }));
  return createVirtualMachineBch2026(true).verify({ sourceOutputs, transaction });
};

describe('fund', () => {
  it('pays the taker, puts the maker change at output 0, and passes the VM', () => {
    const utxos = [coin('aa', 1, 500_000n), coin('bb', 0, 20_000n)];
    const fund = planFund(maker, taker, utxos, settings);
    expect(verify(fund.hex, utxos)).toBe(true);
    expect(fund.outputs[0]?.lockingBytecode).toEqual(maker.lockingBytecode);
    expect(fund.outputs[1]).toEqual({ lockingBytecode: taker.lockingBytecode, valueSatoshis: 100_000n });
    expect(fund.feeSatoshis).toBe(BigInt(fund.hex.length / 2));
    expect(fund.changeSatoshis + fund.feeSatoshis + 100_000n).toBe(520_000n);
  });

  it('never spends a coin that carries tokens', () => {
    const utxos = [coin('aa', 0, 500_000n), coin('cc', 0, 1_000n, { category: 'dd'.repeat(32), amount: 5n })];
    const fund = planFund(maker, taker, utxos, settings);
    expect(verify(fund.hex, [utxos[0]!])).toBe(true);
    expect(decodeTransactionBch(hexToBin(fund.hex))).toMatchObject({ inputs: [{ outpointIndex: 0 }] });
  });

  it('refuses when the coins do not cover the payment and the fee', () => {
    expect(() => planFund(maker, taker, [coin('aa', 0, 100_500n)], settings)).toThrow(/not enough coins/);
    expect(() => planFund(maker, taker, [], settings)).toThrow(/no coins/);
  });
});

describe('mint', () => {
  it('creates the token from an output 0 coin, sends it to the taker, and passes the VM', () => {
    const seed = coin('ee', 0, 399_000n);
    const mint = planMint(maker, taker, [coin('aa', 1, 900_000n), seed], settings);
    expect(mint.category).toBe(seed.txid);
    expect(verify(mint.hex, [seed])).toBe(true);
    expect(mint.outputs[0]).toMatchObject({
      lockingBytecode: taker.lockingBytecode,
      valueSatoshis: 1_000n,
      token: { amount: 1_000_000n, category: hexToBin(seed.txid) },
    });
    expect(mint.outputs[1]?.lockingBytecode).toEqual(maker.lockingBytecode);
  });

  it('a genesis whose category is not the spent outpoint fails in the VM', () => {
    const seed = coin('ee', 0, 399_000n);
    const forged = buildSpend({
      privateKey: maker.privateKey,
      lockingBytecode: maker.lockingBytecode,
      inputs: [seed],
      outputs: [{ lockingBytecode: taker.lockingBytecode, valueSatoshis: 1_000n, token: { category: hexToBin('ef'.repeat(32)), amount: 5n } }],
      change: { lockingBytecode: maker.lockingBytecode, index: 1 },
      feeRateSatoshisPerByte: 1,
      dustSatoshis: 546,
    });
    expect(verify(forged.hex, [seed])).toMatch(/token/i);
  });

  it('needs a plain coin at output index 0', () => {
    expect(() => planMint(maker, taker, [coin('aa', 1, 500_000n)], settings)).toThrow(/output index 0/);
  });
});
