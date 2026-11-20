import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildRunsTable, runsRows, tableEnd, tableStart, withRunsTable, type RunsSource } from '../src/runs-table.js';
import { usedFolder } from '../src/used-templates.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const sources = loadConfig().runsTable.sources;
const temporary: string[] = [];
afterEach(() => {
  for (const folder of temporary.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A folder holding a copy of the repository's runs list, invitations and template/used. */
const copyOfRepo = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'runs-table-'));
  temporary.push(root);
  mkdirSync(join(root, 'docs'));
  cpSync(join(repo, 'docs', 'CHIPNET-RUNS.md'), join(root, 'docs', 'CHIPNET-RUNS.md'));
  cpSync(join(repo, 'invitations'), join(root, 'invitations'), { recursive: true });
  cpSync(join(repo, usedFolder), join(root, usedFolder), { recursive: true });
  return root;
};

const txA = 'a'.repeat(64);
const txB = 'b'.repeat(64);
const runsList = [
  '| Date (UTC) | Run | Action | Txid | Invitation | Result |',
  '| --- | --- | --- | --- | --- | --- |',
  `| 2026-11-14 18:56 | setup | fund | ${txA} | - | ok |`,
  `| 2026-11-14 19:29 | run1 | open | ${txA} | invitations/run1-open.json | ok |`,
  `| 2026-11-14 19:30 | run1 | fill | - (rejected: \`x\`) | - | fail |`,
  `| 2026-11-14 19:31 | run1 | fill | ${txB} | \`invitations/run1-fill.json\` | ok |`,
].join('\n');

describe('runs table', () => {
  it('reads only ok rows that name an invitation', () => {
    expect(runsRows(runsList)).toEqual([
      { run: 'run1', action: 'open', txid: txA, invitation: 'invitations/run1-open.json' },
      { run: 'run1', action: 'fill', txid: txB, invitation: 'invitations/run1-fill.json' },
    ]);
  });

  it('puts the full txid, the invitation and template/used/<id> on one line for every such row of the runs list', () => {
    const readme = readFileSync(join(repo, 'README.md'), 'utf8').split('\n');
    const rows = runsRows(readFileSync(join(repo, 'docs', 'CHIPNET-RUNS.md'), 'utf8'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const id = (JSON.parse(readFileSync(join(repo, row.invitation), 'utf8')) as { templateIdentifier: string }).templateIdentifier;
      const needed = [row.txid, row.invitation, `template/used/${id}.json`];
      expect(readme.some((line) => needed.every((part) => line.includes(part))), row.invitation).toBe(true);
    }
  });

  it('README holds exactly what --write would write', () => {
    const readme = readFileSync(join(repo, 'README.md'), 'utf8');
    expect(withRunsTable(readme, buildRunsTable(repo, sources))).toBe(readme);
  });

  it('adds a 3xpl link after the txid only for a source with explorer2', () => {
    const root = copyOfRepo();
    const chipnet = sources.find((source) => source.runs === 'docs/CHIPNET-RUNS.md')!;
    expect(chipnet.explorer2).toBeUndefined();
    const plain = buildRunsTable(root, [chipnet]);
    expect(plain).not.toContain('3xpl');
    const second = buildRunsTable(root, [{ ...chipnet, explorer2: 'https://second.example/tx/' }]);
    const rows = runsRows(readFileSync(join(root, 'docs', 'CHIPNET-RUNS.md'), 'utf8'));
    for (const row of rows) {
      expect(second).toContain(`(${chipnet.explorer}${row.txid}) ([3xpl](https://second.example/tx/${row.txid})) | [${row.invitation}]`);
    }
    expect(second.replace(/ \(\[3xpl\]\([^)]*\)\)/g, '')).toBe(plain);
  });

  it('links every mainnet txid of the README table on 3xpl too', () => {
    const mainnet = sources.filter((source) => source.network === 'mainnet');
    expect(mainnet.length).toBeGreaterThan(0);
    for (const source of mainnet) expect(source.explorer2).toBe('https://3xpl.com/bitcoin-cash/transaction/');
  });

  it('skips a runs list that does not exist and fails when no row is left', () => {
    const root = copyOfRepo();
    const missing: RunsSource = { runs: 'docs/NONE.md', network: 'x', explorer: 'https://example.invalid/' };
    expect(buildRunsTable(root, [...sources, missing])).toBe(buildRunsTable(root, sources));
    expect(() => buildRunsTable(root, [missing])).toThrow(/no ok row/);
  });

  it('fails, naming the invitation, when its template file is missing', () => {
    const root = copyOfRepo();
    const id = (JSON.parse(readFileSync(join(root, 'invitations', 'run1-open.json'), 'utf8')) as { templateIdentifier: string }).templateIdentifier;
    rmSync(join(root, usedFolder, `${id}.json`));
    expect(() => buildRunsTable(root, sources)).toThrow(/invitations\/run1-open\.json: template\/used\/.* missing/);
  });

  it('fails, naming the invitation, when it names no template', () => {
    const root = copyOfRepo();
    writeFileSync(join(root, 'invitations', 'run1-open.json'), '{}');
    expect(() => buildRunsTable(root, sources)).toThrow(/invitations\/run1-open\.json: no 64 hex templateIdentifier/);
  });

  it('replaces only the text between the markers and refuses a README without them', () => {
    const readme = `intro\n${tableStart}\nold\n${tableEnd}\noutro\n`;
    expect(withRunsTable(readme, 'new')).toBe(`intro\n${tableStart}\nnew\n${tableEnd}\noutro\n`);
    expect(() => withRunsTable('no markers', 'new')).toThrow(/once each/);
    expect(() => withRunsTable(readme + tableStart, 'new')).toThrow(/once each/);
  });
});
