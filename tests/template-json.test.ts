import { readFileSync, readdirSync } from 'node:fs';
import { generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { exportedTemplates, templateJson } from '../src/template-json.js';

const invitationsFolder = new URL('../invitations/', import.meta.url);

/**
 * Runs made before a template changed keep the identifier of the template they were made with. landing1 and landing2
 * used the earlier hand-written Landing script (before the cashc bytecode port, docs/decisions/0002). run1 to run3
 * used the Swap Intent template before the expire action was added (docs/decisions/0003).
 */
const earlierRuns: Record<string, { runs: string[]; identifier: string }> = {
  'swap-intent': { runs: ['run1-', 'run2-', 'run3-'], identifier: 'c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456' },
  landing: { runs: ['landing1-', 'landing2-'], identifier: '03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515' },
};

/**
 * Funding steps (`<run>-fund-<what>.json`, made by scripts/send.ts) use the stock XO wallet template "Wallet (P2PKH)",
 * not the run's own template; they are checked against that identifier instead.
 */
const fundingFile = /^[a-z]+[0-9]+-fund-[a-z]+\.json$/;
const walletTemplateIdentifier = 'a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672';

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
    const prefixed = readdirSync(invitationsFolder).filter((file) => file.startsWith(invitationPrefix) && file.endsWith('.json'));
    const funding = prefixed.filter((file) => fundingFile.test(file));
    expect(new Set(funding.map(savedIdentifier))).toEqual(new Set(funding.length > 0 ? [walletTemplateIdentifier] : []));
    const files = prefixed.filter((file) => !fundingFile.test(file));
    const isEarlier = (file: string) => earlier?.runs.some((run) => file.startsWith(run)) === true;
    const named = files.filter((file) => !isEarlier(file)).map(savedIdentifier);
    expect(new Set(named)).toEqual(new Set(named.length > 0 ? [identifier] : []));
    const earlierNamed = files.filter(isEarlier).map(savedIdentifier);
    if (name === 'swap-intent') expect(named.length + earlierNamed.length).toBeGreaterThan(0);
    expect(new Set(earlierNamed)).toEqual(new Set(earlierNamed.length > 0 ? [earlier?.identifier] : []));
    if (earlier !== undefined) expect(earlier.identifier).not.toBe(identifier);
  });
});
