/**
 * Moves every coin of one account's funding address (test coins and test tokens) into its XO engine wallet.
 *
 *   npx tsx scripts/deposit.ts maker|taker [--dry-run]
 *   npx tsx scripts/deposit.ts payer --network mainnet [--dry-run]   the mainnet payer, for the one Landing run
 *
 * The engine derives its own keys, so coins at the funding address are invisible to it until moved.
 */
import { fileURLToPath } from 'node:url';
import { hexToBin } from '@bitauth/libauth';
import { deriveFundingKey } from '../src/accounts.js';
import { planDeposit } from '../src/deposit.js';
import { broadcastEverywhere, connectChipnet, listUnspent } from '../src/electrum.js';
import { readMnemonic } from '../src/env.js';
import { parseNetworkArg, withoutNetworkArg } from '../src/landing-network.js';
import { loadRunConfig } from '../src/landing-run-config.js';
import { lockingBytecodeToAddress, startAccountEngine, stopAccountEngine } from '../src/xo-engine.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const network = parseNetworkArg(process.argv.slice(2));
const config = loadRunConfig(network);
const [account, flag] = withoutNetworkArg(process.argv.slice(2));
const allowed = network === 'mainnet' ? ['payer'] : ['maker', 'taker'];
if (account === undefined || !allowed.includes(account) || (flag !== undefined && flag !== '--dry-run')) {
  console.error('usage: deposit.ts maker|taker [--dry-run]  or  deposit.ts payer --network mainnet [--dry-run]');
  process.exit(2);
}
const accountName = account as 'maker' | 'taker' | 'payer';
const mnemonic = readMnemonic(accountName, envPath, network);
const from = deriveFundingKey(mnemonic, config);

const started = await startAccountEngine(accountName, mnemonic, config);
let engineLockingBytecode: string;
try {
  engineLockingBytecode = await started.engine.generateLockingBytecodeFromDefaultPolicy('receive');
} finally {
  await stopAccountEngine(started, config);
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
process.exit(0);
