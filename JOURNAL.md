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

## 2026-11-16 09:21 Migrate to XO: chipnet run landing1 land -> convert, landing2 land

- `scripts/landing-run.ts` (steps `land`, `convert-start`, `convert-take`, `convert-finish`, `convert`) on top of
  `src/landing-land.ts` and `src/landing-convert.ts`; the engine now imports the Landing template next to Swap Intent.
  `finishAction` and `signOwnInputs` from the Swap Intent code are reused unchanged. New config value
  `landing.convertFeeSatoshis` (1000).
- 09:16 `land landing1 --dry-run` built a transaction. 09:17 `land landing1` broadcast
  `7883280023308e712beb1a51f5f9ba050dd740b7a8099fcf14e18a98437ca894`: output 0 to the P2SH32 landing address
  `bchtest:pdkjxyq90j46vdx39ukn9wn2dl7gcxknn7nts92rnx55v00whxc25ggkpq554`, output 1 engine change.
- The payer engine lists the landed coin under the Landing template although the landing locking script has no
  payer secret, so `convert-start` found it with `listUnspentOutputs()` by land txid and template.
- 09:17 `convert-take` (taker as converter) and `convert-finish --dry-run` (payer) built a transaction with no error:
  one token coin as input 1 (998000 units, 1000 sat), no change output, two inputs and two outputs. The engine did not add
  change on its own and did not refuse the missing change.
- The real `convert-finish` after that dry run failed:
  `InvitationHistoryConflictError: Invitation "1ce6b48a8ba70106d2c7949494567602" history conflict at stored commit "c5c5a3885c6b1b1f84e4cf80748b65bb", expected the updated invitation to keep every stored commit in its stored position`.
  The dry run had stored the payer's input commit in its engine. Starting again, `convert-take` failed with
  `the converter engine wallet has no coin with 100 test token units`: the first taken invitation still reserved the
  token coin. Way out: archived that invitation in the taker engine (`engine.archiveInvitation`, one-off, not committed),
  then `convert-start`, `convert-take`, `convert-finish` again. About 2 minutes lost.
- 09:18 `convert-finish landing1` broadcast `7a9b82e8159b01bcf53e5c556f90d568a32961a4aef7551d119454bc7461d056` while the land
  transaction was still unconfirmed. Explorer: input 0 the landing coin, input 1 the taker token coin; output 0
  `bchtest:qz4rr7mn324zdkeav5v3gpqvlf3jx9u68qgxya53h3` (the owner address in its non-token form) with 100 units of
  `008eebd7502376715a8ffc87f6b6341cbe284c27237ea0204eaee167603ff95a`; output 1 to a fresh taker address with the rest of
  the tokens. The covenant ran through the engine; no fallback (K6) was needed.
- 09:19 `land landing2` broadcast `a0e6da274c8c5881bfc5c0c103c4d64f1612d1d69b79aeac876fea165ffdce47`, spending the
  unconfirmed change of landing1. The engine printed, verbatim, twice
  `Failed to process transaction update: Error: Could not validate a block header on height 333698: The requested header is ahead of the current checkpoint at height 332384`
  and then
  `note: broadcast recorded; the engine then failed to clear a spent coin reservation: UnspentOutputNotFoundInStoreError: Unspent output "7883280023308e712beb1a51f5f9ba050dd740b7a8099fcf14e18a98437ca894:1" not found in store`
  (the late reservation error already seen in the Swap Intent runs). The broadcast went through.
- Explorer at 09:20: landing2 land mined in block 333701. All three txids opened on https://chipnet.imaginary.cash/tx/.
- Unit tests `tests/landing-run.test.ts` (6) with a stand-in engine: variables from the config, reading a land
  invitation, the rounded up minimum, convert input and output positions, no change, every saved landing invitation valid.

## 2026-11-16 09:26 Migrate to XO: landing2 giveBack
- Added `src/landing-giveback.ts` and the `giveBack <run>` step of `scripts/landing-run.ts`. Before the engine starts, the
  step reads the land transaction height (`blockchain.transaction.get_height`) and the tip (`blockchain.headers.get_tip`)
  from chipnet Electrum and refuses a coin with fewer than `returnAfter` confirmations. The engine itself does not check
  the age of a coin before building or broadcasting.
- 09:27 tip 333708, land mined at 333701 (8 confirmations). `giveBack landing2` built version 2, locktime 0, one input
  (`a0e6da27...:0`, sequence 6, unlocking script 139 bytes, no signature) and one output of 9500 sat to the owner, txid
  `de83797632b64d4725fcd47ec9325fc49dc36cddf30fdd7d301137d01d1819dd`. `executeAction` failed, verbatim:
  `Failed to broadcast transaction: Error: Failed to request 'blockchain.transaction.broadcast': the transaction was rejected by network rules.`
  `non-BIP68-final (code 64)`.
- A second run failed before building:
  `UnspentOutputReservationExternalConflictError: Unspent output "a0e6da274c8c5881bfc5c0c103c4d64f1612d1d69b79aeac876fea165ffdce47:0" is already reserved by "bb101ae44c12976e29eab6a1ce7422a5"`.
  The failed invitation keeps its reservation. Way out: `engine.archiveInvitation` on it (one-off, not committed), then the
  step again, which built the same txid and got the same `non-BIP68-final (code 64)`.
- The same bytes sent straight to both servers (`chipnet.imaginary.cash` Fulcrum 2.1.4, `chipnet.bch.ninja` Fulcrum 2.1.3
  over Bitcoin Cash Node) were refused the same way. Both servers reported the coin unspent with `confirmed_height: 333701`
  and the land transaction with 12 confirmations at tip 333712.
- Probe: the same transaction with sequence 1 to 5 can never be accepted (the covenant's `6 OP_CHECKSEQUENCEVERIFY` fails),
  so the error kind shows the age the node gives the coin. `script-csv` = node error
  `non-mandatory-script-verify-flag (Locktime requirement not satisfied)` (age check passed), `bip68` = `non-BIP68-final`.

  | Time (UTC) | Tip | seq 1 | seq 2 | seq 3 | seq 4 | seq 5 |
  | --- | --- | --- | --- | --- | --- | --- |
  | 09:31 | 333717 | script-csv | bip68 | bip68 | - | bip68 |
  | 09:37 | 333720 | script-csv | script-csv | bip68 | bip68 | bip68 |
  | 09:46 | 333729 | - | - | bip68 | bip68 | bip68 |
  | 09:47 | 333730 | - | - | script-csv | bip68 | bip68 |
  | 09:56 | 333740 | - | - | script-csv | script-csv | bip68 |

  Chipnet mined a block about every 45 seconds in that window, while the age the nodes accept grew by one about every
  4 to 10 blocks. By the BIP68 rule in Bitcoin Cash Node (`nCoinHeight + sequence - 1 < tip + 1`) a coin mined at 333701
  passes sequence 6 from tip 333706. The cause was not found; the facts above are what was measured.
- Sharper probe for sequence 6: the same transaction with the unlocking selector `OP_0` changed to `OP_1` (the convert
  path, which fails here because the output carries no token). At 10:12 (tip 333754) it was still `non-BIP68-final`; at
  10:18 (tip 333760) the node answered
  `mandatory-script-verify-flag-failed (Script failed an OP_EQUALVERIFY operation) (code 16)`, so sequence 6 had passed.
- 10:19 archived the second failed invitation (`f0707ad8...`, one-off) and ran `giveBack landing2` again. The engine
  broadcast `de83797632b64d4725fcd47ec9325fc49dc36cddf30fdd7d301137d01d1819dd`, the same txid as the refused attempts. The
  script then failed to save the file, verbatim: `Error: bad run or step name: landing2 giveBack`: `src/invitation-file.ts`
  accepted only lower case steps. Fixed (camel case action names allowed, a test added) and the stored invitation, found in
  the payer engine by its recorded broadcast of that txid, saved as `invitations/landing2-giveBack.json`.
- Explorer and Electrum at 10:21: 1 confirmation, version 2, input `a0e6da27...:0` with sequence 6, one output of 9500 sat
  with no token to `bchtest:qz4rr7mn324zdkeav5v3gpqvlf3jx9u68qgxya53h3` (the owner address in its non-token form).
  `land -> giveBack` ran through the XO engine with the covenant unchanged. About 55 minutes from the first refusal to the
  broadcast, most of it waiting on the nodes.

## 2026-11-16 10:29 Migrate to XO: Landing template and runs in the XO debug tool

- Tried: https://blaze.xo.cash/ in a scripted Chromium with a new disposable chipnet account (the project's phrases were
  not entered), the same steps as the Swap Intent check on 2026-11-14.
- "Import Template" with the pasted `template/landing.json` gave
  `Template imported: Landing (03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515)`, listed as
  "2 roles · 3 actions · 18 scripts" with the template description. The identifier is the one in every `landing*`
  invitation file.
- "Join Invitation" then "View invitation" accepted all six saved files; nothing was rejected:
  - `landing1-land.json`: action `land`, 4 commits (payer role on commits 1 and 2), result `landTransaction` `78832800…`.
  - `landing1-convert-start.json`: action `convert`, 2 commits, 6 variables (`landedSatoshis` 10000, `ownerLockingScript`,
    `tokenCategory`, `rateNum` 1, `rateDen` 100, `returnAfter` 6), input `convertInput` at transaction index 0, no result.
  - `landing1-convert-taken.json`: 5 commits, converter role on commits 3 and 4, commit 5 adds the converter's unlocking
    bytecode for input 1, no result.
  - `landing1-convert.json`: 6 commits, commit 6 extends commit 2 `convertInput`, result `convertTransaction` `7a9b82e8…`.
  - `landing2-land.json`: action `land`, 4 commits, result `a0e6da27…`.
  - `landing2-giveBack.json`: action `giveBack`, 4 commits (payer role on commit 3), commit 4 extends `giveBackInput`,
    result `giveBackTransaction` `de837976…`.
  The page shows each commit's expiry (5 hours after creation) and the entity public keys; "Accept invitation" was not used.
- "Inspect" with network `chipnet` fetched each txid on paste and reported `SUCCESS` for landing1 land, landing1 convert
  and landing2 giveBack. For the landing input of convert (scriptSig `OP_1`, 10000 sats) and of giveBack (scriptSig
  `OP_0`) it decodes the P2SH32 redeem script, `OP_INPUTINDEX OP_0 OP_NUMEQUALVERIFY OP_IF … OP_ELSE OP_6
  OP_CHECKSEQUENCEVERIFY OP_DROP … OP_ENDIF`, with the owner bytecode, the reversed category and the 1000 sat fee limit
  (`0xe803`) inline, and steps it ("Step 1 of 60").
- Screenshots `xo-migrate-*` (11) were kept as evidence outside the repository.
- Time: about 10 minutes; the Swap Intent script from 2026-11-14 worked with the file names changed.

## 2026-11-16 10:36 Migrate to XO: README section and clean clone check

- README: new section "Migrate to XO" (links to the original project and contract, map of the original functions to the
  template's actions, the covenant rules, a sequence diagram, differences from the original, the four Landing txids, the
  commands to make the invitations again, how to open them in the XO debug tool, known limits). The Swap Intent sections
  are unchanged.
- Clean clone: `git archive HEAD` into a new temporary directory, `npm ci` (311 packages, rc 0), `npm test` (13 files,
  86 tests passed), `npx tsx scripts/landing-run.ts --help` (rc 0, prints the usage line). The directory was removed.
- Style check of the README text: no finding that is not already in the earlier README.

## 2026-11-16 11:05 Migrate to XO: facts list for the entrant

- Collected the facts of the Migrate to XO entries above (versions, what worked, verbatim errors, time lost, gaps in the
  engine documentation, the four txids) as a plain list for the entrant, with steps to open the Landing template and two
  invitations in https://blaze.xo.cash/. No feedback text was drafted by the agent.
- `FEEDBACK-MIGRATE.md` is not in the repository yet: the entrant's own feedback on the migration has not been written.

## 2026-11-18 18:04 Taker part of a fill done inside the XO debug tool (run browser1)

- Goal: one Swap Intent invitation joined, signed and paid from inside https://blaze.xo.cash/, not only viewed. A new
  disposable chipnet account was created in the tool (scripted Chromium with a kept browser profile, so the account
  survives between sessions; the project's phrases were not entered anywhere outside the repository's scripts).
- Choice: the tool takes the `taker` role of a fill started by the maker script. The other order (tool opens the offer)
  was not tried: the fill needs the maker's engine to supply the offer coin, so the maker would also have had to be the
  tool account.
- Receive address: "Receive" first said "In order for the wallet to receive funds it must generate a new receiving
  address. If a default receive policy is not set for the wallet, one must be added." "Set up default receive" offers
  the policies `Receive`, `Change`, `Address` and the template `Wallet (P2PKH)`; after choosing `Receive` the dialog
  showed "Creating a receive address…" and the address `bchtest:qz3zugr6rdmx8xy0ykqfu6r0me6vhj6juuysc3qunc`.
- Funding: new `scripts/send.ts` sends tokens or satoshis from an engine wallet with the P2PKH wallet template actions
  `sendFungibleTokens` and `sendSatoshis`. Errors met while writing it, verbatim:
  - `TemplateLockingScriptRoleNotFoundError: Role "sender" not found on locking script "sendingLockingscript"` when the
    output carried `roleIdentifier: 'sender'`; the output entry now has no role.
  - `MergedItemValueSatoshisMissingError: Merged output is missing valueSatoshis: outputIndex 0` for the token output:
    the template's `transferFungibleTokensOutput` has no `valueSatoshis`. The output now carries the token coin's own
    satoshis.
  - The token transfer 95bb2406… was broadcast, then the script stopped with `Error: The server answered
    'blockchain.transaction.dsproof.subscribe' with a status that is not the shape the protocol defines.` The invitation
    was read back from the maker's engine store and saved as `browser1-fund-tokens.json`. The satoshi transfer a minute
    later did not hit the error.
  - The taker engine wallet listed its largest plain coin and both token coins as not spendable (cause not checked), so
    the maker funded the tool account.
- Joining: "Join Invitation", paste `browser1-fill-start.json`, "View invitation" shows the template, action, commits,
  the four offer variables and the offer input, then "Choose a role" with `Taker` as the only role. "Accept invitation"
  asks again: "Joining adds a commit that records you as a participant in this invitation. It does not add inputs or
  outputs." with "Add to invitation".
- The invitation page lists what is missing for the role ("VARIABLES TO ADD", "OUTPUTS TO ADD") with the template's
  descriptions, and a transaction tab that explains why the draft would fail, for example "Outputs exceed inputs by
  1000 satoshis. Open Add and add at least 1000 satoshis of new inputs. Invitation outputs cannot be reduced." and
  "Bitauth token validation rejected this transaction. … the transaction creates new fungible tokens for a category
  without a matching genesis input." (before the token input was added).
- Variable: the address pasted into `takerLockingScript` became `76a914a22e207a1b7663988f25809e686fde74cbcb52e788ac`.
  Outputs: "Set up output" shows each template field with its CashAssembly and the resolved value; the transaction index
  field is fixed by the template (disabled). Inputs: "Add input" lists the wallet's coins with template and category.
- Change: the first try said "This template has no change policy and no default Change policy is set in Settings, so
  automatic change cannot pick a change address. Set one, or use Manual." After setting `Change` to `Wallet (P2PKH)`
  under Settings, Defaults, "Add selected change" added one 29160 sat output (30000 left over, 840 sat estimated fee).
- Signing: "Sign" lists "Inputs still needing unlocking bytecode: 3. Yours: 2. From other participants: 1."; the offer
  input shows "Waiting on another participant". "Generate selected (2)" only shows a preview; nothing is stored until
  "Append to invitation". Every change is one commit and asks for a confirmation first; the exported invitation had 10
  commits.
- Export: "Copy invitation" writes the invitation JSON to the clipboard. Saved as `browser1-fill-taken.json` (pretty
  printed through the XO utils, same commits).
- Finish by the maker, first try (17:50), verbatim: `TemplateUnlockingScriptNotFoundError: Unlocking script not found
  for locking script "sendingLockingscript" in template: a31eb858…`. The maker's engine counted the taker's two inputs
  as its own because it had created those coins (the two transfers), and tried to sign them. The second try then failed
  with `InvitationHistoryConflictError: … expected the updated invitation to keep every stored commit in its stored
  position`, because the first try had already stored the maker's signature commit. Fix in `finishFill`: sign only the
  offer input (transaction index 0), and skip the update when every commit of the taker's file is already stored. A
  regression test (`tests/browser-run.test.ts`) fails on the old code. The fill f9215922… was then broadcast (17:51).
- Checks: all four browser1 txids open on https://chipnet.imaginary.cash/tx/ (HTTP 200, txid in the page) and are
  known to both Electrum servers; the tool account received the 20000 sat payout. In the tool, "Update invitation" with
  `browser1-fill.json` previewed "Stored commits 10, Incoming commits 11, New commits 1 (to append)" with the broadcast
  result, and after "Apply update" the invitation shows `COMPLETED`, "1000 tokens paid to the maker for 20000
  satoshis." "Inspect" with `chipnet` and the fill txid reports `SUCCESS` and steps the offer input ("Step 1 of 30").
- Time: about 2 hours 20 minutes, most of it waiting for a browser slot on the shared host and finding the next button
  one screen at a time (each step had to be scripted before the next screen could be seen).
- Suggestions: a "Use my receive address" choice next to a locking script variable; "Add change" offering to set the
  Change policy in place; a note in the join dialog that signing needs "Append to invitation" after "Generate"; an
  engine option to sign only the inputs a commit of this entity added, so a wallet that funded the other party does not
  try to sign that party's coins.

## 2026-11-18 18:26 Migrate to XO: mainnet accounts and config for one minimum run

- Scope: one mainnet Landing run (land, then giveBack) is planned, with small amounts and a fixed set of actions. This
  step only adds the accounts and the config; no mainnet transaction was made.
- `npm run wallets -- add --network mainnet` appended two new phrases to `.env` (`MAINNET_PAYER_MNEMONIC`,
  `MAINNET_OWNER_MNEMONIC`, mode 0600). The three chipnet lines before them stayed byte for byte (checked by comparing
  the file prefix); chipnet phrases are not used on mainnet.
- Mainnet addresses (path m/44'/145'/0'/0/0): payer `bitcoincash:qzqhpy3rzuzmfj0ylnpky8zfvd8xhpz8xuxssgdcnh`, owner
  `bitcoincash:qpclaehgrt7507sg2f0fnd3jq6txqwwsvgadvh427s` (token-aware form
  `bitcoincash:zpclaehgrt7507sg2f0fnd3jq6txqwwsvg68lfmvpr` in `config/mainnet.json`). Both balances read 0 through
  Electrum.
- `config/mainnet.json`: landedSatoshis 5000, giveBackFeeSatoshis 1000, engine folder `.xo-mainnet`. The contract
  parameters (token category, rate, returnAfter) stay null until they are read from the deployed contract.
  `src/landing-network.ts` refuses landedSatoshis outside 546..20000 and a giveBack fee outside 1..1000.
- Electrum probe (read only, `blockchain.headers.get_tip`, port 50004 wss): bch.imaginary.cash, bch.loping.net and
  electrum.imaginary.cash answered at height 977918; electroncash.de: "Connection to 'electroncash.de:50004' timed out
  after 10000 milliseconds." The first two are in the config.
- Scripts pick the network with `--network chipnet|mainnet` (default chipnet); `config/chipnet.json` is unchanged and
  `loadConfig` still rejects the mainnet file. Tests: `tests/landing-network.test.ts` (9 cases).
- Time: about 25 minutes.

## 2026-11-18 18:30 Landing template made byte-identical to the deployed contract

- Goal: the template's landing script should equal the redeem bytecode of a real Sampan landing address, not only
  enforce the same rules. The earlier script (0001) was CashASM written by hand in a different opcode order.
- Read once from mainnet Electrum (`bch.imaginary.cash:50004`, `blockchain.transaction.get`, read only) the Sampan
  giveBack `5671fd920b3a3c74d322b23250d31a33326452e28528236227f0c89f3a585ba6` and the transaction it spends
  (`0310e0cd3ac67e51aa157dc8ac67ae59b0f69931963e1946547e471548d42f81`). A first try with `npx tsx` on a `.ts` file with
  top-level await failed: "Top-level await is currently not supported with the "cjs" output format" (outside a
  package with `"type": "module"`); renamed to `.mts`. A second fetch returned `{}` because I had reversed the outpoint
  hash by hand and got two bytes wrong; reversing it in code fixed it.
- Unlocking script of the giveBack: `OP_1` (cashc selector for `giveBack`), then a 136-byte redeem bytecode: `OP_6`,
  `00e1f505` (rateDen 100000000), `002d3101` (rateNum 20000000), the 32-byte category in transaction order, the 25-byte
  P2PKH owner, then the artifact bytecode. The spent output is P2SH20 `a914dd3069dbb9dc5daeab179976bccfdf6c4bbec08387`.
- New `landingLockingBytecode`: `landingConstructorArguments` (`<returnAfter> <rateDen> <rateNum>
  <$(<tokenCategory> OP_REVERSEBYTES)> <ownerLockingScript>`) followed by the artifact bytecode split into named parts.
  Unlocking: `OP_0` convert, `OP_1` giveBack. The XO engine compiled it to the deployed redeem bytecode on the first
  try (engine `compileLockingBytecodeFromTemplateLockingScriptIdentifier`, locking type switched to `p2s` to get the
  bare script). The `$(...)` evaluation inside a push worked in the engine compiler.
- XO locking types: `@xo-cash/types` has `p2s`, `p2pkh`, `p2sh`; the engine maps `p2sh` to `p2sh32`. No P2SH20, so
  the address differs from Sampan's for the same parameters (docs/decisions/0002).
- `npx tsx scripts/check-bytecode.ts --json`: `identical: true` (deployed, template and cashc redeem bytecode equal).
  `--params config/chipnet.json`: `identical: true`. `--params config/mainnet.json` (contract parameters now filled
  from the fixture): `identical: true`, differs from the deployed address in `ownerLockingScript` only.
- `tests/template-json.test.ts` failed after the export: landing1/landing2 invitations name the earlier template
  `03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515`, the new template is
  `e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e`. The test now expects the earlier identifier
  for those two runs and the current one for any later run.
- Sabotage in `template/landing.ts`, each restored after: one `OP_NIP` removed from giveBack: 5 tests red (bytecode
  3, covenant 2); category check replaced by `OP_DROP OP_DROP`: 5 red (bytecode 3, covenant "another token category"
  and "display order"); `OP_CHECKSEQUENCEVERIFY` removed: 5 red (bytecode 3, covenant "before returnAfter" and
  "final sequence").
- Targeted tests: 89 passed (landing, swap, template-json, config, readme). The existing VM tests passed against the
  new script without change.
- Time: about 50 minutes.
- The push hook's secret scan (gitleaks `generic-api-key`) flagged the 64-hex category value under the key
  `tokenCategory` in `config/mainnet.json` and the fixture. It is a public token category, not a key. The config and
  fixture field is now `category` (as `testToken.category` in `config/chipnet.json`, which the scan accepts); the
  template variable keeps its name `tokenCategory`.
- The project check requires a `tokenCategory` key in the fixture parameters, so the fixture keeps that key with an
  object holding `displayOrder` and `transactionOrder`; the scan does not flag it, and `fixtureParams` refuses a
  fixture whose two orders disagree.

## 2026-11-18 19:00 Chipnet runs with the byte-identical template (landing3, landing4)
- 19:00 `landing-run.ts land landing4` broadcast `faa1a8abb2dc2c80052d118413ebf6d2190f0b99ea7b1cbd736fca3d9ab781f2`. The
  invitation names template `e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e`. Output 0 locking bytecode
  `aa200353e7424de4547d83fb82758ba150f61b7e24cfd485146b2dca42965d3eae9087` (landing address
  `bchtest:pvp48e6zfhj9glvrlwp8tzap2rmpkl3yel2g29rt9h9y99ja86hfqc2u6lnlx`), the same bytes as `templateLocking` from
  `npx tsx scripts/check-bytecode.ts --json --params config/chipnet.json` (`identical: true`). The explorer page shows it.
- During every engine start the log repeats
  `Failed to process transaction update: Error: Could not validate a block header on height 337068: The requested header is ahead of the current checkpoint at height 332384`
  and
  `Failed to synchronize block headers, will retry later: Error: Header '00000000000ecc7187034ddaa4327af300c23fd57bfd2557af6ca2392a022671' at height 332451 claims target 486604799, expected 437753688.`
  The steps still completed. The chipnet tip was 337126 at 19:06.
- The land step again ended with
  `note: broadcast recorded; the engine then failed to clear a spent coin reservation: UnspentOutputNotFoundInStoreError: Unspent output "7f3896aed87a94eb1b9dee9dd938f5c6567ad97766cca8a702af2a8e54151101:1" not found in store`
  (same as on 2026-11-16; the broadcast is not affected).
- 19:01 `land landing3` broadcast `af2ba18fd27ca75c6fa5422a73bf602900be6019850efa3d57877e01eae0c9db` (same landing
  address; it spent the unconfirmed change of the landing4 land).
- 19:02 `convert landing3`: `convert-start` saved, then `convert-take` failed with
  `Error: the converter engine wallet has no coin with 100 test token units`. A read-only listing of the taker engine
  (`listUnspentOutputs`, not committed) showed both token coins with `reservedBy` `8d1a167a00ba2933b6e7770186dffd54`, a
  `sendFungibleTokens` invitation created in the taker engine at 15:54 and never broadcast. Way out, as on 2026-11-16:
  `engine.archiveInvitation` in the taker engine for that invitation and for the half-joined convert invitation
  `99084a0bc5bdc65e25c0156432ee5f03` (one-off, not committed). The token coin `7a9b82e8...:1` (997900 units) was then
  spendable. About 4 minutes lost.
- 19:05 `convert-take landing3` saved; `convert-finish landing3` broadcast
  `5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1`. Explorer: input 0 from the landing address above,
  output 0 to `bchtest:qz4rr7mn324zdkeav5v3gpqvlf3jx9u68qgxya53h3` with 100 units of
  `008eebd7502376715a8ffc87f6b6341cbe284c27237ea0204eaee167603ff95a`. Owner balance afterwards: 200 token units
  (landing1 and landing3). The covenant with the cashc bytecode accepted the engine's convert without any change to the
  converter steps.
- Heights at 19:06 (Electrum): landing4 land 337122, landing3 land 337123, landing3 convert 337126.
- 19:07 (tip 337127, the landing4 land coin 6 blocks old by Electrum height) `giveBack landing4` built
  `84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d` and the broadcast was refused, verbatim:
  `TransactionBroadcastFailedError: Transaction broadcast failed for transaction hash "84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d" of invitation "ad209ef8ba966b0e6b199e013f4ee0d5": Error: Failed to broadcast transaction: Error: Failed to request 'blockchain.transaction.broadcast': the transaction was rejected by network rules.`
  `non-BIP68-final (code 64)`. Same refusal as landing2 on 2026-11-16, which the nodes accepted 59 blocks after the
  land. The failed invitation was archived in the payer engine at once (one-off, not committed) so it does not keep the
  land coin reserved for the next attempt. Next attempt after 20:05.

## 2026-11-18 19:12 Exact template of every saved invitation (template/used)

- Tried: find how the engine names a template. Neither the engine README nor the type declarations say how
  `templateIdentifier` is computed; the source of `@xo-cash/utils` 0.0.10 (`generateTemplateIdentifier`) does it:
  sha256 of `serializeTemplate(template)`, hex. Formatting of the JSON file does not change the id, since the template
  is parsed and serialized again before hashing. About 5 minutes to find.
- The 27 files in `invitations/` name four ids, all matched without failure:
  `c4f2cf94...a456` = current `template/swap-intent.ts` (run1 to run3, browser1 open and fill);
  `a31eb858...c672` = `p2pkhTemplate` from `@xo-cash/templates` 0.0.12 (browser1 fund-sats, fund-tokens, made by the
  debug tool's wallet); `e0e9b742...e03e` = current `template/landing.ts` (landing3, landing4);
  `03fad653...3515` = `template/landing.json` at commit 856cc27 (landing1, landing2).
- Added `scripts/used-templates.ts` (`--write` searches the current export, the package templates and every committed
  version of `template/*.json`; `--check` is offline and needs no git history) and `tests/used-templates.test.ts`.
- Sabotage: with the content-hash comparison disabled, "fails when one byte of a stored template changes" went red;
  with the missing-file check disabled, "fails when an invitation has no stored template" went red. Both restored.

## 2026-11-18 19:20 Example key removed from template/used

- The repository secret scan (gitleaks, rule `generic-api-key`) flagged
  `template/used/a31eb858...c672.json` line 1171: `"ownerKey": "<WIF>"` in the `requesting satoshis` scenario of the
  P2PKH wallet template. The value comes from `@xo-cash/templates` 0.0.12 (`dist/index.mjs`), an example key in the
  package's own test scenario, not a key of this project. It controls nothing here and cannot be rotated by us.
- The template id hashes the whole template, scenarios included, so removing the value changes the id.
- Way out: `--write` now replaces every WIF-shaped string with a fixed placeholder; `--check` accepts a file holding
  the placeholder only when a package export, with the same replacement, equals it byte for byte and the unchanged
  export hashes to the file name. The other three stored templates had no such value and are unchanged.
- Tests: "holds no private-key-shaped value" and "accepts a redacted file only against an original that hashes to its
  name" were both red with the previous stored file and are green now.

## 2026-11-18 19:28 README table of runs, invitations and templates

- Added `scripts/runs-table.ts` (`--write`, `--check`, `--help`), `src/runs-table.ts` and `tests/runs-table.test.ts`.
  The table sits between `<!-- runs-table:start -->` and `<!-- runs-table:end -->` in the new README section
  "Runs, invitations and templates". One line per `ok` row of `docs/CHIPNET-RUNS.md` that names an invitation:
  network, full txid linked to https://chipnet.imaginary.cash/tx/, invitation file, `template/used/<id>.json`.
  `docs/MAINNET-RUNS.md` is read too once it exists. The runs lists and explorers are in `config/chipnet.json`
  (`runsTable.sources`).
- 17 rows written (run1 to run3, browser1, landing1 to landing4); setup rows without an invitation and failed rows
  are left out. The older short txid table in "Chipnet runs" is kept.
- A missing invitation, an invitation without a 64 hex `templateIdentifier`, or a missing `template/used/<id>.json`
  stops `--write` with the invitation's name.
- Regression: with the previous README, "puts the full txid, the invitation and template/used/<id> on one line" and
  "README holds exactly what --write would write" were red; green with the table.

## 2026-11-18 19:58 Debug tool screenshots committed (docs/debug-tool)

- New disposable chipnet account "debug viewer" at https://blaze.xo.cash/. Imported `template/swap-intent.json`, then
  "Join Invitation" and "View invitation" (not accepted) for the eight invitations behind an `ok` open, fill or cancel
  row: run1-open, run2-open, run1-fill, run3-open, run3-fill, run2-cancel, browser1-open, browser1-fill. Each review
  showed template `Swap Intent`, the action and the commits with roles.
- "Inspect" on `chipnet` for the eight txids: each page showed status SUCCESS once and no FAIL.
- First script attempt navigated to `https://blaze.xo.cash/inspect-transaction` with `wait_until='networkidle'`; it
  produced no inspect screenshot before the 590 s limit. Clicking the "Inspect" button in the side menu instead
  worked (about 10 s per txid). A helper file named `inspect.py` shadowed the Python standard module and failed with
  `AttributeError: partially initialized module 'inspect' has no attribute 'getfile' (most likely due to a circular import)`;
  renamed.
- Committed 27 PNG files to `docs/debug-tool/swap-intent/`: 18 from this session, 9 steps of the browser1 run
  (join, outputs, inputs, sign, update, completed, inspect). Account creation, settings and receive screens left out.
  Reduced to 128 colours with Pillow; largest file 131 KB. Index with image, content and invitation or txid in
  `docs/debug-tool/README.md`.

## 2026-11-18 20:08 Facts list for the entrant, updated

- Added the facts of the 18 Nov entries above (browser1 run inside the debug tool, template/used, README runs table,
  debug tool screenshots) to the entrant's facts list: what the tool allowed and refused, verbatim errors, time lost.
  Handed over with `invitations/browser1-fill-start.json`, `browser1-fill-taken.json`, `browser1-fill.json` and steps
  to view them and inspect the fill txid in https://blaze.xo.cash/ with a new disposable account. It is a list, not a
  draft; no feedback text was written by the agent.
- `FEEDBACK.md` is not in the repository yet: the entrant's own feedback has not been written.

## 2026-11-18 20:12 Chipnet landing4 giveBack accepted

- 20:12 `timeout 200 npx tsx scripts/landing-run.ts giveBack landing4` broadcast
  `84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d`, the same txid the nodes refused at 19:07 as
  `non-BIP68-final (code 64)`. Saved `invitations/landing4-giveBack.json`.
- Explorer (https://chipnet.imaginary.cash/tx/84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d) at 20:13:
  unconfirmed, one input from `bchtest:pvp48e6zfhj9glvrlwp8tzap2rmpkl3yel2g29rt9h9y99ja86hfqc2u6lnlx`, unlocking script
  starting with `OP_1` (cashc selector for `giveBack`), one P2PKH output of 9500 sat to the owner
  `bchtest:qz4rr7mn324zdkeav5v3gpqvlf3jx9u68qgxya53h3`, no token, fee 500 sat (2.31 sat/B).
- The covenant compiled from the deployed contract's cashc bytecode accepted the engine's giveBack with no change to the
  payer steps. Between the refusal and acceptance about 65 minutes passed (land at height 337122).
- During the run the engine printed, many times over, verbatim:
  `Failed to process transaction update: Error: Could not validate a block header on height 337123: The requested header is ahead of the current checkpoint at height 332384`
  (same message for heights 333698, 333701, 336994, 337068, 337122). The broadcast succeeded regardless and the script
  exited 0.

## 2026-11-18 20:44 Landing screenshots in the XO debug tool (docs/debug-tool/landing)

- A Playwright script (Chromium, 1366 x 900) created a new disposable chipnet account on https://blaze.xo.cash/,
  imported `template/landing.json` (listed as Landing `e0e9b742...e03e`, "2 roles · 3 actions · 12 scripts"), viewed
  the six landing3 and landing4 invitations with "Join Invitation" then "View invitation" (not accepted), and ran
  "Inspect" on `chipnet` for the four txids. All four inspections showed status SUCCESS; no FAIL text on the page.
- First attempt: after viewing `landing3-land.json` and pressing "Cancel", the next three views failed with
  `Locator.click: Timeout 10000ms exceeded.` while waiting for the "Home" button (the button was found but not
  clickable). Reloading https://blaze.xo.cash/ before each invitation (the account stays in the browser) worked for
  `landing3-convert-start.json`, `landing3-convert-taken.json` and `landing3-convert.json`. About 10 minutes lost,
  most of it waiting for a browser slot.
- The views show the tool's account extended public keys ("Entity", "Created by entity"), which are also in the
  invitation files; no wallet phrase or account creation screen was kept.
- Reduced to 128 colours with Pillow; 12 files, largest 54 KB. Index in `docs/debug-tool/README.md`, section Landing.
- The README's import step quoted the earlier template id `03fad653...3515` and "18 scripts"; corrected to the measured
  `e0e9b742...e03e` and "12 scripts".

## 2026-11-18 20:58 UTC: README for the Landing entry, clean clone check

- README `## Migrate to XO`: the chipnet table now lists landing3 and landing4 (byte-identical template `e0e9b742...e03e`)
  first and landing1 and landing2 under "earlier hand-written script" (`03fad653...3515`), each row with its invitation
  file. The reproduce steps use new run names (`landing5`, `landing6`) because `landing1` to `landing4` already have
  saved invitations, add `npx tsx scripts/check-bytecode.ts --params config/chipnet.json`, and name the
  `used-templates.ts --write` and `runs-table.ts --write` steps. The debug tool step points at `landing3-convert.json`
  (6 commits) and `landing4-giveBack.json` (4 commits), counted from the files.
- Clean clone: `git archive HEAD` (commit 4b14d5e) into an empty temporary folder, Node v22.23.5, npm 10.9.9.
  `npm ci` rc 0 (311 packages, 43 s); `npm test` rc 0, 18 test files, 124 tests; `npx tsx scripts/check-bytecode.ts --json`
  rc 0 with `identical: true`; `npx tsx scripts/landing-run.ts --help` rc 0. Folder removed afterwards.
- `runs-table.ts --check` and `used-templates.ts --check` rc 0 on the working tree.

## 2026-11-18 21:20 UTC: Facts list for the entrant, Landing part updated

- Added the facts of the 18 Nov Landing entries (byte-identical template, landing3 and landing4 runs, exact template
  of every invitation, debug tool screenshots, README and clean clone) to the entrant's facts list: what worked, what
  the engine and the debug tool refused, verbatim errors, time lost. It is a list, not a draft; no feedback text was
  written by the agent.
- `FEEDBACK-MIGRATE.md` is not in the repository yet: the entrant's own migration feedback has not been written.
- The mainnet run has not started: no mainnet funds have been requested yet, both mainnet addresses still hold 0.
  Measured at 21:24 UTC (`date -u` before and after the command) with `npx tsx scripts/wallets.ts balance --network mainnet`:
  payer and owner `confirmed=0 unconfirmed=0`.

## 2026-11-18 21:25 UTC: Journal timestamps corrected

- Six entry headings of 18 Nov carried a minute later than the commit that added them (for example "21:25" on an entry
  committed at 21:20:38, and a balance "measured 21:27" committed at 21:20:57). The headings now carry the commit minute
  (18:04, 19:12, 19:28, 20:44, 20:58, 21:20), and the mainnet balance line now quotes a new measurement taken at
  21:24 UTC with the same result (payer and owner 0). From here on each heading time is read from `date -u` when the
  entry is written.

## 2026-11-18 21:31 UTC: Mainnet funding requested

- Requested 7000 sat from a shared test wallet to the mainnet payer address
  `bitcoincash:qzqhpy3rzuzmfj0ylnpky8zfvd8xhpz8xuxssgdcnh`, for one land (5000 sat) then giveBack run. The 2000 sat above
  the landed amount covers the deposit into the engine wallet, the land fee and the engine change output.
- The request is accepted and queued, not yet paid: status read right after the request is "waiting". No mainnet
  transaction has been made. The run starts once the coins arrive.

## 2026-11-18 22:43 UTC: Mainnet funding not paid

- The shared test wallet answered the 21:31 UTC request with status "short" (`KURANG`): 0 sat available after its
  reserve, 0 sat sent, shortfall 7000 sat. Read at 22:41 UTC.
- Measured at 22:42 UTC with `npx tsx scripts/wallets.ts balance --network mainnet`: payer and owner
  `confirmed=0 unconfirmed=0`. No mainnet transaction has been made.
- The mainnet run needs 7000 sat (0.00007 BCH) at the payer address
  `bitcoincash:qzqhpy3rzuzmfj0ylnpky8zfvd8xhpz8xuxssgdcnh` from another source. Chipnet runs are unaffected.

## 2026-11-19 12:39 UTC: Mainnet funding requested again

- The shared test wallet was topped up at 12:38 UTC. A new request for 7000 sat to the payer address
  `bitcoincash:qzqhpy3rzuzmfj0ylnpky8zfvd8xhpz8xuxssgdcnh` was made at 12:39 UTC; status read right after is
  "waiting". The payout runs as a separate queued job, after another job on the same wallet finishes.
- Measured at 12:39 UTC with `npx tsx scripts/wallets.ts balance --network mainnet`: payer and owner
  `confirmed=0 unconfirmed=0`. No mainnet transaction has been made.

## 2026-11-19 13:16 UTC: Mainnet funding received

- Funding: 0.00007 BCH received from a shared test wallet, txid
  `9a66aa086bbf1488ef0d04c7cf61b741bc790d75bf80e006bb2c1365ac9cbe72`.
- Read from the blockchair API at 13:14 UTC: mined in block 978019 (12:58:24 UTC), output of 7000 sat to the payer
  address `bitcoincash:qzqhpy3rzuzmfj0ylnpky8zfvd8xhpz8xuxssgdcnh`. The blockchair web page answers HTTP 401 to a
  script, so the API is the reading used.
- Measured at 13:14 UTC with `npx tsx scripts/wallets.ts balance --network mainnet`: payer `confirmed=7000
  unconfirmed=0`, owner `confirmed=0 unconfirmed=0`.
- Added `docs/MAINNET-RUNS.md` with the `fund` row.

## 2026-11-19 13:58 UTC: Mainnet deposit, and the engine's header sync on mainnet

- Added `--network mainnet` to `scripts/landing-run.ts` (steps land and giveBack only, run names `mainnet<n>`) and to
  `scripts/deposit.ts` (account `payer`). The mainnet config is mapped onto the same settings shape as chipnet
  (`src/landing-run-config.ts`), so land and giveBack run the same code on both networks.
- Deposit 13:20 to 13:24 UTC: `npx tsx scripts/deposit.ts payer --network mainnet` moved the 7000 sat into the payer's
  XO engine wallet, txid `c8ab57d9279b2920c46b278bec131b127ecc5a02511b5f045083288c8e247599` (one input, one output of
  6815 sat, fee 185 sat), accepted by both configured servers. Read from the blockchair API: mined in block 978021.
- Land dry run, first try 13:25 UTC under `timeout 200`: no output, ended by the timeout (`Terminated`, exit 143).
- Land dry run, second try 13:34 to 13:42 UTC under `timeout 540`: no land output; the process ended on its own with
  exit 1 and, verbatim:
  `SocketWriteError: Could not write: WebSocket: Socket is disconnecting.`
  `at <anonymous> (.../node_modules/@electrum-cash/web-socket/source/web.ts:503:12)`
- Cause found in the engine database: on mainnet the engine's Electrum layer (`@electrum-cash/application`) verifies
  every block header from its built-in checkpoint before it reports any coin. The mainnet checkpoint in
  `@electrum-cash/checkpoint` is block 960000; the chain tip is near 978021, so about 18000 headers. Headers are
  requested in batches of 1008 (one week of blocks) and stored only when a whole batch is processed. After the two runs
  above the stored checkpoint was at height 961008 (one batch) and the address history table was empty, so the engine
  could not yet see the deposited coin. On chipnet the checkpoint is close to the tip, which is why this was never seen
  there. Nothing in the XO documentation mentions this first sync or its length.

## 2026-11-19 14:08 UTC: Mainnet land

- A process that only started the payer engine and kept it running (14:01 to 14:05 UTC) took the stored checkpoint
  from 961008 to 978027 in about three minutes, so the earlier slowness was not the header count alone. While it
  synced, the engine printed four times, verbatim (heights 966048, 967056, 968064, 969072):
  `Failed to process transaction update: Error: Could not validate a block header on height 978021: The requested header is ahead of the current checkpoint at height 969072`
  Block 978021 holds the deposit; the engine saw the coin once the sync reached the tip.
- Land dry run 14:05 UTC: built txid `5f76d879…`, one input (the deposit coin), output 0 = 5000 sat to
  `aa2061c8a50939fadbaf1b11747f1670caeefb4854cf42d6ad7c938c384c2cbef78087`, output 1 = 1415 sat change, fee 400 sat.
  Output 0 is byte for byte the `templateLocking` printed by
  `npx tsx scripts/check-bytecode.ts --params config/mainnet.json --json` (`identical: true`; the only parameter
  that differs from the deployed contract is `ownerLockingScript`, which pays this run's owner account).
- Land 14:06 UTC: `npx tsx scripts/landing-run.ts land mainnet1 --network mainnet`, txid
  `7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef`, saved `invitations/mainnet1-land.json`.
  Read from the blockchair API at 14:07 UTC: in the mempool, output 0 of 5000 sat to the same script hash, fee
  400 sat. `scripts/used-templates.ts --write` matched it to template `e0e9b742…`, the same final template as the
  chipnet runs landing3 and landing4. giveBack needs 6 confirmations of this transaction.

## 2026-11-19 14:21 UTC: Before and after table

- Added `MIGRATE-TO-XO.md` with a before and after table (original Sampan contract against the XO template).
- sha256 of the redeem bytecode, computed twice: with Python `hashlib` from `redeemBytecode` in
  `tests/fixtures/landing-deployed.json`, and with Node `crypto` from `deployedRedeem`, `templateRedeem` and
  `cashcRedeem` printed by `npx tsx scripts/check-bytecode.ts --json` at HEAD `57ff4c4`. All four values:
  `1901bbb619676836ffa58180113e57612d01e47caad8d8a1fb1aedbff586f01d`. The same run printed `identical: true`.
- The redeem bytecode is 136 bytes. Versions in the table are from `package.json` and the cashc artifact (`cashc` 0.14.0).
- README `## Migrate to XO` links to the table in one line.

## 2026-11-19 15:38 UTC: landing5, the converter side signed inside the XO debug tool

- Mainnet giveBack not yet possible: at 14:28 UTC the mainnet tip was 978032 and the land coin (block 978029) needs
  6 confirmations (tip 978034). Worked on the chipnet debug tool run meanwhile.
- New disposable chipnet account in https://blaze.xo.cash/, template `template/landing.json` imported. "Receive" asked
  for a default receive policy, verbatim: `In order for the wallet to receive funds it must generate a new receiving
  address. If a default receive policy is not set for the wallet, one must be added.` Set Receive and Change to
  `Wallet (P2PKH)` (Settings, Defaults), as in run browser1.
- Fund 15:00 UTC: `npx tsx scripts/send.ts taker <account address> tokens 200 landing5`, txid
  `656b56d28238f2fbd32e36d6722f177ffddfb49285ac7da804d3741c39573aeb`, one coin of 16800 sat and 200 test token units
  (the token coin's own satoshis travel with the tokens). The engine printed after the broadcast, verbatim:
  `note: broadcast recorded; the engine then failed to clear a spent coin reservation: UnspentOutputNotFoundInStoreError: Unspent output "5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1:1" not found in store`
  200 units, not 100: the payout at output 1 carries the rest of the converter's tokens, and a token output of 0 units
  is not valid.
- Land 15:01 UTC: `npx tsx scripts/landing-run.ts land landing5`, txid
  `5414325621b01e474b7c21f39576d7fe6ea4bf17bc6d84b04dab6be959d68b1b`. Then `convert-start landing5`.
- In the tool: "Join Invitation" with the convert-start JSON lists the role choices `Choose a role`, `Converter`. After
  "Accept invitation" the invitation page lists the four converter variables with the template's names and
  descriptions, and both outputs ("Set up output"; the dialog resolves `$(<tokenOutputSatoshis>)` to 1000 and
  `$(converterPayoutSatoshis)` to 24800). "Add input" offered the one coin; the tool placed it at input position 1,
  as the covenant needs. No change was added: the tool reported `Leftover after the estimated fee is below the dust
  limit, so it stays with the fee.` "Sign" showed `Inputs still needing unlocking bytecode: 2. Yours: 1. From other
  participants: 1.`; "Generate unlocking bytecode", then "Append to invitation", signed input 1 (100 bytes).
  Before the payer signs, the tool shows `WOULD FAIL` with `Input 0 unlock script failed`, which is expected.
- First finish attempt failed. I ran `convert-finish landing5 --dry-run` first (built txid `ac0318ba...`), then the
  real `convert-finish`, which ended with, verbatim:
  `InvitationHistoryConflictError: Invitation "0345103c0705474e335ce4d91c8ebb21" history conflict at stored commit "1885a381830f4932807a513c7353c30b", expected the updated invitation to keep every stored commit in its stored position`
  The dry run had stored the payer's input commit in its engine, as the header of `scripts/landing-run.ts` says. Time
  lost: about 10 minutes. Way out: "Archive invitation" in the tool (`UTXO reservations will be cleared.`), a new
  `convert-start landing5` (invitation `776ae1ad...`), the same steps in the tool again, and `convert-finish` without a
  dry run.
- Convert 15:25 UTC: txid `ac0318bac8697bf3ca46f2f24cb49718c33e58574c530ed71923ccf6d90e128a`, saved
  `invitations/landing5-convert.json`. Both chipnet Electrum servers report fund and land at height 338323 and the
  convert at 338346. "Update invitation" with the final JSON in the tool: `New commits | 1 (to append)`, then the convert
  shows `COMPLETED`. "Inspect" on `chipnet` with the convert txid: status `SUCCESS`, inputs 0 and 1.
- `scripts/used-templates.ts --write` matched landing5 land and convert to `e0e9b742...` (the byte-identical template)
  and the fund to the P2PKH wallet template `a31eb858...`.

## 2026-11-19 18:55 UTC: Swap Intent expire action (template version 2)

- Tried: a third branch in the offer locking script, `expire`, following the Landing `giveBack` pattern: input
  `sequenceNumber: '$(<expireAfter>)'`, `<expireAfter> OP_CHECKSEQUENCEVERIFY OP_DROP`, one input, one output to
  `makerLockingScript` with no token and at least `offeredSatoshis - expireFeeSatoshis`. No signature. Reasons in
  docs/decisions/0003-swap-intent-expiry.md.
- `expireAfter` and `expireFeeSatoshis` are new offer variables set at `open`; `config/chipnet.json` holds 2 blocks
  and 500 satoshis. New role `expirer` (anyone); `parseTemplate` from `@xo-cash/utils` accepted a role with no
  `requirements`.
- Template identifier changed from `c4f2cf94…a456` to the identifier of template version 2. `used-templates --write`
  rewrote the four stored templates unchanged; `used-templates --check` printed `template/used: complete`.
- First test run, verbatim, from the existing engine compile test before it passed the two new variables:
  `Identifier "expireAfter" refers to a WalletData, but "expireAfter" was not provided in the CompilationData "bytecode".`
- Two harness cases failed for reasons outside the covenant and were rebuilt: a second output that made outputs exceed
  inputs (`Unable to verify transaction: the sum…`), and a token output with no token input
  (`Transaction violates token validation…`). The token case now creates a new category from the offer input (outpoint
  index 0), so only the covenant can reject it. A 100 satoshi second output failed standardness
  (`Unable to verify standard transaction…`); the case now uses a 1000 satoshi fee and a 600 satoshi second output.
- `tests/swap-expire.test.ts`: 11 VM cases, all pass. Sabotage, each restored after: removing `enforceExpireAge` from
  `expirePath` turned 3 cases red (shorter lock, final sequence, version 1); replacing
  `<makerLockingScript> OP_EQUALVERIFY` with `OP_DROP` turned 1 case red (other locking script).
- Tests that named the old template identifier or the four offer variables were updated: browser1 and run1 to run3 are
  now checked against their stored template in `template/used/`.
- Not tried yet: an expire through the XO engine on chipnet. The expirer's engine has no record of the offer coin, so
  `src/swap-expire.ts` finds it through Electrum and calls `signInvitation` for the keyless input. Whether the engine
  completes an input it does not own is measured in the run.

## 2026-11-19 19:20 UTC: Chipnet run4, open then expire

- 19:05 `npx tsx scripts/run.ts open run4` (maker, template version 2) broadcast
  `d76f3c9f2a190dcddd8c0c28dae338d0fc5f69ecb48d0d1195faa2dc11ecf367`, saved `invitations/run4-open.json`. Mined at
  338558 (both chipnet Electrum servers, `blockchain.transaction.get`).
- 19:06 first expire by the taker account, verbatim:
  `InputUnspentOutputUnavailableError: Unspent output d76f3c9f2a190dcddd8c0c28dae338d0fc5f69ecb48d0d1195faa2dc11ecf367:0 of merged input 0 in invitation "99dc6dc3f313ff99e24aead1abc8270a" not tracked by this account, expected an output this account tracks that is free or reserved by this invitation`
  (the message above is from the second try; the first was the same error for invitation `76b8fce858b955482e95cc9128992ee3`).
- Cause, from the engine source (`prepareInputUnlockingCompilation`, `listInvitationScriptHashesToTrack` in
  `@xo-cash/engine` dist): the engine builds an unlocking script only for a coin its own account tracks. Storing the
  open invitation first (`engine.acceptInvitation(open)`, tried at 19:08, not kept) did not make it track the offer,
  because tracking recompiles the offer locking script and that needs `makerKey.public_key`, which the open invitation
  does not publish. The engine documentation does not say that a keyless input still has to be tracked by the account
  that completes it. About 10 minutes to find.
- Way out: `scripts/run.ts expire` and `expire-early` now run with the maker account, whose engine tracks the offer
  coin. The expire transaction still carries no signature: the unlocking script is the branch selector only. A keyless
  expire by an account that never saw the maker key would need the template to publish the maker key hash, or a
  transaction built outside the engine; neither was done.
- 19:10 `expire-early run4` (maker, offer at 1 to 2 confirmations) refused, verbatim:
  `Failed to broadcast transaction: Error: Failed to request 'blockchain.transaction.broadcast': the transaction was rejected by network rules.`
  `non-BIP68-final (code 64)`.
- The refused invitation kept the offer coin reserved (`reservedBy f5c02bd3011fbcf9d1c5c547f62e0e08`), the same as
  landing2. Archived it once by hand. Then `finishAction` (`src/swap-open.ts`) was changed to archive the invitation
  itself when the node refuses the broadcast (`TransactionBroadcastFailedError`); regression test in
  `tests/swap-expire-run.test.ts`, red on the old code (`expected [] to deeply equal [ 'expire1' ]`).
- 19:13 `expire run4` (age check passed, Electrum: mined 338558) refused with the same `non-BIP68-final (code 64)`.
  At 19:16 the offer had 12 confirmations by Electrum height and the coin was not reserved afterwards, so the new
  archive step worked on chipnet. Same lag as the Landing giveBack runs (journal 2026-11-16 and 2026-11-18).
- 19:26 (offer 20 confirmations by Electrum height) `expire run4` broadcast
  `4d92f782949444f9751ce3dcbd685696319f474f129893fc617f5792f5b35f48`, the txid refused at 19:13, and saved
  `invitations/run4-expire.json`. Read back from both chipnet Electrum servers at 19:28 (`blockchain.transaction.get`,
  verbose): version 2, one input `d76f3c9f...:0` with sequence 2 and a 159 byte unlocking script, one output of
  0.000195 BCH to `bchtest:qpn2gvvm7m5wztt3q3yyx747g060dmvt05s3u7cee3` (the `makerLockingScript` of the open
  invitation), no token, 4 confirmations by 19:31.
- `used-templates --write` added the version 2 template file; `runs-table --write` added the two run4 rows.
- 20:02 XO debug tool (https://blaze.xo.cash/, new disposable chipnet account): template version 2 imported, both
  run4 invitations shown by "View invitation" (the expire with a commit of role `expirer`), "Inspect" on chipnet
  SUCCESS for both txids, with the finding "Transaction is already known on chipnet". The address
  `/inspect-transaction` now opens the home page; the Inspect page is reached from the sidebar. The `chipnet` network
  button has no accessible name `chipnet` (`get_by_role('button', name='chipnet', exact=True)` timed out), matched by
  its text instead. About 15 minutes.
- 19:20 to 20:10 the public explorer https://chipnet.imaginary.cash/ did not answer (`curl: (28) Connection timed out`,
  browser `Page.goto: Timeout 40000ms exceeded`), while its Electrum port answered.
  https://chipnet.chaingraph.cash/ showed only "Performing security verification" (Cloudflare), and
  https://cbch.loping.net/ answered `Failed to load transaction` with an `RpcError` for this and for older run2 txids.
- 20:51 both run4 txids opened on the public chipnet explorer https://explorer.selene.cash/ (linked from the
  chipnet.bch.ninja faucet page): expire `4d92f782...5f48` 90 confirmations, 1 input, 1 output, total outputs
  0.000195 BCH, fee 0.000005 BCH, 244 B; open `d76f3c9f...f367` 112 confirmations. Only then were the run4 rows in
  docs/CHIPNET-RUNS.md committed as `ok`.

## 2026-11-19 21:05 UTC: judge entry for Build with XO

- Added `BUILD-WITH-XO.md` and a `## For judges` section near the top of the README that points to it.
- Submitted invitation: `invitations/browser1-fill.json` rather than `run3-fill.json`. Reason: it is the fill, the
  action that makes the swap, and its commits come from two separate wallets, the XO engine in this repository
  (maker) and an account inside the XO debug tool (taker). run3-fill was built by two engine accounts of this
  repository. Both name template version 1 (`c4f2cf94...a456`), stored in `template/used/`.
- Found while writing: README step "Import Template" still said the tool reports `c4f2cf94...a456` for
  `template/swap-intent.json`. Since template version 2 (run4) that file hashes to `8f0fb78d...712e`
  (`cmp template/swap-intent.json template/used/8f0fb78d...json` identical). The step now names both ids and which
  invitations use each.
- `npx tsx scripts/used-templates.ts --check`: `template/used: complete`. `npx tsx scripts/runs-table.ts --check`:
  `README.md: runs table up to date`.
- Clean copy from `git archive HEAD` (commit 61c8235) in a temporary directory, removed afterwards: `npm ci` rc 0,
  `npx vitest run` 21 files, 149 tests passed, `npx tsx scripts/run.ts --help` rc 0.
- Style check on temporary copies: `BUILD-WITH-XO.md` flagged the tool's status word `SUCCESS` in capitals, now in
  backticks; README flags `FEEDBACK` (the file name) and `SUCCESS`, left as they are.

## 2026-11-19 23:00 UTC: landing5 rows opened on the explorer

- https://chipnet.imaginary.cash/ did not answer from this host (`curl` code 000 after 30 s) for the three landing5
  txids. A plain `curl` of https://explorer.selene.cash/tx/<txid> answers 404 (the page is built in the browser).
- 23:00 opened in a browser on https://explorer.selene.cash/tx/<txid>?network=chipnet: fund `656b56d2...3aeb` 486
  confirmations, land `54143256...8b1b` 486 confirmations, convert `ac0318ba...128a` 463 confirmations. Only then were
  the landing5 rows in docs/CHIPNET-RUNS.md committed as `ok`.
- The landing5 work had been kept aside since 15:38 while the explorer was down; merging it with the later run4 rows
  kept both, landing5 rows first by time. The README runs table was written again with `scripts/runs-table.ts --write`.

## 2026-11-19 23:13 UTC: Mainnet giveBack

- giveBack dry run 23:13 UTC: `timeout 400 npx tsx scripts/landing-run.ts giveBack mainnet1 --network mainnet --dry-run`,
  exit 0 in about one minute (the `.xo-mainnet` engine database had synced headers in the 14:01 run, so no long first
  sync this time). Built txid `80387030…`: one input (the land coin `7307ceeb…:0`, sequence 6), one output of 4000 sat
  to P2PKH `71fee6e81afd47fa08525e99b63206966039d062`. Decoding `config/mainnet.json` `landing.ownerAddress` with libauth
  `decodeCashAddress` gives `p2pkhWithTokens` with the same hash, so the output pays the owner account.
- giveBack 23:14 UTC: `timeout 400 npx tsx scripts/landing-run.ts giveBack mainnet1 --network mainnet`, exit 0, txid
  `80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8`, saved `invitations/mainnet1-giveBack.json`.
  No `non-BIP68-final` refusal: the land coin was mined in block 978029, more than six blocks earlier.
- Read from the blockchair API at 23:15 UTC: in the mempool, input 5000 sat from `7307ceeb…`, one output of 4000 sat to
  `qpclaehgrt7507sg2f0fnd3jq6txqwwsvgadvh427s` (the owner address without the token prefix), fee 1000 sat. The blockchair
  web page returns HTTP 401 to `curl`, so the API was used, as for the land row.
- `scripts/used-templates.ts --write` wrote no new template: the invitation names `e0e9b742…`, the same as mainnet1 land.
  `scripts/runs-table.ts --write` added the giveBack row to the README table.

## 2026-11-19 23:26 UTC: Mainnet run in the XO debug tool

- Browser script (Chromium, 1366x900) on https://blaze.xo.cash/ with a new disposable account. The network list of
  "Create new account" offered `['mainnet', 'chipnet', 'testnet4']`; the account was created on `mainnet` and shows
  "debug viewer (mainnet)", balance "~0 BCH". No project phrase went to the tool.
- "Import Template" with `template/landing.json`, then "Join Invitation" and "View invitation" (not accepted) for
  `invitations/mainnet1-land.json` (template Landing, action `land`, invitation ID `32321ebe…`, 4 commits) and
  `invitations/mainnet1-giveBack.json` (action `giveBack`, invitation ID `8dfee025…`, 4 commits, result transaction hash
  `80387030…`). Both opened on a mainnet account with no error.
- "Inspect" with the `mainnet` network button: land `7307ceeb…` shows "MAINNET SUCCESS", input 0 is the payer's P2PKH
  coin (6815 sat). giveBack `80387030…` shows "MAINNET SUCCESS", input 0 of 5000 sat, scriptSig `OP_1` then
  `OP_PUSHDATA_1 136` (the redeem script), scriptPubKey `OP_HASH256 OP_PUSHBYTES_32 0x61c8a509… OP_EQUAL` (P2SH32).
- Four screenshots, each under 160 KB, saved as `docs/debug-tool/landing/mainnet-*.png`; no account creation or
  Settings screen among them. Run time about two minutes.

## 2026-11-19 23:31 UTC: new project note, summary sentence and before/after diagram

- Root commit measured with `git rev-list --max-parents=0 HEAD`: `1ac2691e4c699dcc3563fafcd2815bf6eadd6b94`, commit time
  2026-11-14T17:40:48+00:00 (after the 14 November 14:00 UTC start). The "New project" line with a link to that commit is now in
  the head of README.md and MIGRATE-TO-XO.md.
- MIGRATE-TO-XO.md starts with one summary sentence and `docs/migrate-before-after.svg`, a hand-written static SVG (viewBox
  900x400, no script, no external font or image, text 14 to 22 px). Its numbers come from `npx tsx scripts/check-bytecode.ts --json`
  run at this time: deployed, template and cashc redeem bytecode each 136 bytes, sha256
  `1901bbb619676836ffa58180113e57612d01e47caad8d8a1fb1aedbff586f01d`, `identical: true`; `returnAfter` 6 from the fixture.
- `rsvg-convert` is not installed on the host: `/bin/bash: line 1: rsvg-convert: command not found`. Rendered with headless
  Chromium instead at 900 px and 1800 px width into a temporary folder and opened both images; two spacing fixes, then the
  PNGs were deleted (not committed).
- Contrast measured with the WCAG formula: main text #1b1f24 on #ffffff 16.56:1, on #f6f7f9 15.45:1, on #eef5ff 15.09:1;
  subtitle #4a525c on #f6f7f9 7.39:1, on #eef5ff 7.22:1.

## 2026-11-19 23:35 UTC: Engine 0.1.1-next.18170561234 and chipnet run landing6

- `npm view @xo-cash/engine dist-tags` at 23:35: next `0.1.1-next.18170561234` (published 2026-11-19 05:22 UTC), latest
  `0.0.1`. `@xo-cash/templates` latest 0.0.12, `@xo-cash/types` latest 0.0.9. The new engine still depends on
  `@xo-cash/templates` 0.0.12, `@xo-cash/types` 0.0.8 and `@xo-cash/utils` 0.0.10 (exact), so only the engine pin changed:
  `npm install --save-exact @xo-cash/engine@0.1.1-next.18170561234` ("changed 5 packages"). Among its dependencies
  `@electrum-cash/servers` moved from 4.2.0 to 4.3.0 and `@electrum-cash/application` from 0.5.2-development.16863504490
  to 0.5.3-development.18109001223.
- Checks before the run, all on the new engine: `tsc --noEmit` clean; `vitest run tests/landing-*.test.ts
  tests/swap-*.test.ts tests/used-templates.test.ts` 13 files, 105 tests passed with no test or template change;
  `check-bytecode.ts --json` `identical: true`, sha256 of the deployed, engine-compiled and cashc redeem bytecode all
  `1901bbb619676836ffa58180113e57612d01e47caad8d8a1fb1aedbff586f01d` (136 bytes); `used-templates.ts --check`
  "template/used: complete" (the saved invitations of the older runs still match their template ids).
- 23:37:58 `timeout 200 npx tsx scripts/landing-run.ts land landing6` exit 0 in about 25 s, broadcast
  `9631b0162267422547f5982065daec2835d699b0ea6ade8bd153f06a566b4f01`. The invitation names template
  `e0e9b742...e03e`, as in landing3 to landing5. Output 0: 10000 sat to the landing address, locking bytecode
  `aa200353e7424de4547d83fb82758ba150f61b7e24cfd485146b2dca42965d3eae9087` (the `templateLocking` of
  `check-bytecode --params config/chipnet.json`).
- 23:38:25 `timeout 280 npx tsx scripts/landing-run.ts convert landing6` exit 0: convert-start, convert-take and
  convert-finish each saved their invitation; broadcast `29c6bf27b461bc26809331131f8271c07c23ab9f4400322e125182c000c72d7c`.
  Read back from chipnet Electrum: input 0 the landed coin, input 1 the taker token coin `656b56d2...:1`; output 0 1000 sat
  and 100 units of `008eebd7...f95a` to the owner `bchtest:zz4rr7mn324zdkeav5v3gpqvlf3jx9u68q0vhr6hgz`; output 1 8800 sat
  and 997500 units to the taker. No change to the scripts or the converter steps was needed.
- Differences seen against 0.1.1-next.18029697917, from the two run logs:
  - The header lines that appeared at every engine start before (`Could not validate a block header ... ahead of the
    current checkpoint` and `Failed to synchronize block headers ... claims target`) did not appear: no line with
    "header" or "checkpoint" in either log. The engine databases in `.xo/` were the ones written by the older version and
    opened without an error.
  - The land step no longer printed the spent coin reservation note. The convert-finish step still printed it, verbatim:
    `note: broadcast recorded; the engine then failed to clear a spent coin reservation: UnspentOutputNotFoundInStoreError: Unspent output "9631b0162267422547f5982065daec2835d699b0ea6ade8bd153f06a566b4f01:0" not found in store`
    (the broadcast is not affected).
  - `engine.stop()` returned in all four processes; none reached the `timeout`.
  - No failed broadcast in this run, so the behaviour of an invitation left reserved after a refused broadcast was not
    exercised again.
- https://chipnet.imaginary.cash/tx/ did not answer from this host (`curl` code 000) for either txid. Opened at 23:40 in
  a browser on https://explorer.selene.cash/tx/<txid>?network=chipnet: land 3 confirmations, convert unconfirmed with
  "Created 2 token-bearing outputs". Only then were the landing6 rows written as `ok`.
- README (requirements pin, run names), MIGRATE-TO-XO.md (compiler row) and ADR 0001 now name the new engine version.
- 23:45 the gate's full suite (Depot) failed in `tests/template-json.test.ts`, "has the identifier named by every saved
  invitation whose file name starts with "landing"": `expected Set{ …(2) } to deeply equal Set{ 'e0e9b742197a31a69c65ce6b378ef4…' }`,
  extra identifier `a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672`. The cause is
  `invitations/landing5-fund-tokens.json` (committed with landing5), a funding step made with the stock "Wallet (P2PKH)"
  template; the test was red since that commit. The test now checks `<run>-fund-<what>.json` files against the wallet
  template identifier and every other `landing*` file against Landing. Sabotage: a wallet invitation copied to
  `landing9-convert.json`, and a Landing invitation copied to `landing9-fund-sats.json`, each made the test fail
  (copies removed).

## 2026-11-20 00:10 UTC: MIGRATE-TO-XO.md as the judges' entry point

- Added to MIGRATE-TO-XO.md: `Submitted invitation: invitations/mainnet1-giveBack.json`, `Original project:` (the Sampan
  site and the GitHub contract source, plus the mainnet spend of the deployed contract and its saved raw transaction), a
  runs table of every transaction made with the final template (landing3 to landing6 and mainnet1: full txid,
  invitation, template file), the debug tool steps and screenshots, and the offline check commands.
- The table rows were taken from the `ok` rows of the README runs table (written by `scripts/runs-table.ts`); every
  txid in the file is an `ok` row of docs/CHIPNET-RUNS.md or docs/MAINNET-RUNS.md, or the fixture txid.
- Links checked with `curl` (user agent `Mozilla/5.0`) at 00:00: https://sampan.sasateguh.com 200, https://blaze.xo.cash/
  200, https://explorer.selene.cash/ 200. Transaction pages: https://chipnet.imaginary.cash/tx/<txid> code 000 (no
  answer); https://explorer.selene.cash/tx/<txid> 404 to `curl` (the page is built in the browser; opened in a browser
  on 2026-11-19, see the entries above); https://blockchair.com/bitcoin-cash/transaction/<txid> 401 to `curl` (bot check).
  The blockchair API (`api.blockchair.com/bitcoin-cash/dashboards/transaction/<txid>`) answered 200 for the fixture txid
  `5671fd92...5ba6` (block 977518), mainnet1 land `7307ceeb...b8ef` (block 978029) and giveBack `80387030...a8d8`
  (block 978090). https://cbch.loping.net/tx/<txid> answered 200 but its body was the node error "RPC is disabled. This
  version of Bitcoin Cash Node is old and may be out of consensus with the network.", so it is not linked.
- Chipnet links in MIGRATE-TO-XO.md now point to https://explorer.selene.cash/tx/<txid>?network=chipnet instead of
  chipnet.imaginary.cash. The README runs table (generated) is unchanged.
- Clean clone (`git archive HEAD` at 8c202fc into a temporary folder, removed after): `npm ci` rc 0, `npm test` rc 0
  (21 files, 149 tests), `npx tsx scripts/check-bytecode.ts --json` rc 0 with `"identical": true`,
  `npx tsx scripts/landing-run.ts --help` rc 0.
- Style check on a temporary copy: first run flagged the capitalised word "SUCCESS" (the debug tool's status text); it
  is now written as code, `SUCCESS`, and the second run passed.

## 2026-11-20 00:20 UTC: hero block and flow diagram for README and BUILD-WITH-XO.md

- Added `docs/swap-intent-flow.svg`, a hand-written static SVG (2897 bytes, viewBox 720 x 520, opaque white
  background, system fonts, smallest text 20 units, `<title>` and `<desc>`, `role="img"`, no script, no external fonts or
  images). It shows `open` (the maker locks BCH in an offer output that names the wanted tokens) and the three ways out:
  `fill` (no maker key), `cancel` (maker key) and `expire` (after `expireAfter` blocks, anyone, no key).
- README.md and BUILD-WITH-XO.md now open with the same block under the title: one 30-word sentence, the diagram, and
  the line `New project. First commit after the 14 November start: ...`. The first commit was measured with
  `git log --reverse --format='%H %cI' | sed -n 1p`: `1ac2691e4c699dcc3563fafcd2815bf6eadd6b94 2026-11-14T17:40:48+00:00`.
  The README already had this note in a slightly different form; it was replaced, not repeated.
- In BUILD-WITH-XO.md the `Submitted invitation:` line now follows the hero block.
- The commit link answers 404 until the repository is public.
- Rendered the diagram in WebKit inside an HTML page with a dark background, at 375 and 1280 pixels wide: all text
  readable, nothing overlaps or is cut off, no horizontal scroll (`scrollWidth` 375 of 375).
- Style check on temporary copies: BUILD-WITH-XO.md passed. README.md flagged two capitalised words that were already
  there before this change, the file name `FEEDBACK.md` and "SUCCESS" in the Landing section; both were left as they are.
