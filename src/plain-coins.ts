/**
 * Coin selection over the engine's spendable outputs. A coin that carries any token (fungible amount, NFT, or only a
 * category) is never spent as plain satoshis: an action that pays the fee with it and has no token output for it
 * would burn the token. One definition, used by open, fill and send.
 */

/** The fields of an engine unspent output (@xo-cash/state UnspentOutputData) that coin selection reads. */
export interface CoinRecord {
  outpointTransactionHash: string;
  outpointIndex: number;
  valueSatoshis: number;
  tokenCategory?: string;
  tokenAmount?: string;
  tokenNftCapability?: string;
  tokenNftCommitment?: string;
}

/** True when the coin holds satoshis only: no token category, no fungible amount, no NFT. */
export const isPlainCoin = (coin: CoinRecord): boolean =>
  coin.tokenCategory === undefined && coin.tokenAmount === undefined && coin.tokenNftCapability === undefined;

/** The coins without tokens, largest value first. */
export const plainCoins = <T extends CoinRecord>(coins: readonly T[]): T[] =>
  coins.filter(isPlainCoin).sort((a, b) => Number(b.valueSatoshis) - Number(a.valueSatoshis));

/** The largest coin without tokens; throws a clear error naming the wallet when there is none. */
export const largestPlainCoin = <T extends CoinRecord>(coins: readonly T[], wallet: string): T => {
  const coin = plainCoins(coins)[0];
  if (coin === undefined) throw new Error(`the ${wallet} has no spendable plain coin (coins holding tokens are never spent as satoshis)`);
  return coin;
};

/** The first coin holding at least `minimum` fungible tokens of `category`, or undefined. */
export const tokenCoin = <T extends CoinRecord>(coins: readonly T[], category: string, minimum: bigint): T | undefined =>
  coins.find((coin) => coin.tokenCategory === category && BigInt(coin.tokenAmount ?? '0') >= minimum);

/** One entry of Electrum blockchain.scripthash.listunspent with include_tokens. */
export interface ElectrumUnspentRecord {
  tx_hash: string;
  tx_pos: number;
  value: number;
  token_data?: { category: string; amount: string; nft?: { capability: string; commitment: string } };
}

/** Converts an Electrum record to the engine field names, so both sources can be compared coin by coin. */
export const coinFromElectrum = (record: ElectrumUnspentRecord): CoinRecord => {
  const token = record.token_data;
  return {
    outpointTransactionHash: record.tx_hash,
    outpointIndex: record.tx_pos,
    valueSatoshis: record.value,
    ...(token === undefined ? {} : { tokenCategory: token.category }),
    ...(token !== undefined && token.amount !== '0' ? { tokenAmount: token.amount } : {}),
    ...(token?.nft === undefined ? {} : { tokenNftCapability: token.nft.capability, tokenNftCommitment: token.nft.commitment }),
  };
};
