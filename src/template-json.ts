import { parseTemplate, serializeTemplate } from '@xo-cash/utils';
import type { XOTemplate } from '@xo-cash/types';
import { landingTemplate } from '../template/landing.js';
import { swapIntentTemplate } from '../template/swap-intent.js';

/** A template in this repository, its JSON file, and the prefix of the saved invitations made with it. */
export interface ExportedTemplate {
  name: string;
  template: XOTemplate;
  jsonUrl: URL;
  invitationPrefix: string;
}

export const exportedTemplates: ExportedTemplate[] = [
  { name: 'swap-intent', template: swapIntentTemplate, jsonUrl: new URL('../template/swap-intent.json', import.meta.url), invitationPrefix: 'run' },
  { name: 'landing', template: landingTemplate, jsonUrl: new URL('../template/landing.json', import.meta.url), invitationPrefix: 'landing' },
];

/** A template as pretty printed Extended JSON (bigints as `<bigint: 1000n>`), validated by the XO parser first. */
export const templateJson = (template: XOTemplate): string =>
  JSON.stringify(JSON.parse(serializeTemplate(parseTemplate(template))), null, 2) + '\n';

/** Path of the Swap Intent template in the JSON form XO tools import. */
export const templateJsonUrl = exportedTemplates[0]!.jsonUrl;

export const swapIntentTemplateJson = (): string => templateJson(swapIntentTemplate);
