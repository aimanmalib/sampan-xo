import { hexToBin } from '@bitauth/libauth';
import type { XOInvitation } from '@xo-cash/types';
import { findOfferCoin, readOfferVariables } from './swap-fill.js';
import { finishAction, signOwnInputs, type ActionResult } from './swap-open.js';
import type { AccountEngine } from './xo-engine.js';

/**
 * cancel (maker): spends the offer coin back to the maker locking script committed at open, less the template's
 * cancel fee. Runs in the engine that opened the offer, as only it holds makerKey for the offer script.
 */
export const cancelOffer = async (account: AccountEngine, open: XOInvitation, broadcast: boolean): Promise<ActionResult> => {
  const { engine, swapTemplateIdentifier: templateIdentifier } = account;
  const offer = await findOfferCoin(account, open);
  const created = await engine.createInvitation({ templateIdentifier, actionIdentifier: 'cancel' });
  const invitationIdentifier = created.invitation.invitationIdentifier;
  const role = { roleIdentifier: 'maker' };
  await engine.appendInvitation(invitationIdentifier, {
    templateIdentifier,
    actionIdentifier: 'cancel',
    ...role,
    variables: readOfferVariables(open).map((variable) => ({ ...variable, ...role })),
    inputs: [
      {
        inputIdentifier: 'cancelInput',
        transactionIndex: 0,
        outpointTransactionHash: hexToBin(offer.outpointTransactionHash),
        outpointIndex: offer.outpointIndex,
        sequenceNumber: 0,
        ...role,
      },
    ],
    outputs: [{ outputIdentifier: 'refundOutput', transactionIndex: 0, ...role }],
  });
  await signOwnInputs(account, invitationIdentifier);
  return finishAction(account, invitationIdentifier, broadcast);
};
