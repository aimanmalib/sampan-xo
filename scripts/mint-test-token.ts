/**
 * Chipnet test token setup, outside XO.
 *
 *   npx tsx scripts/mint-test-token.ts fund   maker sends testToken.takerFundingSatoshis to the taker for fees
 *   npx tsx scripts/mint-test-token.ts mint   maker creates the fungible test token and sends it to the taker
 *
 * Add --dry-run to print the transaction without broadcasting it. The transaction is sent to every configured
 * chipnet server, because a transaction known to one server only was seen to stay out of the others' mempools.
 * After mint, put the printed category into config/chipnet.json (testToken.category).
 */
import { fileURLToPath } from 'node:url';
import { deriveFundingKey } from '../src/accounts.js';
import { loadConfig } from '../src/config.js';
import { broadcastEverywhere, connectChipnet, listUnspent } from '../src/electrum.js';
import { readMnemonic } from '../src/env.js';
import { planFund, planMint } from '../src/test-token.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const config = loadConfig();
const [command, flag] = process.argv.slice(2);
if (command !== 'fund' && command !== 'mint') {
  console.error('usage: mint-test-token.ts fund|mint [--dry-run]');
  process.exit(2);
}
if (command === 'mint' && config.testToken.category !== null) {
  console.error(`test token already minted: ${config.testToken.category}`);
  process.exit(1);
}

const maker = deriveFundingKey(readMnemonic('maker', envPath), config);
const taker = deriveFundingKey(readMnemonic('taker', envPath), config);
const client = await connectChipnet(config);
let utxos;
try {
  utxos = await listUnspent(client, maker.address);
} finally {
  await client.disconnect();
}

const plan = command === 'fund' ? planFund(maker, taker, utxos, config.testToken) : planMint(maker, taker, utxos, config.testToken);
console.log(`${command} txid ${plan.txid} fee ${plan.feeSatoshis} change ${plan.changeSatoshis} size ${plan.hex.length / 2}`);
if ('category' in plan) console.log(`category ${plan.category}`);
if (flag === '--dry-run') process.exit(0);

for (const line of await broadcastEverywhere(config, plan.hex)) console.log(line);
