/**
 * Writes template/swap-intent.json, the Swap Intent template in the JSON form that XO tools import
 * (for example "Import Template" at https://blaze.xo.cash/). Run after any change to template/swap-intent.ts.
 *
 *   npx tsx scripts/export-template.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { swapIntentTemplateJson, templateJsonUrl } from '../src/template-json.js';

writeFileSync(templateJsonUrl, swapIntentTemplateJson());
console.log(`wrote ${fileURLToPath(templateJsonUrl)}`);
