import { readFileSync, readdirSync } from 'node:fs';
import { generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { exportedTemplates, templateJson } from '../src/template-json.js';

const invitationsFolder = new URL('../invitations/', import.meta.url);

/**
 * Runs made before a template changed keep the identifier of the template they were made with. landing1 and landing2
 * used the earlier hand-written Landing script (before the cashc bytecode port, docs/decisions/0002).
 */
const earlierRuns: Record<string, { runs: string[]; identifier: string }> = {
  landing: { runs: ['landing1-', 'landing2-'], identifier: '03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515' },
};

const savedIdentifier = (file: string): string =>
  (JSON.parse(readFileSync(new URL(file, invitationsFolder), 'utf8')) as { templateIdentifier: string }).templateIdentifier;

describe.each(exportedTemplates)('template JSON export: $name', ({ template, jsonUrl, invitationPrefix, name }) => {
  const saved = readFileSync(jsonUrl, 'utf8');

  it(`is up to date with template/${name}.ts (run scripts/export-template.ts after a change)`, () => {
    expect(saved).toBe(templateJson(template));
  });

  it('parses back to a template with the same identifier as the TypeScript source', () => {
    expect(generateTemplateIdentifier(parseTemplate(saved))).toBe(generateTemplateIdentifier(parseTemplate(template)));
  });

  it(`has the identifier named by every saved invitation whose file name starts with "${invitationPrefix}"`, () => {
    const identifier = generateTemplateIdentifier(parseTemplate(saved));
    const earlier = earlierRuns[name];
    const files = readdirSync(invitationsFolder).filter((file) => file.startsWith(invitationPrefix) && file.endsWith('.json'));
    const isEarlier = (file: string) => earlier?.runs.some((run) => file.startsWith(run)) === true;
    const named = files.filter((file) => !isEarlier(file)).map(savedIdentifier);
    if (name === 'swap-intent') expect(named.length).toBeGreaterThan(0);
    expect(new Set(named)).toEqual(new Set(named.length > 0 ? [identifier] : []));
    const earlierNamed = files.filter(isEarlier).map(savedIdentifier);
    expect(new Set(earlierNamed)).toEqual(new Set(earlierNamed.length > 0 ? [earlier?.identifier] : []));
    if (earlier !== undefined) expect(earlier.identifier).not.toBe(identifier);
  });
});
