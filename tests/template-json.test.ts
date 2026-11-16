import { readFileSync, readdirSync } from 'node:fs';
import { generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { exportedTemplates, templateJson } from '../src/template-json.js';

const invitationsFolder = new URL('../invitations/', import.meta.url);

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
    const named = readdirSync(invitationsFolder)
      .filter((file) => file.startsWith(invitationPrefix) && file.endsWith('.json'))
      .map((file) => (JSON.parse(readFileSync(new URL(file, invitationsFolder), 'utf8')) as { templateIdentifier: string }).templateIdentifier);
    if (name === 'swap-intent') expect(named.length).toBeGreaterThan(0);
    expect(new Set(named)).toEqual(new Set(named.length > 0 ? [identifier] : []));
  });
});
