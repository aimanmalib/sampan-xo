import { hexToBin } from '@bitauth/libauth';
import type { FundingKey } from './accounts.js';
import { buildSpend, type SignedSpend, type Utxo } from './spend.js';

/** Values that shape the test token setup; they come from `config/chipnet.json`. */
export interface TestTokenSettings {
  feeRateSatoshisPerByte: number;
  dustSatoshis: number;
  takerFundingSatoshis: number;
  tokenOutputSatoshis: number;
  tokenAmount: string;
}

const plainCoins = (utxos: Utxo[]): Utxo[] => utxos.filter((utxo) => utxo.token === undefined);

/**
 * fund: the maker sends coins to the taker for fees. Every plain maker coin is spent; the maker change is placed at
 * output 0, so the fund transaction also prepares the outpoint that the token genesis needs.
 */
export const planFund = (maker: FundingKey, taker: FundingKey, makerUtxos: Utxo[], settings: TestTokenSettings): SignedSpend =>
  buildSpend({
    privateKey: maker.privateKey,
    lockingBytecode: maker.lockingBytecode,
    inputs: plainCoins(makerUtxos),
    outputs: [{ lockingBytecode: taker.lockingBytecode, valueSatoshis: BigInt(settings.takerFundingSatoshis) }],
    change: { lockingBytecode: maker.lockingBytecode, index: 0 },
    feeRateSatoshisPerByte: settings.feeRateSatoshisPerByte,
    dustSatoshis: settings.dustSatoshis,
  });

/**
 * mint: token genesis from a maker coin at output index 0. The new fungible test token goes to the taker at
 * output 0; the category is the txid of the spent coin. Change returns to the maker at output 1.
 */
export const planMint = (
  maker: FundingKey,
  taker: FundingKey,
  makerUtxos: Utxo[],
  settings: TestTokenSettings,
): SignedSpend & { category: string } => {
  const seed = plainCoins(makerUtxos)
    .filter((utxo) => utxo.vout === 0)
    .sort((a, b) => (a.satoshis > b.satoshis ? -1 : 1))[0];
  if (!seed) throw new Error('no plain maker coin at output index 0; run fund first');
  const category = seed.txid;
  const spend = buildSpend({
    privateKey: maker.privateKey,
    lockingBytecode: maker.lockingBytecode,
    inputs: [seed],
    outputs: [
      {
        lockingBytecode: taker.lockingBytecode,
        valueSatoshis: BigInt(settings.tokenOutputSatoshis),
        token: { category: hexToBin(category), amount: BigInt(settings.tokenAmount) },
      },
    ],
    change: { lockingBytecode: maker.lockingBytecode, index: 1 },
    feeRateSatoshisPerByte: settings.feeRateSatoshisPerByte,
    dustSatoshis: settings.dustSatoshis,
  });
  return { ...spend, category };
};
