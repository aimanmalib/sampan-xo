# 0002 Landing template: the cashc bytecode of the deployed contract

Date: 2026-11-18. Status: accepted. Replaces the "written in CashASM line by line" part of 0001.

## Context

The first Landing template (0001) implemented every `require` of `contracts/landing.cash` in CashASM written by hand. It
enforced the same rules, but in a different opcode order from the bytecode cashc 0.14.0 compiles, so the claim that it
is the same contract could only be argued, not checked.

Sampan's landing addresses are on mainnet. A coin that left one of them carries the full redeem bytecode in its
unlocking script. One such transaction is the Sampan giveBack
`5671fd920b3a3c74d322b23250d31a33326452e28528236227f0c89f3a585ba6`.

## Decision

1. The landing locking script is the cashc output, with template variables in place of the constructor arguments:

   - `landingConstructorArguments`: `<returnAfter> <rateDen> <rateNum> <$(<tokenCategory> OP_REVERSEBYTES)> <ownerLockingScript>`,
     the order cashc uses (last parameter first). The `tokenCategory` variable stays in display order, as the engine and
     block explorers use it; the evaluation reverses it to the transaction byte order cashc takes.
   - `selectorIsConvert`, `convertChecks`, `giveBackChecks`, `landingContractBytecode`: the artifact bytecode split into
     named parts with one comment per `require`. Concatenated, they are the artifact bytecode with no opcode changed.
   - Unlocking scripts push the cashc function selector: `OP_0` for `convert`, `OP_1` for `giveBack`.

2. The wrapper stays P2SH32. `@xo-cash/types` 0.0.8 offers the locking types `p2s`, `p2pkh` and `p2sh`, and
   `@xo-cash/engine` 0.1.1-next.18029697917 maps `p2sh` to libauth `p2sh32` (`XO_LOCKING_TYPE_TO_LIBAUTH_MAP`). There
   is no P2SH20 type. So the redeem bytecode is the same as Sampan's and the address is not: same redeem bytecode,
   different P2SH wrapper (P2SH32 here, P2SH20 in Sampan). Writing a P2SH20 wrapper by hand as a `p2s` script was not
   tried.

3. The proof is committed and runs offline:

   - `tests/fixtures/landing-deployed.json`: the raw giveBack and the raw transaction it spends, read once from a public
     mainnet Electrum server (`blockchain.transaction.get`, read only), the redeem bytecode, the spent P2SH20 locking
     bytecode, and the parameters read from the redeem pushes.
   - `tests/fixtures/landing-artifact.json`: a copy of Sampan's `contracts/landing.json` (cashc 0.14.0, MIT, Sampan
     commit `2a92ef3`).
   - `src/landing-bytecode.ts` and `scripts/check-bytecode.ts` check that the raw transaction hashes to the txid, that the
     redeem bytecode is the last push of the input, that the spent output is `OP_HASH160 <hash160(redeem)> OP_EQUAL`,
     then compile the template in the XO engine and build the cashc redeem bytecode from the artifact, and compare
     all three.

## Measured

`npx tsx scripts/check-bytecode.ts --json` on 2026-11-18: `identical: true`. The three redeem bytecodes are 136 bytes
and equal. Parameters of that address: `rateNum` 20000000, `rateDen` 100000000, `returnAfter` 6, a P2PKH owner.

`--params config/chipnet.json` and `--params config/mainnet.json` also give `identical: true` (template equals cashc for
those parameters). The mainnet config differs from the deployed address in `ownerLockingScript` only.

`tests/landing-bytecode.test.ts` fails when one opcode is removed from the template, when the category is pushed in
display order, when the rate changes by one, or when one byte of the fixture changes. The VM tests from 0001
(`tests/landing-covenant.test.ts`, `tests/landing-giveback.test.ts`) pass unchanged against the new script.

## Consequences

- The template identifier changed. The chipnet runs landing1 and landing2 used the earlier hand-written script and keep
  its identifier `03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515`; new runs use the new template.
- Landing addresses for the same parameters differ from the earlier template's, because the script differs.
- Rollback: the earlier script is in git history (`template/landing.ts` before this change).
