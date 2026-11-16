# 0001 Migrate the Sampan landing contract to an XO template

Date: 2026-11-16. Status: accepted.

## Context

Sampan (https://sampan.sasateguh.com, source https://github.com/aimanmalib/sampan) pays BCH from any wallet to a landing
address, `contracts/landing.cash` (CashScript 0.14, P2SH20). A coin at that address can leave only to the owner:

- `convert`: the landing coin is input 0, there are as many outputs as inputs, output 0 pays `ownerLock` and carries fungible
  tokens of `tokenCategory`, and `tokenAmount * rateDen >= inputValue * rateNum`. In Sampan the other inputs and outputs are
  Cauldron pools.
- `giveBack`: the landing coin is input 0 and at least `returnAfter` blocks old (relative lock), exactly one input and one
  output, output 0 pays `ownerLock` with no token and at least the input value minus 1000 satoshis.

No key of the service is needed for either path; anyone may finish them. This repository ports that contract to an XO template
and runs it on chipnet. The Swap Intent template in the same repository is a separate entry and does not depend on this one.

## Decisions

- **Same package, files prefixed `landing`.** `template/landing.ts` (exported as `template/landing.json`), `src/landing-*.ts`,
  `scripts/landing-run.ts`, `tests/landing-*.test.ts`. The engine setup, deposit, Electrum and invitation file modules are shared
  with the Swap Intent code and extended, not copied. One `npm test` covers both templates.
- **Map of the original contract to the template.**

  | Original (`landing.cash`) | XO template "Landing" |
  |---|---|
  | paying BCH to the contract address from any wallet | start action `land`, role `payer` |
  | function `convert` | follow-up action `convert` on the landing output, role `converter` adds the token input and output |
  | function `giveBack` | follow-up action `giveBack` on the landing output; anyone may run it, the runs use the payer |
  | constructor `ownerLock` | variable `ownerLockingScript` (full locking bytecode) |
  | constructor `tokenCategory` | variable `tokenCategory`, explorer order, reversed inside the script as in Swap Intent |
  | constructor `rateNum`, `rateDen` | variables `rateNum`, `rateDen` |
  | constructor `returnAfter` | variable `returnAfter`; the `giveBack` input carries it as its sequence number |
  | value sent by the payer | variable `landedSatoshis` |

  The locking script is written in CashASM line by line from the CashScript source. It holds no public key and needs no
  signature, as in the original.
- **P2SH32 instead of P2SH20.** The template uses the XO `p2sh` locking type, which is P2SH32, as the Swap Intent template does.
  The landing address therefore differs from the address Sampan computes for the same parameters; the rules are the same.
- **A `converter` role stands in for the Cauldron pool.** Chipnet has no Sampan token and no pool for it. The fungible test token
  already minted for the Swap Intent runs (`testToken.category` in `config/chipnet.json`) is the token, and the `taker` account,
  which holds it, plays `converter`: it adds a token input and receives the landed BCH. The contract never checked who provides
  the other inputs, so this changes the counterparty, not the rules.
- **Accounts.** `maker` pays (`payer`), `taker` converts (`converter`), and a new `owner` account only receives. Its phrase is
  appended to `.env` as `OWNER_MNEMONIC` by `npm run wallets -- add`, which refuses to replace a variable that is already set.
  Its token-aware address is `landing.ownerAddress` in `config/chipnet.json`.
- **Output count equals input count.** The engine adds change outputs by itself. When the counts do not match, the converter's
  inputs and outputs are arranged (token and BCH in one input and one output, or the engine's options for change) so that they
  match. The covenant is not loosened to suit the engine.
- **Shape of convert.** Input 0 is the landing coin and input 1 one token coin of the converter. Output 0 pays the owner
  `ceil(landedSatoshis * rateNum / rateDen)` tokens, computed in the template; output 1 pays the converter the landed
  satoshis and the rest of its token coin in one output. The converter states its coin's satoshis and tokens and the fee as
  variables, so the counts match without engine change outputs.
- **The 1000 satoshi giveBack limit is a literal** in the script, as in the original. The engine does not pass template
  constants when it compiles a locking script, so a constant there fails to compile.
- **giveBack and the relative lock.** The landing input in `giveBack` has `sequenceNumber` set from `returnAfter` in a version 2
  transaction, the pattern the faucet template in `@xo-cash/templates` 0.0.12 uses with `OP_CHECKSEQUENCEVERIFY`. The engine
  does not wait for the lock, so the run script checks the coin's age first and refuses with a clear message. The owner receives
  `landedSatoshis - giveBackFeeSatoshis`; the fee is set in config and must be at most 1000.
- **Fallback.** If `convert` cannot be broadcast through the engine after sustained work, the `convert` transaction is built with
  libauth from the same template (the `land` invitation stays an XO invitation) and the reason is recorded here and in the
  journal with the verbatim error. `land` followed by `giveBack` runs through the engine in any case.
- **Values in config.** `landing.landedSatoshis`, `rateNum`, `rateDen`, `returnAfter` (6, as in Sampan), `giveBackFeeSatoshis`
  and `ownerAddress` live in `config/chipnet.json` and are checked when the config loads.
- **Engine version.** `@xo-cash/engine` stays at `0.1.1-next.18029697917`, which is still the `next` tag on 2026-11-16.

## Consequences

- Chipnet only, like the rest of the repository. Sampan's own mainnet contract is unchanged.
- To undo, revert the commits that add the `landing` files; the Swap Intent code does not import them.
