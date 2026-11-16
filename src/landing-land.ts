import { binToHex, cashAddressToLockingBytecode, hexToBin } from '@bitauth/libauth';
import type { XOInvitationVariable } from '@xo-cash/types';
import type { ChipnetConfig } from './config.js';
import { finishAction, signOwnInputs, type ActionResult } from './swap-open.js';
import type { AccountEngine } from './xo-engine.js';

/** The six landing variables, committed by the payer in `land` and carried by every follow-up action. */
export const landingVariableIdentifiers = ['landedSatoshis', 'ownerLockingScript', 'tokenCategory', 'rateNum', 'rateDen', 'returnAfter'] as const;

/** Locking bytecode (hex) of the owner address in the config. */
export const ownerLockingScriptHex = (config: ChipnetConfig): string => {
  if (config.landing.ownerAddress === null) throw new Error('landing.ownerAddress is not set; add the owner account first');
  const decoded = cashAddressToLockingBytecode(config.landing.ownerAddress);
  if (typeof decoded === 'string') throw new Error(decoded);
  return binToHex(decoded.bytecode);
};

/** The landing variables from the config: the token is the chipnet test token, which stands in for the stablecoin. */
export const landingVariables = (config: ChipnetConfig): XOInvitationVariable[] => {
  if (config.testToken.category === null) throw new Error('testToken.category is not set; run the test token setup first');
  const { landedSatoshis, rateNum, rateDen, returnAfter } = config.landing;
  const values: Record<(typeof landingVariableIdentifiers)[number], XOInvitationVariable['value']> = {
    landedSatoshis: BigInt(landedSatoshis),
    ownerLockingScript: ownerLockingScriptHex(config),
    tokenCategory: config.testToken.category,
    rateNum: BigInt(rateNum),
    rateDen: BigInt(rateDen),
    returnAfter: BigInt(returnAfter),
  };
  return landingVariableIdentifiers.map((variableIdentifier) => ({ variableIdentifier, value: values[variableIdentifier] }));
};

/**
 * land (payer): pays landing.landedSatoshis to the landing locking script of the configured owner. Funded from the
 * largest plain engine coin; the engine adds the change and the fee.
 */
export const landCoin = async (account: AccountEngine, config: ChipnetConfig, broadcast: boolean): Promise<ActionResult> => {
  const { engine, landingTemplateIdentifier: templateIdentifier } = account;
  const template = await engine.getTemplate(templateIdentifier);
  const intent = template?.start?.find((entry) => entry.action === 'land');
  const created = await engine.createInvitation({ templateIdentifier, actionIdentifier: 'land', intent });
  const invitationIdentifier = created.invitation.invitationIdentifier;
  const role = { roleIdentifier: 'payer' };
  const coin = (await engine.listSpendableUnspentOutputs())
    .filter((utxo) => utxo.tokenCategory === undefined)
    .sort((a, b) => b.valueSatoshis - a.valueSatoshis)[0];
  if (coin === undefined) throw new Error('the payer engine wallet has no spendable plain coin; run scripts/deposit.ts maker');
  await engine.appendInvitation(invitationIdentifier, {
    templateIdentifier,
    actionIdentifier: 'land',
    ...role,
    variables: landingVariables(config).map((variable) => ({ ...variable, ...role })),
    outputs: [{ outputIdentifier: 'landingOutput', ...role }],
    inputs: [{ outpointTransactionHash: hexToBin(coin.outpointTransactionHash), outpointIndex: coin.outpointIndex, sequenceNumber: 0, ...role }],
  });
  await engine.addChangeToInvitation(invitationIdentifier);
  await signOwnInputs(account, invitationIdentifier);
  return finishAction(account, invitationIdentifier, broadcast);
};
