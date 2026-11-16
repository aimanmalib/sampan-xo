/**
 * Chipnet runs of the Landing template, driven through the XO engine. Each step runs one account's engine in its
 * own process; the accounts share nothing but the invitation files in invitations/<run>-<step>.json.
 * maker is the payer, taker the converter; the owner account only receives.
 *
 *   npx tsx scripts/landing-run.ts land           <run>   payer pays the landing address           -> <run>-land.json
 *   npx tsx scripts/landing-run.ts convert-start  <run>   payer puts the landed coin in a convert  -> <run>-convert-start.json
 *   npx tsx scripts/landing-run.ts convert-take   <run>   converter pays the owner tokens, signs   -> <run>-convert-taken.json
 *   npx tsx scripts/landing-run.ts convert-finish <run>   payer completes input 0, broadcasts      -> <run>-convert.json
 *   npx tsx scripts/landing-run.ts convert        <run>   the three convert steps, each in its own process
 *   npx tsx scripts/landing-run.ts --help                 prints the usage line
 *
 * Add --dry-run to build and check without broadcasting; the step's invitation is then archived so its coins are
 * released, and only the steps before the broadcast write their file. A dry-run convert-finish stores the payer's
 * input commit in its engine, so the real convert starts again from convert-start (convert-take after a dry run
 * needs its earlier invitation archived to release the token coin).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { XOInvitation } from '@xo-cash/types';
import { loadConfig, type AccountName } from '../src/config.js';
import { readMnemonic } from '../src/env.js';
import { loadInvitation, saveInvitation } from '../src/invitation-file.js';
import { finishFollowUp, startConvert, takeConvert } from '../src/landing-convert.js';
import { landCoin } from '../src/landing-land.js';
import { startAccountEngine, stopAccountEngine, type AccountEngine } from '../src/xo-engine.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const config = loadConfig();
const [step, run, flag] = process.argv.slice(2);
const broadcast = flag !== '--dry-run';

type Outcome = { invitation: XOInvitation; transactionHash?: string };
type Step = { account: AccountName; reads?: string; writes: string; act: (account: AccountEngine, previous?: XOInvitation) => Promise<Outcome> };
const steps: Record<string, Step> = {
  land: { account: 'maker', writes: 'land', act: (account) => landCoin(account, config, broadcast) },
  'convert-start': { account: 'maker', reads: 'land', writes: 'convert-start', act: async (account, land) => ({ invitation: await startConvert(account, land!) }) },
  'convert-take': {
    account: 'taker',
    reads: 'convert-start',
    writes: 'convert-taken',
    act: async (account, started) => {
      const invitation = await takeConvert(account, started!, config);
      if (!broadcast) await account.engine.archiveInvitation(invitation.invitationIdentifier);
      return { invitation };
    },
  },
  'convert-finish': { account: 'maker', reads: 'convert-taken', writes: 'convert', act: (account, taken) => finishFollowUp(account, taken!, broadcast) },
};

// The whole convert flow; each step is a separate process, as two separate parties would run it.
if (step === 'convert' && run !== undefined && flag === undefined) {
  for (const part of ['convert-start', 'convert-take', 'convert-finish']) {
    console.log(`== ${part}`);
    const child = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), part, run], { stdio: 'inherit' });
    if (child.status !== 0) process.exit(child.status ?? 1);
  }
  process.exit(0);
}

const usage = `usage: landing-run.ts ${Object.keys(steps).join('|')} <run> [--dry-run]  or  landing-run.ts convert <run>`;
if (step === '--help' || step === '-h') {
  console.log(usage);
  process.exit(0);
}

const selected = step === undefined ? undefined : steps[step];
if (selected === undefined || run === undefined || !/^landing\d+$/.test(run) || (flag !== undefined && flag !== '--dry-run')) {
  console.error(`${usage}\n<run> is landing<n>`);
  process.exit(2);
}

const previous = selected.reads === undefined ? undefined : loadInvitation(run, selected.reads);
const account = await startAccountEngine(selected.account, readMnemonic(selected.account, envPath), config);
try {
  const outcome = await selected.act(account, previous);
  if (outcome.transactionHash !== undefined) console.log(`${step} ${broadcast ? 'broadcast' : 'built (dry run)'} txid ${outcome.transactionHash}`);
  if (broadcast || outcome.transactionHash === undefined) console.log(`saved ${saveInvitation(outcome.invitation, run, selected.writes)}`);
} finally {
  await stopAccountEngine(account, config);
}
process.exit(0);
