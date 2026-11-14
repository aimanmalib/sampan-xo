import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { Engine, XO_SUPPORTED_NETWORKS } from '@xo-cash/engine';
import { p2pkhTemplate } from '@xo-cash/templates';
import { swapIntentTemplate } from '../template/swap-intent.js';
import type { AccountName, ChipnetConfig } from './config.js';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

export interface AccountEngine {
  engine: Engine;
  walletTemplateIdentifier: string;
  swapTemplateIdentifier: string;
}

/**
 * The Electrum layer under the engine (@electrum-cash/application) runs background requests with Promise.any over its
 * connected servers. When one runs while no server is connected (seen after Engine.stop), it rejects with an
 * AggregateError that has no errors and nothing awaits it, which ends the process. Only that exact rejection is
 * ignored; every other unhandled rejection is rethrown.
 */
export const isEmptyElectrumAggregateError = (reason: unknown): boolean =>
  reason instanceof AggregateError && reason.errors.length === 0;

let rejectionGuardInstalled = false;
const installRejectionGuard = (): void => {
  if (rejectionGuardInstalled) return;
  rejectionGuardInstalled = true;
  process.on('unhandledRejection', (reason) => {
    if (isEmptyElectrumAggregateError(reason)) {
      console.error('note: ignored an Electrum request that ran with no connected server (AggregateError with no errors)');
      return;
    }
    throw reason;
  });
};

/**
 * Starts the XO engine of one account on chipnet, with the P2PKH wallet template as its change, receive and address
 * policy and the Swap Intent template imported.
 * Storage is the engine's IndexedDB store (a file per account under swap.engineDatabasePath). The SQLite store of
 * @xo-cash/state 0.0.5 has no listScriptHashes, which Engine.create calls, so it cannot start the engine.
 */
export const startAccountEngine = async (account: AccountName, mnemonic: string, config: ChipnetConfig): Promise<AccountEngine> => {
  installRejectionGuard();
  const databasePath = resolve(repositoryRoot, config.swap.engineDatabasePath) + '/';
  mkdirSync(databasePath, { recursive: true });
  const engine = await Engine.create(mnemonic, {
    network: XO_SUPPORTED_NETWORKS.chipnet,
    storageType: 'indexeddb' as never,
    databasePath,
    databaseFilename: account,
  });
  const wallet = await engine.importTemplate(p2pkhTemplate);
  const walletTemplateIdentifier = wallet.templateIdentifier;
  await engine.setDefaultPolicies({
    change: { templateIdentifier: walletTemplateIdentifier },
    receive: { templateIdentifier: walletTemplateIdentifier },
    address: { templateIdentifier: walletTemplateIdentifier },
  });
  const swap = await engine.importTemplate(swapIntentTemplate);
  return { engine, walletTemplateIdentifier, swapTemplateIdentifier: swap.templateIdentifier };
};

/**
 * Stops the engine, waiting at most swap.engineStopTimeoutSeconds. Engine.stop() was seen to never settle in some
 * runs (after the work was stored), which kept the process alive; callers exit the process after this.
 */
export const stopAccountEngine = async ({ engine }: AccountEngine, config: ChipnetConfig): Promise<void> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<'timeout'>((resolveTimeout) => {
    timer = setTimeout(() => resolveTimeout('timeout'), config.swap.engineStopTimeoutSeconds * 1000);
  });
  const outcome = await Promise.race([engine.stop().then(() => 'stopped' as const), timeout]);
  clearTimeout(timer);
  if (outcome === 'timeout') console.error(`note: Engine.stop() did not settle within ${config.swap.engineStopTimeoutSeconds} s`);
};

/** Token-aware chipnet cash address of a locking bytecode given as hex. */
export const lockingBytecodeToAddress = (lockingBytecodeHex: string, prefix: string): string => {
  const result = lockingBytecodeToCashAddress({ bytecode: hexToBin(lockingBytecodeHex), prefix: prefix as 'bchtest', tokenSupport: true });
  if (typeof result === 'string') throw new Error(result);
  return result.address;
};
