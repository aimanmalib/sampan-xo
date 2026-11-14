import { parseTemplate, serializeTemplate } from '@xo-cash/utils';
import { swapIntentTemplate } from '../template/swap-intent.js';

/** Path of the template in the JSON form XO tools import (bigints as Extended JSON `<bigint: 1000n>`). */
export const templateJsonUrl = new URL('../template/swap-intent.json', import.meta.url);

/** The Swap Intent template as pretty printed Extended JSON, validated by the XO parser first. */
export const swapIntentTemplateJson = (): string => JSON.stringify(JSON.parse(serializeTemplate(parseTemplate(swapIntentTemplate))), null, 2) + '\n';
