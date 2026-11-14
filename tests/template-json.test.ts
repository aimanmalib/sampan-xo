import { readFileSync, readdirSync } from 'node:fs';
import { generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { swapIntentTemplate } from '../template/swap-intent.js';
import { swapIntentTemplateJson, templateJsonUrl } from '../src/template-json.js';

describe('template JSON export', () => {
  const saved = readFileSync(templateJsonUrl, 'utf8');

  it('is up to date with template/swap-intent.ts (run scripts/export-template.ts after a change)', () => {
    expect(saved).toBe(swapIntentTemplateJson());
  });

  it('parses back to a template with the same identifier as the TypeScript source', () => {
    expect(generateTemplateIdentifier(parseTemplate(saved))).toBe(generateTemplateIdentifier(parseTemplate(swapIntentTemplate)));
  });

  it('has the identifier named by every saved invitation', () => {
    const identifier = generateTemplateIdentifier(parseTemplate(saved));
    const folder = new URL('../invitations/', import.meta.url);
    const named = readdirSync(folder)
      .filter((name) => name.endsWith('.json'))
      .map((name) => (JSON.parse(readFileSync(new URL(name, folder), 'utf8')) as { templateIdentifier: string }).templateIdentifier);
    expect(named.length).toBeGreaterThan(0);
    expect(new Set(named)).toEqual(new Set([identifier]));
  });
});
