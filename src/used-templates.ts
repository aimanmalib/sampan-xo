import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as xoTemplates from '@xo-cash/templates';
import type { XOTemplate } from '@xo-cash/types';
import { generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import { templateJson } from './template-json.js';

/** Where each invitation's exact template is kept, relative to the repository root. */
export const usedFolder = join('template', 'used');
export const invitationsFolder = 'invitations';

/** A template the writer may store, with a note on where it came from. */
export interface TemplateCandidate {
  source: string;
  json: string;
}

/** The identifier the XO engine gives a template (sha256 of its canonical serialization). */
export const identifierOf = (json: string): string => generateTemplateIdentifier(parseTemplate(json));

/** Each `invitations/*.json` file name with the template identifier it names (undefined when it names none). */
export const invitationIdentifiers = (root: string): { file: string; identifier: string | undefined }[] =>
  readdirSync(join(root, invitationsFolder))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const parsed = JSON.parse(readFileSync(join(root, invitationsFolder, file), 'utf8')) as { templateIdentifier?: unknown };
      const id = parsed.templateIdentifier;
      return { file, identifier: typeof id === 'string' && /^[0-9a-f]{64}$/.test(id) ? id : undefined };
    });

/** The templates shipped by the @xo-cash/templates package (for example the P2PKH wallet template). */
export const packageCandidates = (): TemplateCandidate[] =>
  Object.entries(xoTemplates)
    .filter(([, value]) => typeof value === 'object' && value !== null && 'actions' in value)
    .map(([name, value]) => ({ source: `@xo-cash/templates ${name}`, json: templateJson(value as XOTemplate) }));

/**
 * Problems with `template/used/`: an invitation without an identifier, an identifier without a file, or a file whose
 * content does not hash to its own name. Empty when complete.
 */
export const checkUsedTemplates = (root: string): string[] => {
  const problems: string[] = [];
  for (const { file, identifier } of invitationIdentifiers(root)) {
    if (identifier === undefined) problems.push(`${invitationsFolder}/${file}: no templateIdentifier`);
    else if (!existsSync(join(root, usedFolder, `${identifier}.json`)))
      problems.push(`${invitationsFolder}/${file}: ${usedFolder}/${identifier}.json is missing`);
  }
  const folder = join(root, usedFolder);
  const stored = existsSync(folder) ? readdirSync(folder).filter((file) => file.endsWith('.json')).sort() : [];
  for (const file of stored) {
    const name = file.slice(0, -'.json'.length);
    let actual: string;
    try {
      actual = identifierOf(readFileSync(join(folder, file), 'utf8'));
    } catch (error) {
      problems.push(`${usedFolder}/${file}: not a valid XO template (${(error as Error).message.split('\n')[0]})`);
      continue;
    }
    if (actual !== name) problems.push(`${usedFolder}/${file}: content has identifier ${actual}`);
  }
  return problems;
};

/**
 * Writes `template/used/<id>.json` for every invitation from the first candidate whose identifier matches. Returns
 * the files written. Throws, naming the invitations, when an identifier matches no candidate.
 */
export const writeUsedTemplates = (root: string, candidates: TemplateCandidate[]): string[] => {
  const byIdentifier = new Map<string, TemplateCandidate>();
  for (const candidate of candidates) {
    const identifier = identifierOf(candidate.json);
    if (!byIdentifier.has(identifier)) byIdentifier.set(identifier, candidate);
  }
  const unmatched: string[] = [];
  const written: string[] = [];
  mkdirSync(join(root, usedFolder), { recursive: true });
  for (const { file, identifier } of invitationIdentifiers(root)) {
    const candidate = identifier === undefined ? undefined : byIdentifier.get(identifier);
    if (identifier === undefined || candidate === undefined) {
      unmatched.push(`${invitationsFolder}/${file} (${identifier ?? 'no templateIdentifier'})`);
      continue;
    }
    const target = join(usedFolder, `${identifier}.json`);
    const json = templateJson(parseTemplate(candidate.json));
    if (identifierOf(json) !== identifier) throw new Error(`${candidate.source}: re-serialized template changed identifier`);
    if (!written.includes(target)) {
      writeFileSync(join(root, target), json);
      written.push(target);
    }
  }
  if (unmatched.length > 0) throw new Error(`no template matches the identifier of:\n  ${unmatched.join('\n  ')}`);
  return written;
};
