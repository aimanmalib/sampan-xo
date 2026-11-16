Build journal, written by the AI coding agent while it worked. The feedback in FEEDBACK.md was written by the entrant, by hand.

# Journal

Facts only, newest step last. Times are UTC. Errors are quoted verbatim.

## 2026-11-14 17:55 Scaffold: packages

- Registry dist-tags at 17:56: `@xo-cash/engine` latest `0.0.1`, next `0.1.1-next.18029697917`, development
  `0.0.1-development.15965991683`. `@xo-cash/templates` latest `0.0.12`. `@bitauth/libauth` latest `3.0.0`, next `3.1.0-next.8`.
- Chosen: `@xo-cash/engine` `0.1.1-next.18029697917` (the `latest` tag `0.0.1` is older than the published workshop material).
  Its manifest asks for `@bitauth/libauth` `^3.1.0-next.8`, so libauth is pinned to `3.1.0-next.8` to keep one copy in the tree.
  `@electrum-cash/network` is pinned to `4.4.8`, the version the engine itself depends on.
- First `npm install` (npm 10.9.8, Node 22.23.1) with `vitest` 4.1.12 failed during dependency resolution:
  `npm error Cannot read properties of null (reading 'edgesOut')`. The debug log stops while resolving optional peer
  dependencies of vitest 4 (`@vitejs/devtools*`, `@vitest/browser-playwright`). Not related to XO.
- Way out: pinned `vitest` 3.2.7. Install then took about 3 minutes (310 packages). Time lost: about 5 minutes.
- Observation: the engine package README is 54 lines; the type declarations (`dist/index.d.mts`, 4175 lines) carry the
  real documentation as doc comments.

## 2026-11-14 18:05 Scaffold: chipnet wallets

- The engine takes a BIP39 phrase directly (`Engine.create(mnemonic, options)`) and derives its keys under its own BIP43
  purpose: `m/2415'` on mainnet and `m/42415'` on test networks (doc comments in `@xo-cash/crypto`). An ordinary wallet
  will therefore not see coins held by XO keys from the same phrase.
- Decision: each account (`maker`, `taker`) has one phrase in `.env`. Coins and test tokens outside XO sit on a plain
  P2PKH funding key at `m/44'/1'/0'/0/0` (path in `config/chipnet.json`); XO uses the same phrase under its own path.
- `scripts/wallets.ts generate` wrote `.env` with mode 0600 and printed addresses only.
  Maker funding address: `bchtest:qplqcy49n873423fq8dhu0hlmmv0k0e6tushym5fpk`
  (token-aware: `bchtest:zplqcy49n873423fq8dhu0hlmmv0k0e6tuhah96079`).
  Taker funding address: `bchtest:qrp3ehqvf8uq8dt5urgyezglkaq4xxkjl5rqyxdqqy`
  (token-aware: `bchtest:zrp3ehqvf8uq8dt5urgyezglkaq4xxkjl5y2hcrxlh`).
- Chipnet Electrum servers come from `@electrum-cash/servers` 4.2.0: `chipnet.imaginary.cash` and `chipnet.bch.ninja`,
  WSS port 50004. `blockchain.address.get_balance` answered at 18:12: both addresses 0 sat.

## 2026-11-14 18:10 Scaffold: chipnet faucet

- https://tbch.googol.cash/ asks for a typed answer to a human check (`captcha` field) in its form. Not automated; left
  for the entrant to use by hand if more coins are needed.
- https://chipnet.bch.ninja/ uses a browser proof of work instead of a human check. Its public form was used in a normal
  browser: 500000 sat requested to the maker's token-aware address. The page answered "Transaction submitted to Chipnet"
  with txid `f65672d9e319859cfad06d27c2c1ff97ce37dc028f2f29923f8b10e018252ba3` and a network fee of 123 sat.
- The page wording is "Larger requests take longer to process". At 18:14 Electrum still answered
  `No such mempool or blockchain transaction` for that txid and the balance was 0.

## 2026-11-14 18:25 Scaffold: faucet coins seen

- At 18:24 `chipnet.imaginary.cash` still answered `No such mempool or blockchain transaction` for txid
  `f65672d9e319859cfad06d27c2c1ff97ce37dc028f2f29923f8b10e018252ba3`, while `chipnet.bch.ninja` (same tip, height 332342)
  returned it from its mempool. The two chipnet servers did not share that mempool transaction for at least 11 minutes.
- `chipnet.bch.ninja` at 18:25: maker funding address `confirmed=0 unconfirmed=500000`. Output 1 of the faucet transaction
  pays 0.005 tBCH to `bchtest:qplqcy49n873423fq8dhu0hlmmv0k0e6tushym5fpk`.
- Time lost on the faucet step: about 15 minutes, most of it waiting for the coins to appear on the first configured server.
- Next: confirm the coins once mined, then read the XO template types and the `wrapped_cash` template before writing Swap Intent.

## 2026-11-14 18:31 Template: reading the XO packages

- Started the Swap Intent template. The fallback clock (fall back to a hash-locked gift if the token covenant cannot be
  made to pass within 12 hours of work) starts here.
- Read: the `XOTemplate` type in `@xo-cash/types` 0.0.8 (doc comments on every field), the bundled templates in
  `@xo-cash/templates` 0.0.12 (`p2pkh`, `faucet_cash`, `wrapped_cash`, `experimental/multisig`), and the engine
  compile path in `@xo-cash/engine` (`createLibauthCompilerForLockingScript`, `convertInvitationVariableValueForCompiler`).
- The engine README says "See `playground/examples/receive-satoshis.js` for a full flow". The published package ships
  only `dist/`, so that example is not in the installed package.
- `Engine.importTemplate` calls `parseTemplate` from `@xo-cash/utils` and then writes to storage. `Engine.create`
  opens Electrum connections before anything else, so the offline tests call `parseTemplate` directly. `@xo-cash/types`
  0.0.8 and `@xo-cash/utils` 0.0.10 (the versions the engine pins) were added as direct, exact dependencies.
- Not documented in the packages, found by reading the code:
  - Lock type `p2sh` maps to libauth `p2sh32`; `p2s` is a bare script (the faucet template builds P2SH20 by hand).
  - Invitation variable values are turned into bytes by type: integers become VM numbers, hex strings become raw bytes
    with no byte reversal.
  - The VM pushes token categories in transaction byte order (`token.category.slice().reverse()` in libauth
    `pushTokenExtendedCategory`), while templates and explorers write categories in display order. A covenant that
    compares a category variable with `OP_OUTPUTTOKENCATEGORY` must reverse one side (`OP_REVERSEBYTES`).
  - A participant who does not hold a key gets the needed key results through invitation resolutions, named like
    `makerKey.public_key` (error text in the engine: "expected an operation on a template key such as
    someKey.public_key").
  - The `conditions` field on actions is marked `@todo More work needs to be done on this field`.

## 2026-11-14 18:43 Template: Swap Intent written, offline tests green

- `template/swap-intent.ts`: roles `maker`, `taker`; start action `open` (maker); follow-up actions on the offer
  locking script: `fill` (taker) and `cancel` (maker). Variables `offeredSatoshis`, `wantedCategory`, `wantedAmount`,
  `makerLockingScript`, plus `takerLockingScript` and the key `makerKey`.
- Offer script (P2SH32): `OP_IF` fill path: output at `OP_INPUTINDEX` must have bytecode `makerLockingScript`,
  reversed category equal to `wantedCategory`, token amount `>= wantedAmount`. `OP_ELSE` cancel path: P2PKH style check
  against `makerKey`. Fill unlocks with `OP_1`, cancel with `<signature> <public key> OP_0`.
- Fees: the taker's own coins pay the token output (`tokenOutputSatoshis` 1000) and the fill fee. Cancel refunds
  `offeredSatoshis - cancelFeeSatoshis` (500). Both are template constants.
- `tests/swap-intent.test.ts`, 13 cases, libauth `createVirtualMachineBch2026` with standard rules:
  parser accepts the template; the engine function `compileLockingBytecodeFromTemplateLockingScriptIdentifier`
  produces the same offer bytecode as the test harness; fill passes with the exact and with a larger amount, and with
  the offer at input 1 paid at output 1; fill fails for a smaller amount, another category, another recipient, another
  output index; cancel passes with the maker key and fails with another key or with an unsigned spend.
- Every rejection is checked to come from the VM evaluating the offer input, for example
  `Unable to verify transaction: error in evaluating input index 0: Program failed an OP_VERIFY operation.` and, for the
  wrong key, `... Program failed a signature verification with a non-null signature (violating the "NULLFAIL" rule).
  Algorithm used: Schnorr.`
- Sabotage check: removing the recipient check, the category check, or the amount check, replacing `OP_INPUTINDEX`
  with `OP_0` in the recipient check, or removing `OP_CHECKSIG` each made exactly one test fail. The first version of
  the tests missed the `OP_0` case because the offer was always input 0; the input 1 case was added for it.
- The fill path passes in the VM, so the fallback template is not needed. Time: about 12 minutes
  from the first read of the packages to green tests (18:31 to 18:43).
- Open for the chipnet run: whether the taker's engine can build the `fill` spend on its own (it does not hold
  `makerKey`; the redeem script needs `makerKey.public_key`), or whether the maker must start the `fill` invitation with
  the offer input in it.

## 2026-11-14 18:52 Chipnet: faucet coins reach the second server

- At 18:51 the faucet transaction `f65672d9e319859cfad06d27c2c1ff97ce37dc028f2f29923f8b10e018252ba3` was still only in the
  mempool of `chipnet.bch.ninja` (maker unconfirmed 500,000 sat there, 0 on `chipnet.imaginary.cash`). Both servers had the
  same tip, height 332344. `chipnet.imaginary.cash` answered `blockchain.transaction.get` with
  `daemon error: DaemonError({'code': -5, 'message': 'No such mempool or blockchain transaction. Use gettransaction for wallet transactions.'})`.
- The transaction and its two unconfirmed ancestors (3 transactions) were fetched from `chipnet.bch.ninja` and broadcast,
  oldest first, to `chipnet.imaginary.cash`. All three were accepted. The faucet output then showed on the
  `chipnet.imaginary.cash` explorer page as unconfirmed.
- Way out kept in the code: transactions from this repository are broadcast to every configured server, not one.

## 2026-11-14 18:58 Test token: fund and mint on chipnet (outside XO)

- `src/spend.ts` builds and signs P2PKH spends with libauth (`generateTransaction`, the `walletTemplateP2pkhNonHd`
  compiler) and refuses to spend coins that carry tokens, so a setup step cannot burn tokens by accident.
- `src/test-token.ts`: `fund` spends the maker's plain coins, pays `takerFundingSatoshis` to the taker and puts the maker
  change at output 0; `mint` spends that output 0 coin as a token genesis, so the category is the fund txid. The token
  output (1,000 sat, 1,000,000 fungible units, no NFT) goes to the taker; change goes back to the maker.
- `tests/test-token.test.ts`, 6 cases, checks both transactions in the BCH 2026 VM with standard rules, plus a genesis
  with a wrong category, which the VM rejects. Sabotage: setting a fixed wrong category in `planMint`, or moving the fund
  change to output 1, each made exactly one test fail.
- Chipnet, 18:56 to 18:57: fund `008eebd7502376715a8ffc87f6b6341cbe284c27237ea0204eaee167603ff95a` (219 bytes, fee 219 sat),
  mint `6f2d6fc236659c342ed5cae76219a777d7fda0fef04d26a4f85198cafa512883` (258 bytes, fee 258 sat). Both servers accepted
  both. Both pages opened on https://chipnet.imaginary.cash/tx/ as unconfirmed; the mint page shows the fungible token
  amount 1000000 and category `008eebd7502376715a8ffc87f6b6341cbe284c27237ea0204eaee167603ff95a`.
- https://chipnet.chaingraph.cash/tx/ answered HTTP 403 to a plain request, so it was not used as the proof explorer.
- Test token category recorded in `config/chipnet.json` (`testToken.category`).

## 2026-11-14 19:05 Chipnet run setup: XO engine wallets

- The XO engine derives its own keys, so the test coins and tokens at the plain P2PKH funding addresses are not
  visible to it. `scripts/deposit.ts maker|taker` asks the engine for a receive locking bytecode (P2PKH wallet
  template from `@xo-cash/templates` set as the change, receive and address policy) and moves every coin of the
  funding address there. Token coins keep their own output.
- `Engine.create` with `storageType: 'sqlite'` failed at start:
  `TypeError: this[#storage].listScriptHashes is not a function` (from `State.listScriptHashes`, called by
  `Engine.#monitorStoredScriptHashes`). The SQLite storage of `@xo-cash/state` 0.0.5 (the version the engine pins) has no
  `listScriptHashes`; the IndexedDB storage has it. Way out: `storageType: 'indexeddb'`; in Node the package installs
  its IndexedDB shim, which writes `.sqlite` files under `databasePath` (`.xo/`, ignored by git).
- Several runs ended with `[AggregateError: All promises were rejected] { [errors]: [] }` and no stack, sometimes before
  any output. Source: `@electrum-cash/application` runs background requests with `Promise.any` over its connected
  servers; with no connected server (seen after `Engine.stop()`) the list is empty and the rejection is not awaited.
  The engine also logs `Failed to synchronize block headers, will retry later: [AggregateError ...]`. Way out:
  `src/xo-engine.ts` ignores only an `AggregateError` with an empty `errors` list and rethrows anything else.
  Time lost: about 10 minutes, including one deposit that was broadcast but whose output was cut off by the crash.
- The first taker deposit was rejected by both servers:
  `mandatory-script-verify-flag-failed (Signature must be zero for failed CHECK(MULTI)SIG operation) (code 16)`.
  Cause: the signer in `src/spend.ts` did not pass the token of the spent coin to libauth, and the BCH signing
  serialization covers it. Fixed; `tests/deposit.test.ts` checks a token coin spend in the VM with the token on the
  source output (red on the old signer with the NULLFAIL error, green after).
- `buildSpend` now spends token coins only when the outputs carry the same amount per category (no burn), and still
  refuses NFT coins.
- Chipnet: maker deposit `95c68c23f1885c0b02646232610ece168357fc0c8a51a8a20e74517a037ca69d`, taker deposit
  `dc91ae0b673d5569938578528eaf97b2fcb2f6d6ad3f2446c27bd1a0d6015e93`, both accepted by both servers and opened on
  https://chipnet.imaginary.cash/tx/ (unconfirmed at 19:20).

## 2026-11-14 19:44 Chipnet: open -> fill through the XO engine

- `open` (maker) works as the engine types describe it: `createInvitation` with the template's `open` start entry as
  the intent (this generates `makerKey`), `appendInvitation` with the four offer variables and the `offerOutput`, one
  plain coin from `listSpendableUnspentOutputs` as input, `addChangeToInvitation`, `signInvitation` for each index from
  `listOwnInputIndexes`, then `executeAction`. `listMissingRequirements` was the most useful call while working this
  out: it names the outputs, role variables and unsigned inputs still owed. A dry run (`broadcastTransaction: false`)
  leaves the coin reserved by the invitation; `archiveInvitation` releases it.
- The first two real `open` runs each ended with an error, and each had broadcast:
  `UnspentOutputNotFoundInStoreError: Unspent output "95c68c23f1885c0b02646232610ece168357fc0c8a51a8a20e74517a037ca69d:0" not found in store`
  from `IndexedDBStorage.executeBulkUnspentOutputReservation`, called by `clearInvitationUnspentOutputReservations`
  in the `finally` of `executeAction`. The broadcast and the broadcast result on the invitation are done before that
  step; the spent coin had already left the store. The second run, started after the first "failure", opened a second
  offer from the first one's change. Both offers are kept: run1 (filled) and run2 (left open for the cancel run).
  Way out: `finishAction` builds the transaction first, and accepts exactly this error only when the stored invitation
  carries the broadcast result for that transaction hash. Suggestion for the engine: do not let the reservation
  cleanup after a successful broadcast throw, or report the broadcast txid with the error.
- `Engine.stop()` did not settle in some runs, so the process never ended (two runs killed by a timeout after their
  work was stored). `stopAccountEngine` waits at most `swap.engineStopTimeoutSeconds`, then the script exits.
- Answer to the question left open at X1, as found here: the taker cannot spend the offer coin on its own. The engine
  compiles an input only for a coin this account tracks (`InputUnspentOutputUnavailableError` otherwise), and only
  the maker's engine tracks the offer script hash and holds `makerKey`. So `fill` takes three hand-offs: the maker
  starts the `fill` invitation with the offer coin at input 0 and the offer variables (no role); the taker accepts it
  as `taker`, adds `takerLockingScript`, `makerPaymentOutput` at index 0, `takerPayoutOutput`, a token coin and a plain
  coin, change, and signs its two inputs; the maker loads it with `updateInvitation`, signs input 0 (the engine
  compiles `OP_1` plus the redeem script) and broadcasts. No engine error on this path. The docs do not describe this
  hand-off; it was found by reading the engine's compile path in the published source maps.
- Fee and change were left to the engine: `addChangeToInvitation` on the taker side added a token change output
  (999,000 units) and a plain change output.
- Chipnet: run1 open `74fb6c7b5299ec2be0e0b4832ab4c4bd6837f8904505fe0905b932c0c77c3b99`, run1 fill
  `326ee1c18edae7a42317c062237028150145d6f8e8cd5579baa3653e094d6862` (outputs: 1,000 sat with 1,000 test tokens to the
  maker at index 0, 20,000 sat to the taker, token change, plain change). Then `scripts/run.ts fill run3` ran all four
  steps in one command: open `c96a928911e301a808859080fbd842004ab47e79992f63023110a5f3884388ce`, fill
  `f6d0359759159ac189383ea76155d2bc7dad63d153c67f95ca9162df6ab0a7a2`. All five were seen by both servers and opened on
  https://chipnet.imaginary.cash/tx/ at 19:42 (unconfirmed).
- Time: about 40 minutes from the first engine call to the run1 fill broadcast (19:05 to 19:38).

## 2026-11-14 19:58 Chipnet: open -> cancel through the XO engine

- Tried: a `cancel` step in `scripts/run.ts`, run by the maker engine that opened the offer. `cancelOffer` finds the
  offer coin in `listUnspentOutputs` by the open transaction hash and template, creates a `cancel` invitation, and
  appends as `maker`: the four offer variables read from the saved open invitation, `cancelInput` at input 0 and
  `refundOutput` at output 0. Then it signs its own inputs and executes.
- The engine found `makerKey` for the offer script on its own (it stored the secret at open); nothing had to be
  generated again, and `listMissingRequirements` was empty after signing. No `addChangeToInvitation` call: the refund
  output is the template's `refundSatoshis` (offered satoshis less the `cancelFeeSatoshis` constant, 500).
- `npx tsx scripts/run.ts cancel run2 --dry-run` built `8472ca5d…e110` without errors; the real run at 19:56 broadcast
  the same txid with no engine error (the late reservation error seen on open did not occur here).
- Chipnet: run2 open `66b0a6d5cb7b263e960bfa4ed9d9c8ec3952501dc4d7ae3f8a22edcaa2768d85`, run2 cancel
  `8472ca5d982bff800fa471f0811b5c9a3af597c96b8dd0e73d555a7ed44de110` (one output, 19,500 sat). Both seen by
  chipnet.imaginary.cash and chipnet.bch.ninja, and the cancel opened on https://chipnet.imaginary.cash/tx/ at 19:57
  (unconfirmed). chipnet.chaingraph.cash answered HTTP 403 to a scripted request.
- Time: about 5 minutes from writing the step to the broadcast.

## 2026-11-14 20:12 XO debug tool: saved invitations and chipnet transactions

- Tried: https://blaze.xo.cash/ in a scripted Chromium. The first screen asks for an account ("Create new account" or
  "Use existing mnemonic", with the warning to use test or disposable wallets only). A new disposable chipnet account
  was created in the browser for viewing; the project's chipnet phrases were not entered.
- The tool has no file upload for templates; "Import Template" takes pasted JSON. The template exists in this repo as
  TypeScript with bigint values, so `scripts/export-template.ts` now writes `template/swap-intent.json` with
  `serializeTemplate` (bigints as `<bigint: 1000n>`). A test keeps the file equal to the TypeScript source and checks
  that its identifier is the one named in every saved invitation. Pasting it gave
  `Template imported: Swap Intent (c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456)`, listed as
  "2 roles · 3 actions · 9 scripts".
- "Join Invitation" says "The template must already be imported on this device." With the template imported,
  "View invitation" accepted `run2-open.json` (action `open`, 5 commits, result `66b0a6d5…`), `run2-cancel.json`
  (action `cancel`, 3 commits, `cancelInput`, result `cancelTransaction` `8472ca5d…`), `run1-fill-start.json` (action
  `fill`, 2 commits, 4 variables, 1 input, no result yet) and `run1-fill.json` (action `fill`, 8 commits, taker role on
  commits 3 and 4, result `326ee1c1…`). Nothing was rejected. "Accept invitation" was not used.
- "Inspect" with network `chipnet` fetched each txid on paste and reported `SUCCESS` for run2 open, run2 cancel and run1
  fill. For the offer inputs it decodes the P2SH32 redeem script (`OP_IF … OP_OUTPUTTOKENCATEGORY OP_REVERSEBYTES
  <category> OP_EQUALVERIFY … OP_ELSE OP_DUP OP_HASH160 … OP_CHECKSIG OP_ENDIF`) and steps it ("Step 1 of 30" for the
  fill input), with stack, operation cost and signature check metrics.
- Small points met while scripting: Escape does not close the modals (the "Cancel" button does), and the notifications
  panel stays open over the navigation until closed.
- Time: about 15 minutes, most of it finding the right buttons by reading the page.

## 2026-11-14 20:26 Facts list for the entrant

- A list of facts taken from this journal (versions, what worked, verbatim errors, missing documentation, time lost,
  chipnet txids) and the debug tool steps from the README were handed to the entrant, together with copies of
  `template/swap-intent.json`, `invitations/run2-cancel.json` and `invitations/run1-fill.json`. It is a list, not a
  draft; the entrant writes the feedback in FEEDBACK.md by hand.
- No answer from the XO team has been noted yet, so nothing is quoted here.

## 2026-11-14 20:33 README and clean clone check

- `npx tsx scripts/run.ts --help` printed the usage on stderr and exited 2, because any unknown first argument was
  treated as an error. It now prints the usage on stdout and exits 0.
- README rewritten for a reader starting from nothing: a sequence diagram of the two roles, the template variables and
  who sets them, the pinned package versions, numbered steps from `npm ci` to the cancel run, the chipnet txids, the
  debug tool steps and a list of known limits.
- Clean clone check: `git archive HEAD` of commit 82c7f20 unpacked into a new temporary folder (removed afterwards),
  then `npm ci` (311 packages, exit 0), `npm test` (9 files, 45 tests passed, exit 0) and
  `npx tsx scripts/run.ts --help` (exit 0). No `.env` and no network were needed for these.
- No answer from the XO team has been noted yet, so nothing is quoted here.

## 2026-11-16 09:00 Migrate to XO: design, owner account, landing config

- Second entry in this repository: the Sampan landing contract (`contracts/landing.cash`, CashScript 0.14, functions
  `convert` and `giveBack`) ported to an XO template. Design recorded in `docs/decisions/0001-migrate-landing.md`.
- Registry dist-tags at 08:56: `@xo-cash/engine` next is still `0.1.1-next.18029697917` (latest `0.0.1`), `@xo-cash/templates`
  latest still `0.0.12`. No upgrade.
- Relative locks in XO: `XOTemplateInput.sequenceNumber` takes a number or a CashASM string, and transactions take `version`
  and `locktime`. The only published example is the faucet template in `@xo-cash/templates` 0.0.12
  (`sequenceNumber: "$(<periodBlocks>)"` with `OP_CHECKSEQUENCEVERIFY OP_DROP`). The engine README does not mention sequence
  numbers; the type declarations do.
- A third account `owner` was added. `npm run wallets -- add` appended `OWNER_MNEMONIC` to `.env`; a hash of the existing
  maker and taker lines was the same before and after, and the old file content is an exact prefix of the new one. The
  file mode stayed 0600. Owner address: `bchtest:zz4rr7mn324zdkeav5v3gpqvlf3jx9u68q0vhr6hgz`.
- Balances at 08:58. Plain funding addresses of maker, taker and owner: 0 satoshis (the coins were deposited into the
  engine wallets on 2026-11-14). Engine wallets, read with `listUnspentOutputs()`: maker 4 confirmed outputs, 358638
  satoshis in total, including two outputs of 1000 test token units each; taker 4 confirmed outputs, 136681 satoshis in
  total, including one output with 998000 test token units. Enough for the landing runs without the faucet.
- Starting two engines in one Node process fails with
  `Error: Cannot configure storage for cache after it has been initialized.` (from `@electrum-cash/application`), so each
  account is read in its own process, as the run scripts already do.

## 2026-11-16 09:12 Migrate to XO: Landing template and VM tests

- `template/landing.ts`: roles `payer` and `converter`; start action `land` (payer); follow-up actions on the landing
  locking script: `convert` (converter) and `giveBack` (payer, no key needed). `resources` links to the original
  `contracts/landing.cash`. Exported with the Swap Intent template by `scripts/export-template.ts` to `template/landing.json`
  (the Swap Intent JSON came out byte for byte the same).
- The locking script is `landing.cash` in CashASM, one script per `require`: `OP_INPUTINDEX OP_0 OP_NUMEQUALVERIFY`, then
  `OP_IF` convert (`OP_TXOUTPUTCOUNT OP_TXINPUTCOUNT OP_NUMEQUALVERIFY`, owner bytecode at output 0, reversed category at
  output 0, `tokenAmount * rateDen >= utxoValue * rateNum`) `OP_ELSE` giveBack (`<returnAfter> OP_CHECKSEQUENCEVERIFY OP_DROP`,
  one input and one output, owner bytecode, empty category, `value >= utxoValue - 1000`). Unlocking: `OP_1` convert, `OP_0`
  giveBack. P2SH32 through the `p2sh` locking type.
- Convert shape chosen so the output count equals the input count without engine change outputs: input 0 landing coin,
  input 1 one converter token coin; output 0 owner tokens, output 1 converter payout carrying the landed satoshis plus the
  rest of the token coin (BCH and tokens in one output). The converter states its coin's satoshis and tokens and the fee as
  variables; the template computes the payout. The owner amount is `ceil(landed * rateNum / rateDen)`, computed in CashASM.
- Errors on the way:
  - The engine function `compileLockingBytecodeFromTemplateLockingScriptIdentifier` failed with
    `Compilation error in resolved script "giveBackPath": [1, 69] Compilation error in resolved script "enforceReturnedValue": [1, 40] Unknown identifier "giveBackMaxFeeSatoshis".`
    The engine does not pass template `constants` when it compiles a locking script (the Swap Intent template uses a
    constant only in an output value, which works). Way out: the literal `<1000>` in the script, as in the original.
  - A computed script used inside another as `$(convertTokenAmount)` gave
    `The locking bytecode completed with a non-empty control stack. Remaining control stack depth: 1.`: `$( )` inserts the
    result as raw bytes (100 = 0x64 = `OP_NOTIF`), not as a push. Way out: reference the script by name (inlined), or `<$( )>`.
- `tests/landing-template.test.ts` (7) and `tests/landing-covenant.test.ts` (16), libauth `createVirtualMachineBch2026` with
  standard rules: parser, follow-up actions, engine and harness compile the same P2SH32 bytecode, computed amounts; convert
  passes at the exact and the rounded up minimum, fails one unit below, to another owner, with another category, with the
  category bytes reversed, with an extra output, with the landing coin at input 1; a P2SH owner works; giveBack fails with
  sequence 5 and with the final sequence, passes at 6 and 20, passes with 1000 kept and fails with 1001, fails with two
  outputs, to another address, and with a token output.
- Verbatim rejections, for example: one unit below the rate
  `Unable to verify transaction: error in evaluating input index 0: Unsuccessful evaluation: completed with a non-truthy value on top of the stack. Top stack item: "".`;
  sequence 5
  `... Program called an OP_CHECKSEQUENCEVERIFY operation that requires a sequence number greater than the input's sequence number. Sequence number: 5; required sequence number: 6.`
- Sabotage, one change at a time: rate check replaced by `OP_1` made 2 tests fail; category check removed 2; CSV removed 2;
  input index check removed 1; output count check removed 1; `<1000>` changed to `<1001>` 1. Removing the no-token check
  made no test fail: with one input and no token on the landing coin, a token output is already refused by consensus
  (`Transaction violates token validation: the transaction creates new fungible tokens for a category without a matching genesis input.`).
  The check is kept because the original has it.
- The relative lock is checked only against the input sequence number in these tests; the VM does not know the coin's age.
  The chipnet run checks the age.
- `tests/template-json.test.ts` now checks each template's JSON, and matches saved invitations to a template by file name
  prefix (`run` for Swap Intent, `landing` for Landing). Swap Intent tests unchanged and green.
- Time: about 10 minutes from the first template line to green tests (09:05 to 09:12).
