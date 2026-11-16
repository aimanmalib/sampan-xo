/**
 * Writes the JSON form of every template in this repository (template/swap-intent.json, template/landing.json),
 * the form XO tools import (for example "Import Template" at https://blaze.xo.cash/). Run after any change to a
 * template/*.ts file.
 *
 *   npx tsx scripts/export-template.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { exportedTemplates, templateJson } from '../src/template-json.js';

for (const { template, jsonUrl } of exportedTemplates) {
  writeFileSync(jsonUrl, templateJson(template));
  console.log(`wrote ${fileURLToPath(jsonUrl)}`);
}
