import type { Output } from '@bitauth/libauth';
import { hexToBin } from '@bitauth/libauth';
import type { FundingKey } from './accounts.js';
import { buildSpend, type SignedSpend, type Utxo } from './spend.js';

export interface DepositSettings {
  feeRateSatoshisPerByte: number;
  dustSatoshis: number;
}

/**
 * deposit: moves every coin of a funding key into the account's XO engine wallet.
 * Each token coin keeps its own output (same satoshis, category and amount); the plain coins pay the fee and
 * their remainder is the last output. NFT coins are refused by buildSpend.
 */
export const planDeposit = (
  from: FundingKey,
  utxos: Utxo[],
  engineLockingBytecode: Uint8Array,
  settings: DepositSettings,
): SignedSpend => {
  const tokenOutputs: Output[] = utxos
    .filter((utxo) => utxo.token !== undefined)
    .map((utxo) => ({
      lockingBytecode: engineLockingBytecode,
      valueSatoshis: utxo.satoshis,
      token: { category: hexToBin(utxo.token!.category), amount: utxo.token!.amount },
    }));
  return buildSpend({
    privateKey: from.privateKey,
    lockingBytecode: from.lockingBytecode,
    inputs: utxos,
    outputs: tokenOutputs,
    change: { lockingBytecode: engineLockingBytecode, index: tokenOutputs.length },
    feeRateSatoshisPerByte: settings.feeRateSatoshisPerByte,
    dustSatoshis: settings.dustSatoshis,
  });
};
