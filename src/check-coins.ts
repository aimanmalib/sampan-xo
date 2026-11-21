import { binToHex, hexToBin, sha256 } from '@bitauth/libauth';
import type { CoinRecord } from './plain-coins.js';

/**
 * Read-only check behind scripts/check-coins.ts: does the engine's coin record mark every coin that Electrum reports
 * with token_data as a token coin? Chipnet only.
 */

export const checkCoinsUsage = 'usage: check-coins.ts <maker|taker|owner> (chipnet only, read only)';

/** Parses the arguments; any --network other than chipnet is refused. */
export const parseCheckCoinsArgs = (argv: readonly string[]): { account: 'maker' | 'taker' | 'owner' } => {
  const index = argv.findIndex((arg) => arg === '--network' || arg.startsWith('--network='));
  if (index >= 0) {
    const value = argv[index]!.includes('=') ? argv[index]!.split('=')[1] : argv[index + 1];
    if (value !== 'chipnet') throw new Error(`check-coins runs on chipnet only, got --network ${String(value)}`);
  }
  const account = argv.filter((arg, i) => !arg.startsWith('--') && !(index >= 0 && i === index + 1))[0];
  if (account !== 'maker' && account !== 'taker' && account !== 'owner') throw new Error(checkCoinsUsage);
  return { account };
};

/** Electrum script hash (sha256 of the locking bytecode, byte order reversed) of a locking bytecode in hex. */
export const electrumScriptHash = (lockingBytecodeHex: string): string => binToHex(sha256.hash(hexToBin(lockingBytecodeHex)).reverse());

export interface CoinComparison {
  electrumCoins: number;
  electrumTokenCoins: number;
  engineCoins: number;
  /** Outpoints Electrum reports that the engine record does not have. */
  missingInEngine: string[];
  /** Outpoints whose token fields differ between the two sources, with both values. */
  tokenMismatches: string[];
}

const outpoint = (coin: CoinRecord): string => `${coin.outpointTransactionHash}:${coin.outpointIndex}`;
const tokenFields = (coin: CoinRecord): string =>
  JSON.stringify([coin.tokenCategory ?? null, coin.tokenAmount ?? null, coin.tokenNftCapability ?? null]);

/** Compares the engine's coin records with Electrum's (already converted with coinFromElectrum), outpoint by outpoint. */
export const compareCoins = (engineCoins: readonly CoinRecord[], electrumCoins: readonly CoinRecord[]): CoinComparison => {
  const byOutpoint = new Map(engineCoins.map((coin) => [outpoint(coin), coin]));
  const missingInEngine: string[] = [];
  const tokenMismatches: string[] = [];
  for (const coin of electrumCoins) {
    const recorded = byOutpoint.get(outpoint(coin));
    if (recorded === undefined) missingInEngine.push(outpoint(coin));
    else if (tokenFields(recorded) !== tokenFields(coin)) tokenMismatches.push(`${outpoint(coin)} engine ${tokenFields(recorded)} electrum ${tokenFields(coin)}`);
  }
  return {
    electrumCoins: electrumCoins.length,
    electrumTokenCoins: electrumCoins.filter((coin) => coin.tokenCategory !== undefined).length,
    engineCoins: engineCoins.length,
    missingInEngine,
    tokenMismatches,
  };
};
