/**
 * Read-only chipnet check of the token filter used by coin selection: lists the account's coins as the XO engine
 * records them and as Electrum reports them (blockchain.scripthash.listunspent with include_tokens) for every script
 * the engine tracks, and prints the comparison. Broadcasts nothing. Chipnet only; --network mainnet is refused.
 *
 *   npx tsx scripts/check-coins.ts <maker|taker|owner>
 */
import { fileURLToPath } from 'node:url';
import { checkCoinsUsage, compareCoins, electrumScriptHash, parseCheckCoinsArgs } from '../src/check-coins.js';
import { loadConfig } from '../src/config.js';
import { connectChipnet } from '../src/electrum.js';
import { readMnemonic } from '../src/env.js';
import { coinFromElectrum, type CoinRecord, type ElectrumUnspentRecord } from '../src/plain-coins.js';
import { startAccountEngine, stopAccountEngine } from '../src/xo-engine.js';

if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  console.log(checkCoinsUsage);
  process.exit(0);
}
const { account } = parseCheckCoinsArgs(process.argv.slice(2));
const config = loadConfig();
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const started = await startAccountEngine(account, readMnemonic(account, envPath), config);
try {
  const engineCoins = await started.engine.listSpendableUnspentOutputs();
  const scripts = [...new Set((await started.engine.listScriptHashes()).map((s) => s.lockingBytecode))];
  const client = await connectChipnet(config);
  const electrumCoins: CoinRecord[] = [];
  try {
    for (const script of scripts) {
      const result = await client.request('blockchain.scripthash.listunspent', electrumScriptHash(script), 'include_tokens');
      if (result instanceof Error) throw result;
      electrumCoins.push(...(result as ElectrumUnspentRecord[]).map(coinFromElectrum));
    }
  } finally {
    await client.disconnect();
  }
  const comparison = compareCoins(engineCoins, electrumCoins);
  console.log(`${account} scripts=${scripts.length} spendable ${JSON.stringify(comparison)}`);
  const tracked = await started.engine.listUnspentOutputs();
  const all = compareCoins(tracked, electrumCoins);
  const statuses = tracked.map((c) => `${c.status}${c.selectable ? '' : ' unselectable'}${c.reservedBy === undefined ? '' : ' reserved'}`);
  const counts = Object.fromEntries([...new Set(statuses)].map((s) => [s, statuses.filter((x) => x === s).length]));
  console.log(`${account} all tracked ${JSON.stringify({ ...all, statuses: counts })}`);
  const tokenOnlyInElectrum = comparison.missingInEngine.filter((o) => electrumCoins.some((c) => `${c.outpointTransactionHash}:${c.outpointIndex}` === o && c.tokenCategory !== undefined));
  console.log(`${account} electrum token coins not in the spendable list: ${tokenOnlyInElectrum.length}`);
  console.log(comparison.tokenMismatches.length + all.tokenMismatches.length === 0 ? 'token fields match' : 'token fields differ');
} finally {
  await stopAccountEngine(started, config);
}
process.exit(0);
