import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { XOInvitation } from '@xo-cash/types';
import { deserializeInvitation, serializeInvitation } from '@xo-cash/utils';

const invitationsFolder = fileURLToPath(new URL('../invitations/', import.meta.url));

/** Path of a saved invitation: invitations/<run>-<step>.json. */
export const invitationPath = (run: string, step: string): string => {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(run) || !/^[a-z-]+$/.test(step)) throw new Error(`bad run or step name: ${run} ${step}`);
  return resolve(invitationsFolder, `${run}-${step}.json`);
};

/** Saves an invitation in the XO shared JSON form, pretty printed so it can be read and diffed. */
export const saveInvitation = (invitation: XOInvitation, run: string, step: string): string => {
  const path = invitationPath(run, step);
  writeFileSync(path, JSON.stringify(JSON.parse(serializeInvitation(invitation)), null, 2) + '\n');
  return path;
};

/** Loads and checks a saved invitation. */
export const loadInvitation = (run: string, step: string): XOInvitation =>
  deserializeInvitation(readFileSync(invitationPath(run, step), 'utf8'));
