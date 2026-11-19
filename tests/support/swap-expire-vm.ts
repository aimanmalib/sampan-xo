/**
 * Offline harness for the expire path of the Swap Intent covenant: one offer input (sequence number set by the test)
 * and the outputs the test asks for, evaluated in the BCH 2026 virtual machine (standard rules).
 */
import { createVirtualMachineBch2026, generateTransaction, hexToBin, type Output } from '@bitauth/libauth';
import { defaultOffer, offerCompiler, offerData, offerLockingBytecode, takerLockingBytecode, type Offer } from './swap-vm.js';

/** Sequence number with the BIP68 disable flag set: no relative lock. */
export const finalSequence = 0xffffffff;

export interface ExpireShape {
  sequenceNumber: number;
  outputs: Output[];
  /** Adds a second, plain input (a taker coin) after the offer. */
  extraInput?: boolean;
  version?: number;
}

/** The return the covenant accepts: the maker's script, offered less the expire fee, no tokens. */
export const returnToMaker = (offer: Offer = defaultOffer): Output => ({
  lockingBytecode: offer.makerLockingScript,
  valueSatoshis: offer.offeredSatoshis - offer.expireFeeSatoshis,
});

export const validExpire = (offer: Offer = defaultOffer): ExpireShape => ({
  sequenceNumber: Number(offer.expireAfter),
  outputs: [returnToMaker(offer)],
});

const extraSource: Output = { lockingBytecode: takerLockingBytecode, valueSatoshis: 10_000n };

/** Builds an expire spend of the offer. Returns the VM verdict (true or error text). */
export const verifyExpire = (shape: ExpireShape, offer: Offer = defaultOffer): string | true => {
  const offerInput = {
    outpointTransactionHash: hexToBin('dd'.repeat(32)),
    outpointIndex: 0,
    sequenceNumber: shape.sequenceNumber,
    unlockingBytecode: { compiler: offerCompiler, data: offerData(offer), script: 'expireUnlockingBytecode', valueSatoshis: offer.offeredSatoshis },
  };
  // The extra input is never evaluated: verification stops at the offer input, which is first.
  const extraInput = { outpointTransactionHash: hexToBin('ee'.repeat(32)), outpointIndex: 0, sequenceNumber: 0, unlockingBytecode: Uint8Array.of() };
  const generated = generateTransaction({
    version: shape.version ?? 2,
    locktime: 0,
    inputs: shape.extraInput === true ? [offerInput, extraInput] : [offerInput],
    outputs: shape.outputs,
  });
  if (!generated.success) return `generation failed: ${JSON.stringify(generated.errors)}`;
  const offerSource: Output = { lockingBytecode: offerLockingBytecode(offer), valueSatoshis: offer.offeredSatoshis };
  const sourceOutputs = shape.extraInput === true ? [offerSource, extraSource] : [offerSource];
  return createVirtualMachineBch2026(true).verify({ sourceOutputs, transaction: generated.transaction });
};
