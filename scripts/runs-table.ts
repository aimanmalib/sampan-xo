/**
 * Writes the README table that puts, next to every txid with a saved invitation, the invitation file and the exact
 * template it names (template/used/<id>.json). Rows come from the runs lists named in config/chipnet.json `runsTable`.
 *
 *   npx tsx scripts/runs-table.ts --write   rewrite the table between the runs-table markers in README.md
 *   npx tsx scripts/runs-table.ts --check   offline: the README table is what --write would write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { buildRunsTable, withRunsTable } from '../src/runs-table.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const readmePath = join(root, 'README.md');

const mode = process.argv[2];
if (mode === '--write' || mode === '--check') {
  const readme = readFileSync(readmePath, 'utf8');
  const wanted = withRunsTable(readme, buildRunsTable(root, loadConfig().runsTable.sources));
  if (mode === '--write') {
    writeFileSync(readmePath, wanted);
    console.log('README.md: runs table written');
  } else if (wanted !== readme) {
    console.error('README.md: runs table is out of date; run npx tsx scripts/runs-table.ts --write');
    process.exit(1);
  } else {
    console.log('README.md: runs table up to date');
  }
} else {
  console.log('usage: npx tsx scripts/runs-table.ts --write | --check | --help');
  if (mode !== '--help') process.exit(2);
}
