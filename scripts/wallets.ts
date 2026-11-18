/**
 * Chipnet test wallets for the accounts listed in config/chipnet.json (maker, taker, owner).
 *
 *   npx tsx scripts/wallets.ts generate   create .env (mode 0600) with a new phrase per account; prints addresses only
 *   npx tsx scripts/wallets.ts add        append a phrase for each account missing from .env; existing phrases stay as they are
 *   npx tsx scripts/wallets.ts addresses  print the funding address of each account
 *   npx tsx scripts/wallets.ts balance    print the chipnet balance and token amounts of each funding address
 *
 * Add `--network mainnet` to work on the two mainnet accounts of config/mainnet.json (payer, owner) instead.
 * Their variables carry a MAINNET_ prefix; chipnet phrases are never used on mainnet. Use `add` there: .env already exists.
 *
 * Phrases are never printed.
 */
import { generateBip39Mnemonic } from '@bitauth/libauth';
import { fileURLToPath } from 'node:url';
import { deriveFundingKey } from '../src/accounts.js';
import { loadConfig } from '../src/config.js';
import { connectChipnet, getBalance, listUnspent } from '../src/electrum.js';
import { appendEnvVariables, mnemonicVariable, readEnvFile, readMnemonic, writeNewEnvFile } from '../src/env.js';
import { loadMainnetConfig, parseNetworkArg, withoutNetworkArg } from '../src/landing-network.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const network = parseNetworkArg(process.argv.slice(2));
const config = network === 'mainnet' ? loadMainnetConfig() : loadConfig();
const command = withoutNetworkArg(process.argv.slice(2))[0] ?? 'addresses';
const variable = (account: (typeof config.accounts)[number]) => mnemonicVariable(account, network);

const addresses = () =>
  config.accounts.map((account) => ({ account, ...deriveFundingKey(readMnemonic(account, envPath, network), config) }));

if (command === 'generate') {
  writeNewEnvFile(envPath, Object.fromEntries(config.accounts.map((a) => [variable(a), generateBip39Mnemonic()])));
  console.log('wrote .env (0600)');
}
if (command === 'add') {
  const present = readEnvFile(envPath);
  const missing = config.accounts.map(variable).filter((name) => !(name in present) && !process.env[name]);
  appendEnvVariables(envPath, Object.fromEntries(missing.map((name) => [name, generateBip39Mnemonic()])));
  console.log(`added ${missing.length === 0 ? 'nothing' : missing.join(', ')} to .env`);
}
if (command === 'generate' || command === 'add' || command === 'addresses') {
  for (const { account, address, tokenAddress } of addresses()) console.log(`${account}\t${address}\t${tokenAddress}`);
} else if (command === 'balance') {
  const client = await connectChipnet(config);
  try {
    for (const { account, address } of addresses()) {
      const { confirmed, unconfirmed } = await getBalance(client, address);
      const tokens = new Map<string, bigint>();
      for (const { token } of await listUnspent(client, address)) {
        if (token) tokens.set(token.category, (tokens.get(token.category) ?? 0n) + token.amount);
      }
      const held = [...tokens].map(([category, amount]) => `\ttoken ${category}=${amount}`).join('');
      console.log(`${account}\t${address}\tconfirmed=${confirmed}\tunconfirmed=${unconfirmed}${held}`);
    }
  } finally {
    await client.disconnect();
  }
} else if (!['generate', 'add'].includes(command)) {
  console.error(`unknown command: ${command} (generate | add | addresses | balance)`);
  process.exit(2);
}
