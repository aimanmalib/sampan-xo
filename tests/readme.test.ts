import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const whoWroteWhat = 'The feedback in FEEDBACK.md was written by the entrant, by hand.';

describe('public documents', () => {
  it('README names the event exactly and has an AI disclosure section', () => {
    const readme = read('README.md');
    expect(readme).toContain('BCH BLAZE 2026');
    expect(readme).toMatch(/^## AI disclosure$/m);
    expect(readme).toContain(whoWroteWhat);
  });

  it('JOURNAL starts with the who-wrote-what line', () => {
    const first = read('JOURNAL.md').split('\n').find((line) => line.trim() !== '');
    expect(first).toBe(`Build journal, written by the AI coding agent while it worked. ${whoWroteWhat}`);
  });
});
