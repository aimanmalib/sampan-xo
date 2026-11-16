/**
 * Offline harness for the Landing covenant: builds a libauth compiler from the template's own scripts, generates
 * convert and giveBack transactions, and evaluates them in the BCH 2026 virtual machine (standard rules).
 * Keys and P2PKH helpers are shared with the Swap Intent harness.
 */
import {
  bigIntToVmNumber,
  createCompilerBch,
  createVirtualMachineBch2026,
  generateTransaction,
  hexToBin,
  walletTemplateP2pkhNonHd,
  walletTemplateToCompilerBch,
  vmNumberToBigInt,
  type CompilationData,
  type CompilerBch,
  type Output,
} from '@bitauth/libauth';
import { landingTemplate as template } from '../../template/landing.js';
import {
  makerPrivateKey,
  otherCategoryHex,
  p2pkhLockingBytecode,
  strangerPrivateKey,
  takerPrivateKey,
  wantedCategoryHex,
} from './swap-vm.js';

export const lockingScriptId = template.lockingScripts.landingLockingScript.lockingBytecode;

export const ownerLockingBytecode = p2pkhLockingBytecode(makerPrivateKey);
export const converterLockingBytecode = p2pkhLockingBytecode(takerPrivateKey);
export const strangerLockingBytecode = p2pkhLockingBytecode(strangerPrivateKey);

/** Display byte order, as a block explorer shows it. libauth keeps `token.category` in this order too. */
export const tokenCategoryHex = wantedCategoryHex;
export { otherCategoryHex };

export interface Landing {
  landedSatoshis: bigint;
  ownerLockingScript: Uint8Array;
  tokenCategoryHex: string;
  rateNum: bigint;
  rateDen: bigint;
  returnAfter: bigint;
}

export const defaultLanding: Landing = {
  landedSatoshis: 10_000n,
  ownerLockingScript: ownerLockingBytecode,
  tokenCategoryHex,
  rateNum: 1n,
  rateDen: 100n,
  returnAfter: 6n,
};

const constants = Object.fromEntries(
  Object.entries(template.constants).map(([id, c]) => [id, bigIntToVmNumber(c.value)]),
);

export const landingCompiler: CompilerBch = createCompilerBch({
  scripts: template.scripts,
  variables: Object.fromEntries(
    [...Object.keys(template.variables), ...Object.keys(template.constants)].map((id) => [id, { type: 'WalletData' }]),
  ) as never,
  lockingScriptTypes: { [lockingScriptId]: 'p2sh32' },
  unlockingScripts: { convertUnlockingBytecode: lockingScriptId, giveBackUnlockingBytecode: lockingScriptId },
});

export const landingData = (landing: Landing, extra: Record<string, bigint> = {}): CompilationData<never> => ({
  bytecode: {
    ...constants,
    landedSatoshis: bigIntToVmNumber(landing.landedSatoshis),
    ownerLockingScript: landing.ownerLockingScript,
    tokenCategory: hexToBin(landing.tokenCategoryHex),
    rateNum: bigIntToVmNumber(landing.rateNum),
    rateDen: bigIntToVmNumber(landing.rateDen),
    returnAfter: bigIntToVmNumber(landing.returnAfter),
    ...Object.fromEntries(Object.entries(extra).map(([id, value]) => [id, bigIntToVmNumber(value)])),
  },
});

const compile = (scriptId: string, data: CompilationData<never>): Uint8Array => {
  const result = landingCompiler.generateBytecode({ data, scriptId });
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.bytecode;
};

export const landingLockingBytecode = (landing: Landing = defaultLanding): Uint8Array =>
  compile(lockingScriptId, landingData(landing));

/** Evaluates one of the template's computed scripts (for example `convertTokenAmount`) to a number. */
export const evaluateNumber = (scriptId: string, landing: Landing, extra: Record<string, bigint> = {}): bigint => {
  const bytecode = compile(scriptId, landingData(landing, extra));
  const state = createVirtualMachineBch2026(false).evaluate({
    sourceOutputs: [{ lockingBytecode: bytecode, valueSatoshis: 0n }],
    transaction: {
      version: 2,
      locktime: 0,
      inputs: [{ outpointTransactionHash: new Uint8Array(32), outpointIndex: 0, sequenceNumber: 0, unlockingBytecode: new Uint8Array() }],
      outputs: [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 0n }],
    },
    inputIndex: 0,
  });
  const top = state.stack[state.stack.length - 1];
  if (top === undefined) throw new Error(`no result for ${scriptId}: ${state.error ?? 'empty stack'}`);
  const value = vmNumberToBigInt(top);
  if (typeof value === 'string') throw new Error(value);
  return value;
};

const p2pkhCompiler: CompilerBch = walletTemplateToCompilerBch(walletTemplateP2pkhNonHd);

const outpoint = (byte: string, index: number, sequenceNumber = 0) => ({
  outpointTransactionHash: hexToBin(byte.repeat(32)),
  outpointIndex: index,
  sequenceNumber,
});

const landingInput = (landing: Landing, script: 'convertUnlockingBytecode' | 'giveBackUnlockingBytecode', sequence = 0) => ({
  ...outpoint('aa', 0, sequence),
  unlockingBytecode: { compiler: landingCompiler, data: landingData(landing), script, valueSatoshis: landing.landedSatoshis },
});

const landingSource = (landing: Landing): Output => ({
  lockingBytecode: landingLockingBytecode(landing),
  valueSatoshis: landing.landedSatoshis,
});

export interface ConvertShape {
  ownerLockingBytecode: Uint8Array;
  categoryHex: string;
  ownerTokens: bigint;
  /** Input index of the landing coin. The converter token coin takes the other of inputs 0 and 1. */
  landingInputIndex?: 0 | 1;
  /** Adds a third output (plain change to the converter). */
  extraOutput?: boolean;
}

export const validConvert = (landing: Landing = defaultLanding): ConvertShape => ({
  ownerLockingBytecode: landing.ownerLockingScript,
  categoryHex: landing.tokenCategoryHex,
  ownerTokens: evaluateNumber('convertTokenAmount', landing),
});

const converterCoinSatoshis = 10_000n;
const converterCoinTokens = 1_000_000n;
const tokenOutputSatoshis = template.constants.tokenOutputSatoshis.value;
const convertFee = 1_000n;

/** Builds a convert: the landing coin and one converter token coin (P2PKH). Returns the VM verdict (true or error text). */
export const verifyConvert = (shape: ConvertShape, landing: Landing = defaultLanding): string | true => {
  const coinToken = { amount: converterCoinTokens, category: hexToBin(shape.categoryHex) };
  const converterSource: Output = { lockingBytecode: converterLockingBytecode, valueSatoshis: converterCoinSatoshis, token: coinToken };
  const converterInput = {
    ...outpoint('bb', 1),
    unlockingBytecode: {
      compiler: p2pkhCompiler,
      data: { keys: { privateKeys: { key: takerPrivateKey } } } as CompilationData<never>,
      script: 'unlock',
      valueSatoshis: converterCoinSatoshis,
      token: coinToken,
    },
  };
  const payoutSatoshis = landing.landedSatoshis + converterCoinSatoshis - tokenOutputSatoshis - convertFee;
  const outputs: Output[] = [
    {
      lockingBytecode: shape.ownerLockingBytecode,
      valueSatoshis: tokenOutputSatoshis,
      token: { amount: shape.ownerTokens, category: hexToBin(shape.categoryHex) },
    },
    {
      lockingBytecode: converterLockingBytecode,
      valueSatoshis: shape.extraOutput ? payoutSatoshis - 1_000n : payoutSatoshis,
      token: { amount: converterCoinTokens - shape.ownerTokens, category: hexToBin(shape.categoryHex) },
    },
  ];
  if (shape.extraOutput) outputs.push({ lockingBytecode: converterLockingBytecode, valueSatoshis: 1_000n });
  const landingFirst = (shape.landingInputIndex ?? 0) === 0;
  const input = landingInput(landing, 'convertUnlockingBytecode');
  const generated = generateTransaction({
    version: 2,
    locktime: 0,
    inputs: landingFirst ? [input, converterInput] : [converterInput, input],
    outputs,
  });
  if (!generated.success) return `generation failed: ${JSON.stringify(generated.errors)}`;
  const sourceOutputs = landingFirst ? [landingSource(landing), converterSource] : [converterSource, landingSource(landing)];
  return createVirtualMachineBch2026(true).verify({ sourceOutputs, transaction: generated.transaction });
};

export interface GiveBackShape {
  sequenceNumber: number;
  outputs: Output[];
}

export const validGiveBack = (landing: Landing = defaultLanding, fee = 500n): GiveBackShape => ({
  sequenceNumber: Number(landing.returnAfter),
  outputs: [{ lockingBytecode: landing.ownerLockingScript, valueSatoshis: landing.landedSatoshis - fee }],
});

/** Builds a giveBack: input 0 = landing coin with `sequenceNumber`, the given outputs. Returns the VM verdict. */
export const verifyGiveBack = (shape: GiveBackShape, landing: Landing = defaultLanding): string | true => {
  const generated = generateTransaction({
    version: 2,
    locktime: 0,
    inputs: [landingInput(landing, 'giveBackUnlockingBytecode', shape.sequenceNumber)],
    outputs: shape.outputs,
  });
  if (!generated.success) return `generation failed: ${JSON.stringify(generated.errors)}`;
  return createVirtualMachineBch2026(true).verify({ sourceOutputs: [landingSource(landing)], transaction: generated.transaction });
};
