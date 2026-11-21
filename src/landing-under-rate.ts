import {
  binToHex,
  createVirtualMachineBch2026,
  decodeTransactionBch,
  encodeDataPush,
  encodeTransactionBch,
  flattenBinArray,
  generateTransaction,
  hashTransactionUiOrder,
  hexToBin,
  type Output,
} from '@bitauth/libauth';
import type { Network } from './landing-network.js';
import { p2pkhUnlockingInput, type Utxo } from './spend.js';

/**
 * One deliberate negative test on chipnet: a convert of a landed coin that pays the owner one token unit less than
 * the covenant's minimum. It is built with libauth, outside the XO engine, so that the node is the one that refuses it.
 * The landed coin is spent with the convert selector (OP_0) and the redeem bytecode; the token coin is a plain P2PKH
 * coin of whichever account signs it, since the covenant does not check who supplies the tokens.
 */
export interface UnderRateRequest {
  network: Network;
  /** The landed coin: outpoint, satoshis, redeem bytecode of the landing script (bare, not wrapped). */
  landed: { txid: string; vout: number; satoshis: bigint; redeem: Uint8Array; lockingBytecode: Uint8Array };
  /** A P2PKH coin holding at least ownerTokens units of the category, and the key that signs it. */
  tokenCoin: Utxo;
  privateKey: Uint8Array;
  coinLockingBytecode: Uint8Array;
  ownerLockingBytecode: Uint8Array;
  /** Category in display order, as Electrum and explorers show it. */
  categoryHex: string;
  ownerTokens: bigint;
  /** Satoshis carried by the owner token output (the template's tokenOutputSatoshis). */
  tokenOutputSatoshis: bigint;
  feeSatoshis: bigint;
}

export interface BuiltConvert {
  hex: string;
  txid: string;
  sourceOutputs: Output[];
}

/** Refuses any network but chipnet: this transaction is only ever meant to be refused by a test network node. */
export const assertChipnetOnly = (network: Network): void => {
  if (network !== 'chipnet') throw new Error(`convert-under-rate runs on chipnet only, not ${network}`);
};

/** Unlocking bytecode of a landed coin for convert: the cashc function selector 0, then the redeem bytecode. */
export const convertUnlockingBytecode = (redeem: Uint8Array): Uint8Array => flattenBinArray([Uint8Array.of(0x00), encodeDataPush(redeem)]);

/**
 * Builds the two-input, two-output convert: output 0 pays the owner `ownerTokens` units, output 1 returns the rest of
 * the tokens and all satoshis less the fee to the coin's own locking bytecode.
 */
export const buildConvert = (request: UnderRateRequest): BuiltConvert => {
  assertChipnetOnly(request.network);
  const { landed, tokenCoin } = request;
  if (tokenCoin.token === undefined || tokenCoin.token.category !== request.categoryHex || tokenCoin.token.nft !== undefined) {
    throw new Error(`token coin ${tokenCoin.txid}:${tokenCoin.vout} does not hold fungible tokens of ${request.categoryHex}`);
  }
  if (tokenCoin.token.amount < request.ownerTokens) throw new Error(`token coin holds ${tokenCoin.token.amount} units, fewer than ${request.ownerTokens}`);
  const category = hexToBin(request.categoryHex);
  const outputs: Output[] = [
    { lockingBytecode: request.ownerLockingBytecode, valueSatoshis: request.tokenOutputSatoshis, token: { category, amount: request.ownerTokens } },
    {
      lockingBytecode: request.coinLockingBytecode,
      valueSatoshis: landed.satoshis + tokenCoin.satoshis - request.tokenOutputSatoshis - request.feeSatoshis,
      token: { category, amount: tokenCoin.token.amount - request.ownerTokens },
    },
  ];
  const generated = generateTransaction({
    version: 2,
    locktime: 0,
    inputs: [
      { outpointTransactionHash: hexToBin(landed.txid), outpointIndex: landed.vout, sequenceNumber: 0, unlockingBytecode: convertUnlockingBytecode(landed.redeem) },
      p2pkhUnlockingInput(tokenCoin, request.privateKey),
    ],
    outputs,
  });
  if (!generated.success) throw new Error(`transaction generation failed: ${JSON.stringify(generated.errors)}`);
  const encoded = encodeTransactionBch(generated.transaction);
  const sourceOutputs: Output[] = [
    { lockingBytecode: landed.lockingBytecode, valueSatoshis: landed.satoshis },
    { lockingBytecode: request.coinLockingBytecode, valueSatoshis: tokenCoin.satoshis, token: { category, amount: tokenCoin.token.amount } },
  ];
  return { hex: binToHex(encoded), txid: binToHex(hashTransactionUiOrder(encoded)), sourceOutputs };
};

/** Verifies a built transaction in the libauth BCH 2026 virtual machine (standard rules): true, or the VM's message. */
export const verifyLocally = ({ hex, sourceOutputs }: BuiltConvert): true | string => {
  const transaction = decodeTransactionBch(hexToBin(hex));
  if (typeof transaction === 'string') return transaction;
  const result = createVirtualMachineBch2026(true).verify({ sourceOutputs, transaction });
  return result === true ? true : String(result);
};
