/**
 * Sends test coins or test tokens from a project account's XO engine wallet to another chipnet address, for example
 * a disposable account created in the XO debug tool.
 *
 *   npx tsx scripts/send.ts <maker|taker> <bchtest:address> sats <satoshis>   [<run> [--dry-run]]
 *   npx tsx scripts/send.ts <maker|taker> <bchtest:address> tokens <amount>   [<run> [--dry-run]]
 *
 * tokens sends units of testToken.category from config/chipnet.json. With <run> the invitation is saved as
 * invitations/<run>-fund-sats.json or invitations/<run>-fund-tokens.json.
 */
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { readMnemonic } from '../src/env.js';
import { saveInvitation } from '../src/invitation-file.js';
import { addressToLockingBytecode, sendFromEngine, type Transfer } from '../src/send.js';
import { startAccountEngine, stopAccountEngine } from '../src/xo-engine.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const config = loadConfig();
const [account, address, kind, amount, run, flag] = process.argv.slice(2);
const usage = 'usage: send.ts <maker|taker> <bchtest:address> sats|tokens <amount> [<run> [--dry-run]]';
if (account === '--help' || account === '-h') {
  console.log(usage);
  process.exit(0);
}
if ((account !== 'maker' && account !== 'taker') || address === undefined || (kind !== 'sats' && kind !== 'tokens') || !/^[1-9][0-9]*$/.test(amount ?? '') || (flag !== undefined && flag !== '--dry-run')) {
  console.error(usage);
  process.exit(2);
}
const broadcast = flag !== '--dry-run';
if (kind === 'tokens' && config.testToken.category === null) throw new Error('testToken.category is not set');
const transfer: Transfer = kind === 'sats' ? { kind: 'satoshis', satoshis: BigInt(amount!) } : { kind: 'tokens', category: config.testToken.category!, amount: BigInt(amount!) };
const recipient = addressToLockingBytecode(address, config.addressPrefix);

const started = await startAccountEngine(account, readMnemonic(account, envPath), config);
try {
  const outcome = await sendFromEngine(started, recipient, transfer, broadcast);
  console.log(`send ${kind} ${broadcast ? 'broadcast' : 'built (dry run)'} txid ${outcome.transactionHash}`);
  if (run !== undefined && broadcast) console.log(`saved ${saveInvitation(outcome.invitation, run, `fund-${kind}`)}`);
} finally {
  await stopAccountEngine(started, config);
}
process.exit(0);
