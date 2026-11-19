import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { swapIntentTemplate } from '../template/swap-intent.js';
import { templateJson } from '../src/template-json.js';
import {
  checkUsedTemplates,
  exampleKeyPlaceholder,
  identifierOf,
  packageCandidates,
  redactExampleKeys,
  usedFolder,
  writeUsedTemplates,
} from '../src/used-templates.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const temporary: string[] = [];
afterEach(() => {
  for (const folder of temporary.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A folder holding a copy of the repository's invitations and template/used. */
const copyOfRepo = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'used-templates-'));
  temporary.push(root);
  cpSync(join(repo, 'invitations'), join(root, 'invitations'), { recursive: true });
  cpSync(join(repo, usedFolder), join(root, usedFolder), { recursive: true });
  return root;
};

const swapJson = templateJson(swapIntentTemplate);
const swapId = identifierOf(swapJson);
/** The Swap Intent template the run1 to run3 invitations name (before the expire action was added). */
const runSwapId = (JSON.parse(readFileSync(join(repo, 'invitations', 'run1-open.json'), 'utf8')) as { templateIdentifier: string }).templateIdentifier;

describe('template/used', () => {
  it('has a file for every saved invitation, each named by the identifier the XO engine computes', () => {
    expect(checkUsedTemplates(repo)).toEqual([]);
  });

  it('fails when one byte of a stored template changes', () => {
    const root = copyOfRepo();
    const file = join(root, usedFolder, `${runSwapId}.json`);
    const text = readFileSync(file, 'utf8');
    const index = text.indexOf('Swap Intent');
    expect(index).toBeGreaterThan(-1);
    writeFileSync(file, text.slice(0, index) + 's' + text.slice(index + 1));
    expect(checkUsedTemplates(root)).toEqual([expect.stringContaining(`${runSwapId}.json: content has identifier`)]);
  });

  it('fails when an invitation has no stored template', () => {
    const root = copyOfRepo();
    rmSync(join(root, usedFolder, `${runSwapId}.json`));
    const problems = checkUsedTemplates(root);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((problem) => problem.includes(`${runSwapId}.json is missing`))).toBe(true);
    expect(problems).toContainEqual(expect.stringContaining('invitations/run1-open.json'));
  });

  it('holds no private-key-shaped value (the P2PKH package template example key is replaced)', () => {
    const files = readdirSync(join(repo, usedFolder)).filter((file) => file.endsWith('.json'));
    const texts = files.map((file) => readFileSync(join(repo, usedFolder, file), 'utf8'));
    expect(texts.filter((text) => /"[5KLc9][1-9A-HJ-NP-Za-km-z]{50,51}"/.test(text))).toEqual([]);
    expect(texts.filter((text) => text.includes(exampleKeyPlaceholder))).toHaveLength(1);
  });

  it('accepts a redacted file only against an original that hashes to its name', () => {
    const p2pkh = packageCandidates().find((candidate) => candidate.source.endsWith('p2pkhTemplate'))!;
    const p2pkhId = identifierOf(p2pkh.json);
    const root = copyOfRepo();
    const file = join(root, usedFolder, `${p2pkhId}.json`);
    expect(readFileSync(file, 'utf8')).toBe(redactExampleKeys(p2pkh.json));
    expect(checkUsedTemplates(root, [])).toEqual([expect.stringContaining(`${p2pkhId}.json: redacted, but no original`)]);
    const text = readFileSync(file, 'utf8');
    const index = text.indexOf('Wallet');
    writeFileSync(file, text.slice(0, index) + 'w' + text.slice(index + 1));
    expect(checkUsedTemplates(root)).toEqual([expect.stringContaining(`${p2pkhId}.json: redacted, but no original`)]);
  });

  it('fails when an invitation names no template', () => {
    const root = copyOfRepo();
    writeFileSync(join(root, 'invitations', 'extra.json'), '{}');
    expect(checkUsedTemplates(root)).toEqual(['invitations/extra.json: no templateIdentifier']);
  });
});

describe('writeUsedTemplates', () => {
  const freshRoot = (identifiers: string[]): string => {
    const root = mkdtempSync(join(tmpdir(), 'used-templates-'));
    temporary.push(root);
    mkdirSync(join(root, 'invitations'));
    identifiers.forEach((id, i) => writeFileSync(join(root, 'invitations', `run${i}-open.json`), JSON.stringify({ templateIdentifier: id })));
    return root;
  };

  it('writes the matching candidate under its identifier, including package templates', () => {
    const p2pkh = packageCandidates().find((candidate) => candidate.source.endsWith('p2pkhTemplate'));
    expect(p2pkh).toBeDefined();
    const p2pkhId = identifierOf(p2pkh!.json);
    const root = freshRoot([swapId, p2pkhId, swapId]);
    const written = writeUsedTemplates(root, [{ source: 'swap', json: swapJson }, ...packageCandidates()]);
    expect(written).toEqual([join(usedFolder, `${swapId}.json`), join(usedFolder, `${p2pkhId}.json`)]);
    expect(checkUsedTemplates(root)).toEqual([]);
  });

  it('fails loudly, naming the invitation, when no candidate matches', () => {
    const root = freshRoot(['0'.repeat(64)]);
    expect(() => writeUsedTemplates(root, [{ source: 'swap', json: swapJson }])).toThrow(/invitations\/run0-open\.json/);
  });
});
