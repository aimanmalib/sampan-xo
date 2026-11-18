/**
 * Proof that the Landing template is a faithful port: for the parameters of a Sampan landing address that was spent on
 * mainnet, the template compiles to the same redeem bytecode as the deployed contract and as cashc's own output
 * (constructor arguments in front of the artifact bytecode). Reads committed fixtures only; no network.
 */
import {
  OpcodesBch,
  binToHex,
  bigIntToVmNumber,
  cashAddressToLockingBytecode,
  decodeAuthenticationInstructions,
  decodeTransaction,
  encodeDataPush,
  flattenBinArray,
  hash160,
  hash256,
  hexToBin,
  isPushOperation,
  vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileLockingBytecodeFromTemplateLockingScriptIdentifier } from '@xo-cash/engine';
import type { XOTemplate } from '@xo-cash/types';
import { parseTemplate } from '@xo-cash/utils';
import { landingTemplate } from '../template/landing.js';

/** Contract parameters. `category` (the template variable `tokenCategory`) is in display order, as block explorers show it. */
export interface LandingParams {
  ownerLockingScript: string;
  category: string;
  rateNum: number;
  rateDen: number;
  returnAfter: number;
}

export interface DeployedFixture {
  txid: string;
  rawTx: string;
  input: number;
  prevTxid: string;
  prevRawTx: string;
  redeemBytecode: string;
  prevoutLockingBytecode: string;
  /** The category is stored in both byte orders, so the fixture states which one cashc pushed. */
  params: Omit<LandingParams, 'category'> & { tokenCategory: { displayOrder: string; transactionOrder: string } };
}

/** The parameters a fixture states, in the form the template and cashc functions take. */
export const fixtureParams = (fixture: DeployedFixture): LandingParams => {
  const { tokenCategory, ...rest } = fixture.params;
  if (reverseHex(tokenCategory.displayOrder) !== tokenCategory.transactionOrder) throw new Error('fixture category orders disagree');
  return { ...rest, category: tokenCategory.displayOrder };
};

export interface CashcArtifact {
  bytecode: string;
  constructorInputs: { name: string; type: string }[];
}

const reverseHex = (hex: string): string => binToHex(hexToBin(hex).reverse());

type Instruction = ReturnType<typeof decodeAuthenticationInstructions>[number];

/** The data an instruction pushes; OP_1 to OP_16 push their number. Anything else is not a push. */
const pushData = (instruction: Instruction): Uint8Array => {
  if (instruction.opcode >= OpcodesBch.OP_1 && instruction.opcode <= OpcodesBch.OP_16) {
    return Uint8Array.of(instruction.opcode - OpcodesBch.OP_1 + 1);
  }
  if (!isPushOperation(instruction.opcode) || !('data' in instruction)) throw new Error(`not a push: opcode ${instruction.opcode}`);
  return instruction.data;
};

const pushes = (bytecode: Uint8Array): Uint8Array[] => decodeAuthenticationInstructions(bytecode).map(pushData);

const vmInt = (bytes: Uint8Array): number => {
  const value = vmNumberToBigInt(bytes);
  if (typeof value === 'string') throw new Error(value);
  return Number(value);
};

/** Reads the five constructor pushes that cashc places in front of the contract bytecode. */
export const paramsFromRedeem = (redeem: Uint8Array): LandingParams => {
  const [returnAfter, rateDen, rateNum, category, owner] = decodeAuthenticationInstructions(redeem).slice(0, 5).map(pushData);
  if (owner === undefined || category === undefined || rateNum === undefined || rateDen === undefined || returnAfter === undefined) {
    throw new Error('redeem bytecode is too short');
  }
  return {
    ownerLockingScript: binToHex(owner),
    category: reverseHex(binToHex(category)),
    rateNum: vmInt(rateNum),
    rateDen: vmInt(rateDen),
    returnAfter: vmInt(returnAfter),
  };
};

/** cashc ASM to bytecode: `OP_*` names are opcodes, anything else is hex data pushed minimally. */
export const cashcAsmToBytecode = (asm: string): Uint8Array =>
  flattenBinArray(
    asm
      .trim()
      .split(/\s+/)
      .map((token) => {
        if (token.startsWith('OP_')) {
          const opcode = (OpcodesBch as unknown as Record<string, number>)[token];
          if (opcode === undefined) throw new Error(`unknown opcode ${token}`);
          return Uint8Array.of(opcode);
        }
        if (!/^([0-9a-f]{2})+$/.test(token)) throw new Error(`bad asm token ${token}`);
        return encodeDataPush(hexToBin(token));
      }),
  );

/** The redeem bytecode cashc builds for these parameters: arguments pushed last first, then the artifact bytecode. */
export const cashcRedeem = (artifact: CashcArtifact, params: LandingParams): Uint8Array => {
  const names = artifact.constructorInputs.map((input) => input.name).join(',');
  if (names !== 'ownerLock,tokenCategory,rateNum,rateDen,returnAfter') throw new Error(`unexpected constructor ${names}`);
  const args = [
    hexToBin(params.ownerLockingScript),
    hexToBin(reverseHex(params.category)),
    bigIntToVmNumber(BigInt(params.rateNum)),
    bigIntToVmNumber(BigInt(params.rateDen)),
    bigIntToVmNumber(BigInt(params.returnAfter)),
  ];
  return flattenBinArray([...args.reverse().map((arg) => encodeDataPush(arg)), cashcAsmToBytecode(artifact.bytecode)]);
};

const engineVariables = (params: LandingParams) => ({
  ownerLockingScript: params.ownerLockingScript,
  tokenCategory: params.category,
  rateNum: BigInt(params.rateNum),
  rateDen: BigInt(params.rateDen),
  returnAfter: BigInt(params.returnAfter),
});

/**
 * Compiles the template's landing script in the XO engine. `wrapped: false` compiles it as a bare script (the redeem
 * bytecode); `wrapped: true` uses the template's own `p2sh` type (the P2SH32 locking bytecode the engine pays to).
 */
export const templateLandingBytecode = (params: LandingParams, wrapped: boolean, template: XOTemplate = landingTemplate): Uint8Array => {
  const parsed = parseTemplate(template) as XOTemplate;
  const lockingScript = parsed.lockingScripts.landingLockingScript;
  if (lockingScript === undefined) throw new Error('template has no landingLockingScript');
  const used = wrapped
    ? parsed
    : { ...parsed, lockingScripts: { ...parsed.lockingScripts, landingLockingScript: { ...lockingScript, lockingType: 'p2s' as const } } };
  return compileLockingBytecodeFromTemplateLockingScriptIdentifier(used, 'landingLockingScript', engineVariables(params));
};

export interface BytecodeReport {
  txid: string;
  deployedRedeem: string;
  templateRedeem: string;
  cashcRedeem: string;
  templateLocking: string;
  identical: boolean;
}

/** Checks the fixture against itself (txid, redeem push, prevout hash), then compares the three redeem bytecodes. */
export const checkDeployed = (fixture: DeployedFixture, artifact: CashcArtifact, template: XOTemplate = landingTemplate): BytecodeReport => {
  const raw = hexToBin(fixture.rawTx);
  if (reverseHex(binToHex(hash256(raw))) !== fixture.txid) throw new Error('rawTx does not hash to txid');
  const tx = decodeTransaction(raw);
  if (typeof tx === 'string') throw new Error(tx);
  const input = tx.inputs[fixture.input];
  if (input === undefined) throw new Error(`no input ${fixture.input}`);
  const redeem = pushes(input.unlockingBytecode).at(-1);
  if (redeem === undefined || binToHex(redeem) !== fixture.redeemBytecode) throw new Error('redeemBytecode is not the last push of the input');
  const prev = hexToBin(fixture.prevRawTx);
  // libauth keeps outpoint hashes in display order, the same order as a txid.
  if (reverseHex(binToHex(hash256(prev))) !== binToHex(input.outpointTransactionHash)) {
    throw new Error('prevRawTx is not the transaction the input spends');
  }
  const prevTx = decodeTransaction(prev);
  if (typeof prevTx === 'string') throw new Error(prevTx);
  const prevout = prevTx.outputs[input.outpointIndex];
  if (prevout === undefined || binToHex(prevout.lockingBytecode) !== fixture.prevoutLockingBytecode) {
    throw new Error('prevoutLockingBytecode is not the spent output');
  }
  if (fixture.prevoutLockingBytecode !== `a914${binToHex(hash160(redeem))}87`) throw new Error('hash160(redeem) is not in the prevout');
  const params = fixtureParams(fixture);
  const fromRedeem = paramsFromRedeem(redeem);
  if ((Object.keys(params) as (keyof LandingParams)[]).some((key) => params[key] !== fromRedeem[key])) {
    throw new Error('params do not match the redeem pushes');
  }
  return compareRedeems(params, artifact, template, fixture.redeemBytecode, fixture.txid);
};

/** Compares the template and cashc redeem bytecode for any parameters, and the deployed one when given. */
export const compareRedeems = (
  params: LandingParams,
  artifact: CashcArtifact,
  template: XOTemplate = landingTemplate,
  deployedRedeem = '',
  txid = '',
): BytecodeReport => {
  const templateRedeem = binToHex(templateLandingBytecode(params, false, template));
  const fromCashc = binToHex(cashcRedeem(artifact, params));
  const identical = templateRedeem === fromCashc && (deployedRedeem === '' || deployedRedeem === templateRedeem);
  return {
    txid,
    deployedRedeem,
    templateRedeem,
    cashcRedeem: fromCashc,
    templateLocking: binToHex(templateLandingBytecode(params, true, template)),
    identical,
  };
};

/** Landing parameters from the `landing` section of a network config (chipnet or mainnet). */
export const paramsFromConfig = (landing: {
  ownerAddress: string | null;
  category: string | null;
  rateNum: number | null;
  rateDen: number | null;
  returnAfter: number | null;
}): LandingParams => {
  const { ownerAddress, category, rateNum, rateDen, returnAfter } = landing;
  if (ownerAddress == null || category == null || rateNum == null || rateDen == null || returnAfter == null) {
    throw new Error('config landing section has unset parameters');
  }
  const decoded = cashAddressToLockingBytecode(ownerAddress);
  if (typeof decoded === 'string') throw new Error(decoded);
  return { ownerLockingScript: binToHex(decoded.bytecode), category, rateNum, rateDen, returnAfter };
};
