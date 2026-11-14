/**
 * Chipnet runs of the Swap Intent template, driven through the XO engine.
 * Each step runs one account's engine in its own process; the accounts share nothing but the invitation files
 * in invitations/<run>-<step>.json.
 *
 *   npx tsx scripts/run.ts open        <run>   maker opens an offer                       -> <run>-open.json
 *   npx tsx scripts/run.ts fill-start  <run>   maker puts the offer coin in a fill        -> <run>-fill-start.json
 *   npx tsx scripts/run.ts fill-take   <run>   taker pays the tokens and signs            -> <run>-fill-taken.json
 *   npx tsx scripts/run.ts fill-finish <run>   maker completes the offer input, broadcasts -> <run>-fill.json
 *   npx tsx scripts/run.ts fill        <run>   the four steps above, each in its own process
 *   npx tsx scripts/run.ts cancel      <run>   maker spends its open offer back            -> <run>-cancel.json
 *   npx tsx scripts/run.ts --help              prints the usage line
 *
 * Add --dry-run to build and check without broadcasting; the step's invitation is then archived so its coins are
 * released, and only the steps before the broadcast write their file.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { XOInvitation } from '@xo-cash/types';
import { loadConfig, type AccountName } from '../src/config.js';
import { readMnemonic } from '../src/env.js';
import { loadInvitation, saveInvitation } from '../src/invitation-file.js';
import { cancelOffer } from '../src/swap-cancel.js';
import { finishFill, startFill, takeFill } from '../src/swap-fill.js';
import { openOffer } from '../src/swap-open.js';
import { startAccountEngine, stopAccountEngine, type AccountEngine } from '../src/xo-engine.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const config = loadConfig();
const [step, run, flag] = process.argv.slice(2);
const broadcast = flag !== '--dry-run';

type Outcome = { invitation: XOInvitation; transactionHash?: string };
type Step = { account: AccountName; reads?: string; writes: string; act: (account: AccountEngine, previous?: XOInvitation) => Promise<Outcome> };
const steps: Record<string, Step> = {
  open: { account: 'maker', writes: 'open', act: (account) => openOffer(account, config, broadcast) },
  'fill-start': { account: 'maker', reads: 'open', writes: 'fill-start', act: async (account, open) => ({ invitation: await startFill(account, open!) }) },
  'fill-take': {
    account: 'taker',
    reads: 'fill-start',
    writes: 'fill-taken',
    act: async (account, started) => {
      const invitation = await takeFill(account, started!, config.testToken.category!, BigInt(config.swap.wantedAmount));
      if (!broadcast) await account.engine.archiveInvitation(invitation.invitationIdentifier);
      return { invitation };
    },
  },
  'fill-finish': { account: 'maker', reads: 'fill-taken', writes: 'fill', act: (account, taken) => finishFill(account, taken!, broadcast) },
  cancel: { account: 'maker', reads: 'open', writes: 'cancel', act: (account, open) => cancelOffer(account, open!, broadcast) },
};

// The whole open -> fill flow; each step is a separate process, as two separate parties would run it.
if (step === 'fill' && run !== undefined && flag === undefined) {
  for (const part of ['open', 'fill-start', 'fill-take', 'fill-finish']) {
    console.log(`== ${part}`);
    const child = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), part, run], { stdio: 'inherit' });
    if (child.status !== 0) process.exit(child.status ?? 1);
  }
  process.exit(0);
}

const usage = `usage: run.ts ${Object.keys(steps).join('|')} <run> [--dry-run]  or  run.ts fill <run>`;
if (step === '--help' || step === '-h') {
  console.log(usage);
  process.exit(0);
}

const selected = step === undefined ? undefined : steps[step];
if (selected === undefined || run === undefined || (flag !== undefined && flag !== '--dry-run')) {
  console.error(usage);
  process.exit(2);
}

const previous = selected.reads === undefined ? undefined : loadInvitation(run, selected.reads);
const account = await startAccountEngine(selected.account, readMnemonic(selected.account, envPath), config);
try {
  const outcome = await selected.act(account, previous);
  if (outcome.transactionHash !== undefined) {
    console.log(`${step} ${broadcast ? 'broadcast' : 'built (dry run)'} txid ${outcome.transactionHash}`);
  }
  if (broadcast || outcome.transactionHash === undefined) console.log(`saved ${saveInvitation(outcome.invitation, run, selected.writes)}`);
} finally {
  await stopAccountEngine(account, config);
}
process.exit(0);
