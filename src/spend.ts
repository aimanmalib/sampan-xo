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
      unlockingBytecode: {
        compiler,
        data,
        script: 'unlock',
        valueSatoshis: utxo.satoshis,
        // The signed message covers the token of the spent output, so token coins need it here.
        ...(utxo.token ? { token: { category: hexToBin(utxo.token.category), amount: utxo.token.amount } } : {}),
      },
    })),
    outputs,
  });
  if (!generated.success) throw new Error(`transaction generation failed: ${JSON.stringify(generated.errors)}`);
  return { transaction: generated.transaction, outputs };
};

/**
 * Refuses a spend that would burn tokens: every fungible token amount carried by the inputs must be carried by the
 * outputs, per category. Coins with NFTs are refused. New categories in the outputs (a token genesis) are allowed.
 */
const assertNoTokenBurn = (inputs: Utxo[], outputs: Output[]): void => {
  const outputAmounts = new Map<string, bigint>();
  for (const output of outputs) {
    if (output.token === undefined) continue;
    const category = binToHex(output.token.category);
    outputAmounts.set(category, (outputAmounts.get(category) ?? 0n) + output.token.amount);
  }
  const inputAmounts = new Map<string, bigint>();
  for (const utxo of inputs) {
    if (utxo.token === undefined) continue;
    if (utxo.token.nft !== undefined) throw new Error(`refusing to spend NFT coin ${utxo.txid}:${utxo.vout}`);
    inputAmounts.set(utxo.token.category, (inputAmounts.get(utxo.token.category) ?? 0n) + utxo.token.amount);
  }
  for (const [category, amount] of inputAmounts) {
    if (outputAmounts.get(category) !== amount) {
      throw new Error(`refusing to spend token coins of ${category}: inputs carry ${amount}, outputs ${outputAmounts.get(category) ?? 0n}`);
    }
  }
};

/**
 * Builds and signs a spend of P2PKH coins with one change output.
 * Token coins are spent only when the outputs carry the same token amounts, so a spend cannot burn tokens.
 */
export const buildSpend = (request: SpendRequest): SignedSpend => {
  if (request.inputs.length === 0) throw new Error('no coins to spend');
  assertNoTokenBurn(request.inputs, request.outputs);
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
