/**
 * Keeps the exact template of every saved invitation in template/used/<id>.json, where <id> is the identifier the XO
 * engine computes (sha256 of the serialized template) and each invitation names in `templateIdentifier`.
 *
 *   npx tsx scripts/used-templates.ts --write   find each template (current export, @xo-cash/templates, or an
 *                                               earlier commit of template/*.json) and write it
 *   npx tsx scripts/used-templates.ts --check   offline: every invitation has its file and every file hashes to its name
 *                                               (example keys in template scenarios are stored as a placeholder)
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { exportedTemplates, templateJson } from '../src/template-json.js';
import { checkUsedTemplates, packageCandidates, writeUsedTemplates, type TemplateCandidate } from '../src/used-templates.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const git = (...args: string[]): string => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });

/** Every committed version of template/*.json, newest first. */
const historyCandidates = (): TemplateCandidate[] =>
  exportedTemplates.flatMap(({ name }) => {
    const path = `template/${name}.json`;
    const commits = git('log', '--format=%h', '--', path).split('\n').filter(Boolean);
    return commits.map((commit) => ({ source: `${path} at ${commit}`, json: git('show', `${commit}:${path}`) }));
  });

const mode = process.argv[2];
if (mode === '--write') {
  const current = exportedTemplates.map(({ name, template }) => ({ source: `template/${name}.ts`, json: templateJson(template) }));
  for (const file of writeUsedTemplates(root, [...current, ...packageCandidates(), ...historyCandidates()])) console.log(`wrote ${file}`);
} else if (mode === '--check') {
  const problems = checkUsedTemplates(root);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exit(1);
  console.log('template/used: complete');
} else {
  console.log('usage: npx tsx scripts/used-templates.ts --write | --check | --help');
  if (mode !== '--help') process.exit(2);
}
