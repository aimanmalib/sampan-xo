import {
  deriveHdPath,
  deriveHdPrivateNodeFromBip39Mnemonic,
  encodeLockingBytecodeP2pkh,
  hash160,
  privateKeyToP2pkhCashAddress,
  secp256k1,
} from '@bitauth/libauth';
import type { ChipnetConfig } from './config.js';

export interface FundingKey {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  lockingBytecode: Uint8Array;
  address: string;
  tokenAddress: string;
}

/**
 * Derives the plain P2PKH funding key of one account. It holds test coins and test tokens outside XO;
 * the XO engine derives its own keys from the same phrase under its own purpose path.
 */
export const deriveFundingKey = (mnemonic: string, config: ChipnetConfig): FundingKey => {
  const root = deriveHdPrivateNodeFromBip39Mnemonic(mnemonic);
  const node = deriveHdPath(root, config.fundingDerivationPath);
  if (!('privateKey' in node)) throw new Error('derivation did not produce a private node');
  const privateKey = node.privateKey;
  const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);
  if (typeof publicKey === 'string') throw new Error(publicKey);
  const prefix = config.addressPrefix;
  const address = privateKeyToP2pkhCashAddress({ privateKey, prefix }).address;
  const tokenAddress = privateKeyToP2pkhCashAddress({ privateKey, prefix, tokenSupport: true }).address;
  return { privateKey, publicKey, lockingBytecode: encodeLockingBytecodeP2pkh(hash160(publicKey)), address, tokenAddress };
};
