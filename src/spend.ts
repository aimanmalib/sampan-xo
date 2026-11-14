import {
  binToHex,
  encodeTransactionBch,
  generateTransaction,
  hashTransactionUiOrder,
  hexToBin,
  walletTemplateP2pkhNonHd,
  walletTemplateToCompilerBch,
  type CompilationData,
  type Output,
} from '@bitauth/libauth';

/** An unspent output as the Electrum server reports it. Token amounts are bigint; categories are in display order. */
export interface Utxo {
  txid: string;
  vout: number;
  satoshis: bigint;
  token?: { category: string; amount: bigint; nft?: unknown };
}

export interface SpendRequest {
  /** Private key of the P2PKH coins being spent. */
  privateKey: Uint8Array;
  /** Locking bytecode of those coins. */
  lockingBytecode: Uint8Array;
  inputs: Utxo[];
  outputs: Output[];
  /** Where the change goes, and at which output index it is placed. */
  change: { lockingBytecode: Uint8Array; index: number };
  feeRateSatoshisPerByte: number;
  dustSatoshis: number;
}

export interface SignedSpend {
  hex: string;
  txid: string;
  feeSatoshis: bigint;
  changeSatoshis: bigint;
  outputs: Output[];
}

const compiler = walletTemplateToCompilerBch(walletTemplateP2pkhNonHd);

const generate = (request: SpendRequest, changeSatoshis: bigint) => {
  const outputs = [...request.outputs];
  outputs.splice(request.change.index, 0, { lockingBytecode: request.change.lockingBytecode, valueSatoshis: changeSatoshis });
  const data = { keys: { privateKeys: { key: request.privateKey } } } as CompilationData<never>;
  const generated = generateTransaction({
    version: 2,
    locktime: 0,
    inputs: request.inputs.map((utxo) => ({
      outpointTransactionHash: hexToBin(utxo.txid),
      outpointIndex: utxo.vout,
      sequenceNumber: 0,
      unlockingBytecode: { compiler, data, script: 'unlock', valueSatoshis: utxo.satoshis },
    })),
    outputs,
  });
  if (!generated.success) throw new Error(`transaction generation failed: ${JSON.stringify(generated.errors)}`);
  return { transaction: generated.transaction, outputs };
};

/**
 * Builds and signs a spend of plain P2PKH coins with one change output.
 * Coins that carry tokens are refused: spending them here would burn the tokens.
 */
export const buildSpend = (request: SpendRequest): SignedSpend => {
  if (request.inputs.length === 0) throw new Error('no coins to spend');
  const tokenInput = request.inputs.find((utxo) => utxo.token !== undefined);
  if (tokenInput) throw new Error(`refusing to spend token coin ${tokenInput.txid}:${tokenInput.vout}`);
  const inputTotal = request.inputs.reduce((sum, utxo) => sum + utxo.satoshis, 0n);
  const outputTotal = request.outputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
  // Schnorr signatures have a fixed size, so the size with any change value equals the final size.
  const draft = generate(request, inputTotal - outputTotal);
  const size = BigInt(encodeTransactionBch(draft.transaction).length);
  const feeSatoshis = size * BigInt(request.feeRateSatoshisPerByte);
  const changeSatoshis = inputTotal - outputTotal - feeSatoshis;
  if (changeSatoshis < BigInt(request.dustSatoshis)) {
    throw new Error(`not enough coins: inputs ${inputTotal}, outputs ${outputTotal}, fee ${feeSatoshis}`);
  }
  const final = generate(request, changeSatoshis);
  const encoded = encodeTransactionBch(final.transaction);
  return {
    hex: binToHex(encoded),
    txid: binToHex(hashTransactionUiOrder(encoded)),
    feeSatoshis,
    changeSatoshis,
    outputs: final.outputs,
  };
};
