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
 *   npx tsx scripts/run.ts expire      <run>   returns an old enough offer to the maker, no key -> <run>-expire.json
 *   npx tsx scripts/run.ts expire-early <run>  the same without the age check, to record the node's rejection
 *   npx tsx scripts/run.ts --help              prints the usage line
 *
 * Add --dry-run to build and check without broadcasting; the step's invitation is then archived so its coins are
 * released, and only the steps before the broadcast write their file. A dry run prints the outputs it built.
 *
 * Add --network mainnet for the one minimum mainnet run: steps open, expire and cancel only, run names swapmain<n>,
 * values from config/mainnet-swap.json (limits in src/swap-network.ts), the MAINNET_PAYER phrase as the maker.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { XOInvitation } from '@xo-cash/types';
import type { AccountName } from '../src/config.js';
import { readMnemonic } from '../src/env.js';
import { loadInvitation, saveInvitation } from '../src/invitation-file.js';
import { cancelOffer } from '../src/swap-cancel.js';
import { expireOffer, locateOffer } from '../src/swap-expire.js';
import { finishFill, startFill, takeFill } from '../src/swap-fill.js';
import { parseNetworkArg, withoutNetworkArg } from '../src/landing-network.js';
import { openOffer } from '../src/swap-open.js';
import { checkSwapStep, describeOutputs, loadSwapRunConfig, swapAccount } from '../src/swap-network.js';
import { startAccountEngine, stopAccountEngine, type AccountEngine } from '../src/xo-engine.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const network = parseNetworkArg(process.argv.slice(2));
const config = loadSwapRunConfig(network);
const [step, run, flag] = withoutNetworkArg(process.argv.slice(2));
const broadcast = flag !== '--dry-run';

type Outcome = { invitation: XOInvitation; transactionHash?: string; serializedTransaction?: string };
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
  // The expire path takes no key, but the XO engine only completes inputs for coins its own account tracks, and an
  // account that holds no makerKey cannot rebuild the offer locking script to track it. So the maker's engine runs it.
  expire: { account: 'maker', reads: 'open', writes: 'expire', act: async (account, open) => expireOffer(account, open!, await locateOffer(open!, config), broadcast) },
  'expire-early': {
    account: 'maker',
    reads: 'open',
    writes: 'expire',
    act: async (account, open) => expireOffer(account, open!, await locateOffer(open!, config), broadcast, true),
  },
};

// The whole open -> fill flow; each step is a separate process, as two separate parties would run it.
if (step === 'fill' && run !== undefined && flag === undefined && network === 'chipnet') {
  for (const part of ['open', 'fill-start', 'fill-take', 'fill-finish']) {
    console.log(`== ${part}`);
    const child = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), part, run], { stdio: 'inherit' });
    if (child.status !== 0) process.exit(child.status ?? 1);
  }
  process.exit(0);
}

const usage = `usage: run.ts ${Object.keys(steps).join('|')} <run> [--dry-run]  or  run.ts fill <run>
       run.ts open|expire|cancel swapmain<n> --network mainnet [--dry-run]`;
if (step === '--help' || step === '-h') {
  console.log(usage);
  process.exit(0);
}

const selected = step === undefined ? undefined : steps[step];
if (selected === undefined || run === undefined || (flag !== undefined && flag !== '--dry-run')) {
  console.error(usage);
  process.exit(2);
}
try {
  checkSwapStep(step!, run, network);
} catch (error) {
  console.error(`${String(error)}\n${usage}`);
  process.exit(2);
}

const previous = selected.reads === undefined ? undefined : loadInvitation(run, selected.reads);
const accountName = swapAccount(selected.account, network);
const account = await startAccountEngine(accountName, readMnemonic(accountName, envPath, network), config);
try {
  const outcome = await selected.act(account, previous);
  if (outcome.transactionHash !== undefined) {
    console.log(`${step} ${broadcast ? 'broadcast' : 'built (dry run)'} txid ${outcome.transactionHash} on ${network}`);
  }
  // A dry run prints what it built, so the outputs can be checked before the real broadcast.
  if (!broadcast && outcome.serializedTransaction !== undefined) {
    for (const line of describeOutputs(outcome.serializedTransaction, config.addressPrefix)) console.log(line);
    console.log(`transaction ${outcome.serializedTransaction}`);
  }
  if (broadcast || outcome.transactionHash === undefined) console.log(`saved ${saveInvitation(outcome.invitation, run, selected.writes)}`);
} finally {
  await stopAccountEngine(account, config);
}
process.exit(0);
