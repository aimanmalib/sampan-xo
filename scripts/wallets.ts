/**
 * Chipnet test wallets for the maker and taker accounts.
 *
 *   npx tsx scripts/wallets.ts generate   create .env (mode 0600) with two new phrases; prints addresses only
 *   npx tsx scripts/wallets.ts addresses  print the funding address of each account
 *   npx tsx scripts/wallets.ts balance    print the chipnet balance of each funding address
 *
 * Phrases are never printed.
 */
import { generateBip39Mnemonic } from '@bitauth/libauth';
import { fileURLToPath } from 'node:url';
import { deriveFundingKey } from '../src/accounts.js';
import { loadConfig } from '../src/config.js';
import { connectChipnet, getBalance } from '../src/electrum.js';
import { mnemonicVariable, readMnemonic, writeNewEnvFile } from '../src/env.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const config = loadConfig();
const command = process.argv[2] ?? 'addresses';

const addresses = () =>
  config.accounts.map((account) => ({ account, ...deriveFundingKey(readMnemonic(account, envPath), config) }));

if (command === 'generate') {
  writeNewEnvFile(envPath, Object.fromEntries(config.accounts.map((a) => [mnemonicVariable(a), generateBip39Mnemonic()])));
  console.log('wrote .env (0600)');
}
if (command === 'generate' || command === 'addresses') {
  for (const { account, address, tokenAddress } of addresses()) console.log(`${account}\t${address}\t${tokenAddress}`);
} else if (command === 'balance') {
  const client = await connectChipnet(config);
  try {
    for (const { account, address } of addresses()) {
      const { confirmed, unconfirmed } = await getBalance(client, address);
      console.log(`${account}\t${address}\tconfirmed=${confirmed}\tunconfirmed=${unconfirmed}`);
    }
  } finally {
    await client.disconnect();
  }
} else if (command !== 'generate') {
  console.error(`unknown command: ${command} (generate | addresses | balance)`);
  process.exit(2);
}
