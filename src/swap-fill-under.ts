import {
  binToHex,
  decodeAuthenticationInstructions,
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
import type { BuiltConvert } from './landing-under-rate.js';
import { p2pkhUnlockingInput, type Utxo } from './spend.js';

/**
 * One deliberate negative test on chipnet: a fill of a Swap Intent offer that pays the maker one token unit less than
 * wantedAmount. It is built with libauth, outside the XO engine, so that the node is the one that refuses it.
 * Input 0 is the offer coin, unlocked with the fill selector (OP_1) and the redeem bytecode; input 1 is a plain P2PKH
 * token coin of the account that signs it, since the covenant does not check who supplies the tokens.
 */
export interface FillUnderRequest {
  network: Network;
  /** The offer coin: outpoint, satoshis, redeem bytecode (bare) and the P2SH32 locking bytecode it sits at. */
  offer: { txid: string; vout: number; satoshis: bigint; redeem: Uint8Array; lockingBytecode: Uint8Array };
  /** A P2PKH coin holding at least `paidAmount` units of the category, and the key that signs it. */
  tokenCoin: Utxo;
  privateKey: Uint8Array;
  coinLockingBytecode: Uint8Array;
  makerLockingBytecode: Uint8Array;
  /** Category in display order, as Electrum and explorers show it. */
  categoryHex: string;
  paidAmount: bigint;
  /** Satoshis carried by the maker token output (the template's tokenOutputSatoshis). */
  tokenOutputSatoshis: bigint;
  feeSatoshis: bigint;
}

/** Refuses any network but chipnet: this transaction is only ever meant to be refused by a test network node. */
export const assertFillUnderChipnetOnly = (network: Network): void => {
  if (network !== 'chipnet') throw new Error(`fill-under-amount runs on chipnet only, not ${network}`);
};

/** The fill selector of the offer script (OP_1, see fillUnlockingBytecode in the template), then the redeem bytecode. */
export const fillUnlockingBytecode = (redeem: Uint8Array): Uint8Array => flattenBinArray([Uint8Array.of(0x51), encodeDataPush(redeem)]);

/** The redeem bytecode pushed last by input 0 of a fill the engine built (the offer is pay to script hash 32). */
export const redeemFromFill = (serializedTransaction: string): Uint8Array => {
  const transaction = decodeTransactionBch(hexToBin(serializedTransaction));
  if (typeof transaction === 'string') throw new Error(transaction);
  const instructions = decodeAuthenticationInstructions(transaction.inputs[0]!.unlockingBytecode);
  const last = instructions.at(-1);
  const data = last !== undefined && 'data' in last ? last.data : undefined;
  if (instructions.length !== 2 || instructions[0]?.opcode !== 0x51 || !(data instanceof Uint8Array) || data.length === 0) {
    throw new Error('input 0 of the built fill is not the fill selector followed by a redeem bytecode push');
  }
  return data;
};

/**
 * Builds the two-input, two-output fill: output 0 pays the maker `paidAmount` units (the index of the offer input, the
 * only output the covenant checks), output 1 returns the rest of the tokens and all satoshis less the fee to the coin's
 * own locking bytecode, as the taker's payout.
 */
export const buildFill = (request: FillUnderRequest): BuiltConvert => {
  assertFillUnderChipnetOnly(request.network);
  const { offer, tokenCoin } = request;
  if (tokenCoin.token === undefined || tokenCoin.token.category !== request.categoryHex || tokenCoin.token.nft !== undefined) {
    throw new Error(`token coin ${tokenCoin.txid}:${tokenCoin.vout} does not hold fungible tokens of ${request.categoryHex}`);
  }
  if (tokenCoin.token.amount < request.paidAmount) throw new Error(`token coin holds ${tokenCoin.token.amount} units, fewer than ${request.paidAmount}`);
  const category = hexToBin(request.categoryHex);
  const rest = tokenCoin.token.amount - request.paidAmount;
  const outputs: Output[] = [
    { lockingBytecode: request.makerLockingBytecode, valueSatoshis: request.tokenOutputSatoshis, token: { category, amount: request.paidAmount } },
    {
      lockingBytecode: request.coinLockingBytecode,
      valueSatoshis: offer.satoshis + tokenCoin.satoshis - request.tokenOutputSatoshis - request.feeSatoshis,
      ...(rest > 0n ? { token: { category, amount: rest } } : {}),
    },
  ];
  const generated = generateTransaction({
    version: 2,
    locktime: 0,
    inputs: [
      { outpointTransactionHash: hexToBin(offer.txid), outpointIndex: offer.vout, sequenceNumber: 0, unlockingBytecode: fillUnlockingBytecode(offer.redeem) },
      p2pkhUnlockingInput(tokenCoin, request.privateKey),
    ],
    outputs,
  });
  if (!generated.success) throw new Error(`transaction generation failed: ${JSON.stringify(generated.errors)}`);
  const encoded = encodeTransactionBch(generated.transaction);
  const sourceOutputs: Output[] = [
    { lockingBytecode: offer.lockingBytecode, valueSatoshis: offer.satoshis },
    { lockingBytecode: request.coinLockingBytecode, valueSatoshis: tokenCoin.satoshis, token: { category, amount: tokenCoin.token.amount } },
  ];
  return { hex: binToHex(encoded), txid: binToHex(hashTransactionUiOrder(encoded)), sourceOutputs };
};
