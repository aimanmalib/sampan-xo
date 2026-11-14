/**
 * Moves every coin of one account's funding address (test coins and test tokens) into its XO engine wallet.
 *
 *   npx tsx scripts/deposit.ts maker|taker [--dry-run]
 *
 * The engine derives its own keys, so coins at the funding address are invisible to it until moved.
 */
import { fileURLToPath } from 'node:url';
import { hexToBin } from '@bitauth/libauth';
import { deriveFundingKey } from '../src/accounts.js';
import { loadConfig } from '../src/config.js';
import { planDeposit } from '../src/deposit.js';
import { broadcastEverywhere, connectChipnet, listUnspent } from '../src/electrum.js';
import { readMnemonic } from '../src/env.js';
import { lockingBytecodeToAddress, startAccountEngine } from '../src/xo-engine.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const config = loadConfig();
const [account, flag] = process.argv.slice(2);
if (account !== 'maker' && account !== 'taker') {
  console.error('usage: deposit.ts maker|taker [--dry-run]');
  process.exit(2);
}
const mnemonic = readMnemonic(account, envPath);
const from = deriveFundingKey(mnemonic, config);

const { engine } = await startAccountEngine(account, mnemonic, config);
let engineLockingBytecode: string;
try {
  engineLockingBytecode = await engine.generateLockingBytecodeFromDefaultPolicy('receive');
} finally {
  await engine.stop().catch((error: unknown) => console.error(`engine stop: ${String(error)}`));
}

const client = await connectChipnet(config);
let utxos;
try {
  utxos = await listUnspent(client, from.address);
} finally {
  await client.disconnect();
}

const plan = planDeposit(from, utxos, hexToBin(engineLockingBytecode), config.testToken);
console.log(`deposit ${account} to ${lockingBytecodeToAddress(engineLockingBytecode, config.addressPrefix)}`);
console.log(`txid ${plan.txid} inputs ${utxos.length} fee ${plan.feeSatoshis} change ${plan.changeSatoshis} size ${plan.hex.length / 2}`);
if (flag === '--dry-run') process.exit(0);
for (const line of await broadcastEverywhere(config, plan.hex)) console.log(line);
