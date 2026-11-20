import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { invitationsFolder, usedFolder } from './used-templates.js';

/** A runs list (docs/*-RUNS.md) and the network and explorer its txids belong to. */
export interface RunsSource {
  runs: string;
  network: string;
  /** Explorer URL the txid is appended to. */
  explorer: string;
}

/** One `ok` row of a runs list that names a saved invitation. */
export interface RunsRow {
  run: string;
  action: string;
  txid: string;
  invitation: string;
}

/**
 * Every runs list of the repository: Swap Intent and Landing on chipnet, the Landing mainnet run, the Swap Intent
 * mainnet run. The configured sources must name each, so that no list drops out of the README table.
 */
export const runsLists = ['docs/CHIPNET-RUNS.md', 'docs/MAINNET-RUNS.md', 'docs/MAINNET-SWAP-RUNS.md'] as const;

/** Throws with the missing names when the sources leave out one of runsLists. */
export const checkRunsSources = (sources: RunsSource[]): void => {
  const missing = runsLists.filter((runs) => !sources.some((source) => source.runs === runs));
  if (missing.length > 0) throw new Error(`runsTable.sources must name ${missing.join(', ')}`);
};

export const tableStart = '<!-- runs-table:start -->';
export const tableEnd = '<!-- runs-table:end -->';

const hex64 = /^[0-9a-f]{64}$/;

/** Rows `| date | run | action | txid | invitations/<file>.json | ok |`; other rows (setup, failures) are skipped. */
export const runsRows = (text: string): RunsRow[] =>
  text.split('\n').flatMap((line) => {
    if (!line.trim().startsWith('|')) return [];
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
    if (cells.length < 6 || cells[cells.length - 1]!.toLowerCase() !== 'ok' || !hex64.test(cells[3]!)) return [];
    const invitation = cells[4]!.replace(/`/g, '');
    if (!invitation.startsWith(`${invitationsFolder}/`) || !invitation.endsWith('.json')) return [];
    return [{ run: cells[1]!, action: cells[2]!, txid: cells[3]!, invitation }];
  });

/** The template identifier an invitation names; throws with the file name when it names none. */
const templateIdOf = (root: string, invitation: string): string => {
  const path = join(root, invitation);
  if (!existsSync(path)) throw new Error(`${invitation}: file missing`);
  const id = (JSON.parse(readFileSync(path, 'utf8')) as { templateIdentifier?: unknown }).templateIdentifier;
  if (typeof id !== 'string' || !hex64.test(id)) throw new Error(`${invitation}: no 64 hex templateIdentifier`);
  if (!existsSync(join(root, usedFolder, `${id}.json`))) {
    throw new Error(`${invitation}: template/used/${id}.json missing (run scripts/used-templates.ts --write)`);
  }
  return id;
};

/** The Markdown table: one line per `ok` row with an invitation, txid, invitation and template on the same line. */
export const buildRunsTable = (root: string, sources: RunsSource[]): string => {
  const lines = [
    '| Network | Run | Action | Txid | Invitation | Template |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const source of sources) {
    const path = join(root, source.runs);
    if (!existsSync(path)) continue;
    for (const row of runsRows(readFileSync(path, 'utf8'))) {
      const template = `template/used/${templateIdOf(root, row.invitation)}.json`;
      lines.push(
        `| ${source.network} | ${row.run} | ${row.action} | [${row.txid}](${source.explorer}${row.txid}) | ` +
          `[${row.invitation}](${row.invitation}) | [${template}](${template}) |`,
      );
    }
  }
  if (lines.length === 2) throw new Error(`no ok row with an invitation in ${sources.map((s) => s.runs).join(', ')}`);
  return lines.join('\n');
};

/** The README with the text between the two markers replaced by the table. */
export const withRunsTable = (readme: string, table: string): string => {
  const start = readme.indexOf(tableStart);
  const end = readme.indexOf(tableEnd);
  if (start < 0 || end < start || readme.indexOf(tableStart, start + 1) >= 0 || readme.indexOf(tableEnd, end + 1) >= 0) {
    throw new Error(`README.md must hold ${tableStart} and then ${tableEnd}, once each`);
  }
  return `${readme.slice(0, start + tableStart.length)}\n${table}\n${readme.slice(end)}`;
};
