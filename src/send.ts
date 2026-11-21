import { cashAddressToLockingBytecode, binToHex, hexToBin } from '@bitauth/libauth';
import { finishAction, signOwnInputs, type ActionResult } from './swap-open.js';
import { plainCoins, tokenCoin } from './plain-coins.js';
import type { AccountEngine } from './xo-engine.js';

/** What to send to another wallet: plain satoshis, or fungible tokens of one category. */
export type Transfer = { kind: 'satoshis'; satoshis: bigint } | { kind: 'tokens'; category: string; amount: bigint };

/** Locking bytecode (hex) of a chipnet cash address; throws on any other prefix or a malformed address. */
export const addressToLockingBytecode = (address: string, prefix: string): string => {
  if (!address.startsWith(`${prefix}:`)) throw new Error(`not a ${prefix} address: ${address}`);
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') throw new Error(`bad address ${address}: ${decoded}`);
  return binToHex(decoded.bytecode);
};

/**
 * Sends satoshis or fungible tokens from an engine wallet to an outside address with the P2PKH wallet template
 * (actions sendSatoshis and sendFungibleTokens). The engine picks no coins itself: one coin is chosen here (the
 * largest plain coin, or a coin holding enough of the category plus the largest plain coin for the fee), and the
 * engine adds change and the fee.
 */
export const sendFromEngine = async (account: AccountEngine, recipientLockingscript: string, transfer: Transfer, broadcast: boolean): Promise<ActionResult> => {
  const { engine, walletTemplateIdentifier: templateIdentifier } = account;
  const actionIdentifier = transfer.kind === 'satoshis' ? 'sendSatoshis' : 'sendFungibleTokens';
  const outputIdentifier = transfer.kind === 'satoshis' ? 'transferSatoshisOutput' : 'transferFungibleTokensOutput';
  const role = { roleIdentifier: 'sender' };
  const variables =
    transfer.kind === 'satoshis'
      ? [{ variableIdentifier: 'transferredSatoshis', value: transfer.satoshis, ...role }]
      : [
          { variableIdentifier: 'transferredTokenCategory', value: transfer.category, ...role },
          { variableIdentifier: 'transferredTokenAmount', value: transfer.amount, ...role },
        ];
  const created = await engine.createInvitation({ templateIdentifier, actionIdentifier });
  const invitationIdentifier = created.invitation.invitationIdentifier;
  const spendable = await engine.listSpendableUnspentOutputs();
  const plain = plainCoins(spendable)[0];
  const token = transfer.kind === 'tokens' ? tokenCoin(spendable, transfer.category, transfer.amount) : undefined;
  if (plain === undefined || (transfer.kind === 'tokens' && token === undefined)) throw new Error(`the ${actionIdentifier} sender has no suitable coin`);
  await engine.appendInvitation(invitationIdentifier, {
    templateIdentifier,
    actionIdentifier,
    ...role,
    variables: [...variables, { variableIdentifier: 'recipientLockingscript', value: recipientLockingscript, ...role }],
    // The template's token output has no satoshi value; the token coin's own satoshis travel with the tokens.
    outputs: [{ outputIdentifier, ...(token === undefined ? {} : { valueSatoshis: BigInt(token.valueSatoshis) }) }],
    inputs: [token, plain]
      .filter((utxo) => utxo !== undefined)
      .map((utxo) => ({ outpointTransactionHash: hexToBin(utxo.outpointTransactionHash), outpointIndex: utxo.outpointIndex, sequenceNumber: 0, ...role })),
  });
  await engine.addChangeToInvitation(invitationIdentifier);
  await signOwnInputs(account, invitationIdentifier);
  return finishAction(account, invitationIdentifier, broadcast);
};
