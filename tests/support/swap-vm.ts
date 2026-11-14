/**
 * Offline harness for the Swap Intent covenant: builds a libauth compiler from the template's own scripts,
 * generates fill and cancel transactions, and evaluates them in the BCH 2026 virtual machine (standard rules).
 */
import {
  bigIntToVmNumber,
  createCompilerBch,
  createVirtualMachineBch2026,
  generateTransaction,
  hexToBin,
  secp256k1,
  walletTemplateP2pkhNonHd,
  walletTemplateToCompilerBch,
  type CompilationData,
  type CompilerBch,
  type Output,
} from '@bitauth/libauth';
import { swapIntentTemplate as template } from '../../template/swap-intent.js';

export const lockingScriptId = template.lockingScripts.offerLockingScript.lockingBytecode;

/** Fixed test keys. Never used on any network. */
export const makerPrivateKey = hexToBin('11'.repeat(32));
export const takerPrivateKey = hexToBin('22'.repeat(32));
export const strangerPrivateKey = hexToBin('33'.repeat(32));

const p2pkhCompiler: CompilerBch = walletTemplateToCompilerBch(walletTemplateP2pkhNonHd);

export const p2pkhLockingBytecode = (privateKey: Uint8Array): Uint8Array => {
  const result = p2pkhCompiler.generateBytecode({ data: { keys: { privateKeys: { key: privateKey } } }, scriptId: 'lock' });
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.bytecode;
};

export const makerLockingBytecode = p2pkhLockingBytecode(makerPrivateKey);
export const takerLockingBytecode = p2pkhLockingBytecode(takerPrivateKey);

/** Display byte order, as a block explorer shows it. */
export const wantedCategoryHex = 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';
export const otherCategoryHex = 'ff'.repeat(32);
/** libauth keeps `token.category` in display order and reverses it when encoding. */
const category = (hex: string): Uint8Array => hexToBin(hex);

export interface Offer {
  offeredSatoshis: bigint;
  wantedCategoryHex: string;
  wantedAmount: bigint;
  makerLockingScript: Uint8Array;
}

export const defaultOffer: Offer = {
  offeredSatoshis: 50_000n,
  wantedCategoryHex,
  wantedAmount: 1_000n,
  makerLockingScript: makerLockingBytecode,
};

const variableTypes = Object.fromEntries(
  Object.entries(template.variables).map(([id, v]) => [id, { ...v, type: v.type === 'private_key' ? 'Key' : 'WalletData' }]),
);

export const offerCompiler: CompilerBch = createCompilerBch({
  scripts: template.scripts,
  variables: variableTypes as never,
  lockingScriptTypes: { [lockingScriptId]: 'p2sh32' },
  unlockingScripts: { fillUnlockingBytecode: lockingScriptId, cancelUnlockingBytecode: lockingScriptId },
});

export const offerData = (offer: Offer, signingKey: Uint8Array = makerPrivateKey): CompilationData<never> => ({
  bytecode: {
    offeredSatoshis: bigIntToVmNumber(offer.offeredSatoshis),
    wantedCategory: hexToBin(offer.wantedCategoryHex),
    wantedAmount: bigIntToVmNumber(offer.wantedAmount),
    makerLockingScript: offer.makerLockingScript,
  },
  keys: { privateKeys: { makerKey: signingKey } },
});

/**
 * Compilation data where `signingKey` signs, but the offer script (and the public key pushed for the cancel path) stays the
 * maker's: models someone else trying to cancel a real offer.
 */
export const forgedCancelData = (offer: Offer, signingKey: Uint8Array): CompilationData<never> => {
  const data = offerData(offer, signingKey);
  return { ...data, bytecode: { ...data.bytecode, 'makerKey.public_key': hexToBin(publicKeyHex(makerPrivateKey)) } };
};

export const offerLockingBytecode = (offer: Offer = defaultOffer): Uint8Array => {
  const result = offerCompiler.generateBytecode({ data: offerData(offer), scriptId: lockingScriptId });
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.bytecode;
};

const outpoint = (byte: string, index: number) => ({
  outpointTransactionHash: hexToBin(byte.repeat(32)),
  outpointIndex: index,
  sequenceNumber: 0,
});

export interface FillShape {
  /** Output index the maker payment is placed at. The covenant expects 0 (same as the offer input). */
  paymentIndex: number;
  paymentLockingBytecode: Uint8Array;
  paymentCategoryHex: string;
  paymentAmount: bigint;
  /** Input index of the offer. The taker token coin takes the other of inputs 0 and 1. */
  offerInputIndex?: 0 | 1;
}

export const validFill = (offer: Offer = defaultOffer): FillShape => ({
  paymentIndex: 0,
  paymentLockingBytecode: offer.makerLockingScript,
  paymentCategoryHex: offer.wantedCategoryHex,
  paymentAmount: offer.wantedAmount,
});

const takerTokenSatoshis = 10_000n;
const tokenOutputSatoshis = template.constants.tokenOutputSatoshis.value;

/** Builds a fill: the offer and one taker token coin (P2PKH), in the order `offerInputIndex` selects. Returns the VM verdict (true or error text). */
export const verifyFill = (shape: FillShape, offer: Offer = defaultOffer): string | true => {
  const takerTokens = { amount: shape.paymentAmount, category: category(shape.paymentCategoryHex) };
  const offerSource: Output = { lockingBytecode: offerLockingBytecode(offer), valueSatoshis: offer.offeredSatoshis };
  const takerSource: Output = { lockingBytecode: takerLockingBytecode, valueSatoshis: takerTokenSatoshis, token: takerTokens };
  const payment: Output = {
    lockingBytecode: shape.paymentLockingBytecode,
    valueSatoshis: tokenOutputSatoshis,
    token: takerTokens,
  };
  const payout: Output = { lockingBytecode: takerLockingBytecode, valueSatoshis: offer.offeredSatoshis };
  const outputs = shape.paymentIndex === 0 ? [payment, payout] : [payout, payment];
  const offerInput = {
    ...outpoint('aa', 0),
    unlockingBytecode: {
      compiler: offerCompiler,
      data: offerData(offer),
      script: 'fillUnlockingBytecode',
      valueSatoshis: offer.offeredSatoshis,
    },
  };
  const takerInput = {
    ...outpoint('bb', 1),
    unlockingBytecode: {
      compiler: p2pkhCompiler,
      data: { keys: { privateKeys: { key: takerPrivateKey } } } as CompilationData<never>,
      script: 'unlock',
      valueSatoshis: takerTokenSatoshis,
      token: takerTokens,
    },
  };
  const offerFirst = (shape.offerInputIndex ?? 0) === 0;
  const generated = generateTransaction({
    version: 2,
    locktime: 0,
    inputs: offerFirst ? [offerInput, takerInput] : [takerInput, offerInput],
    outputs,
  });
  if (!generated.success) return `generation failed: ${JSON.stringify(generated.errors)}`;
  const sourceOutputs = offerFirst ? [offerSource, takerSource] : [takerSource, offerSource];
  return createVirtualMachineBch2026(true).verify({ sourceOutputs, transaction: generated.transaction });
};

/**
 * Builds a cancel: input 0 = offer, output 0 = refund to the maker. `signingKey` signs the input; `unlockingScript`
 * selects the path (the template's cancel script, or the fill script to model an unsigned spend to anyone).
 */
export const verifyCancel = (
  signingKey: Uint8Array,
  unlockingScript: 'cancelUnlockingBytecode' | 'fillUnlockingBytecode' = 'cancelUnlockingBytecode',
  offer: Offer = defaultOffer,
  refundLockingBytecode: Uint8Array = offer.makerLockingScript,
): string | true => {
  const sourceOutputs: Output[] = [{ lockingBytecode: offerLockingBytecode(offer), valueSatoshis: offer.offeredSatoshis }];
  const refund = offer.offeredSatoshis - template.constants.cancelFeeSatoshis.value;
  const generated = generateTransaction({
    version: 2,
    locktime: 0,
    inputs: [
      {
        ...outpoint('cc', 0),
        unlockingBytecode: {
          compiler: offerCompiler,
          data: signingKey === makerPrivateKey ? offerData(offer) : forgedCancelData(offer, signingKey),
          script: unlockingScript,
          valueSatoshis: offer.offeredSatoshis,
        },
      },
    ],
    outputs: [{ lockingBytecode: refundLockingBytecode, valueSatoshis: refund }],
  });
  if (!generated.success) return `generation failed: ${JSON.stringify(generated.errors)}`;
  return createVirtualMachineBch2026(true).verify({ sourceOutputs, transaction: generated.transaction });
};

export const publicKeyHex = (privateKey: Uint8Array): string => {
  const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);
  if (typeof publicKey === 'string') throw new Error(publicKey);
  return Buffer.from(publicKey).toString('hex');
};
