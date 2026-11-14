# Swap Intent: an XO template for CashTokens swaps on chipnet

An entry for the "Build with XO" bounty at BCH BLAZE 2026.

Build journal, written by the AI coding agent while it worked. The feedback in FEEDBACK.md was written by the entrant, by hand.

## What it is

Swap Intent is an XO template with two roles:

- `maker` opens an offer: locks some BCH and states which CashToken category and how many tokens they want for it.
- `taker` fills the offer: pays the wanted tokens to the maker and takes the BCH.
- `maker` can cancel an open offer and take the BCH back.

The offer is enforced by the locking script, not by either party: a fill is valid only if the output at the same index as the
offer input pays the maker's locking bytecode, carries the wanted token category, and carries at least the wanted token amount.

Status: work in progress. The template, the offline tests and open -> fill on chipnet are done; cancel is next. The
[build journal](JOURNAL.md) records each step with timestamps.

## Requirements

- Node.js 22 (see `.nvmrc`) and npm.
- Package versions are pinned exactly in `package.json` and `package-lock.json`.
- Chipnet only. Nothing in this repository targets mainnet.

## Setup

```sh
npm ci
npx tsx scripts/wallets.ts generate   # creates .env (mode 0600) with a maker and a taker test phrase; prints addresses only
npx tsx scripts/wallets.ts balance    # chipnet balance of both funding addresses
npx tsx scripts/mint-test-token.ts fund   # maker sends coins to the taker for fees
npx tsx scripts/mint-test-token.ts mint   # maker creates a fungible test token and sends it to the taker
npx tsx scripts/deposit.ts maker      # moves the maker's coins into its XO engine wallet
npx tsx scripts/deposit.ts taker      # moves the taker's coins and test tokens into its XO engine wallet
npx tsx scripts/run.ts fill run1      # open -> fill on chipnet through the XO engine, one process per step
bash scripts/gerbang-ujian.sh         # offline checks: typecheck and unit tests, no network
```

Both token commands accept `--dry-run`. After `mint`, put the printed category into `testToken.category` in
`config/chipnet.json`. Every chipnet transaction is listed in [docs/CHIPNET-RUNS.md](docs/CHIPNET-RUNS.md).

Chipnet coins come from a public chipnet faucet such as https://chipnet.bch.ninja/ or https://tbch.googol.cash/.
Settings that may change (Electrum servers, derivation path, explorers, amounts) live in `config/chipnet.json`.

## Chipnet runs

`scripts/run.ts` drives `@xo-cash/engine` for each account (engine databases under `.xo/`, ignored by git). Each step is
its own process and the accounts exchange only invitation files:

1. `open` (maker): locks `swap.offeredSatoshis` in the offer and states the wanted token and amount.
2. `fill-start` (maker): starts the `fill` invitation with the offer coin at input 0. Only the maker's engine tracks the
   offer coin and holds the key whose public key is in the redeem script, so the maker supplies that input.
3. `fill-take` (taker): joins as `taker`, adds the token payment to the maker at output 0, the payout to itself, its own
   coins and change, and signs its inputs.
4. `fill-finish` (maker): adds the offer input's unlocking bytecode and broadcasts.

`npx tsx scripts/run.ts fill <run>` runs the four steps in order, each in its own process. To withdraw an open offer
instead, `npx tsx scripts/run.ts cancel <run>` (maker, same engine as `open`) spends the offer back to the maker's
locking script, less the template's `cancelFeeSatoshis`.

Every step accepts `--dry-run` (build and check without broadcasting). Transactions so far:

| Run | Action | Txid |
| --- | --- | --- |
| run1 | open | [74fb6c7b...3b99](https://chipnet.imaginary.cash/tx/74fb6c7b5299ec2be0e0b4832ab4c4bd6837f8904505fe0905b932c0c77c3b99) |
| run1 | fill | [326ee1c1...6862](https://chipnet.imaginary.cash/tx/326ee1c18edae7a42317c062237028150145d6f8e8cd5579baa3653e094d6862) |
| run2 | open | [66b0a6d5...8d85](https://chipnet.imaginary.cash/tx/66b0a6d5cb7b263e960bfa4ed9d9c8ec3952501dc4d7ae3f8a22edcaa2768d85) |
| run2 | cancel | [8472ca5d...e110](https://chipnet.imaginary.cash/tx/8472ca5d982bff800fa471f0811b5c9a3af597c96b8dd0e73d555a7ed44de110) |
| run3 | open | [c96a9289...88ce](https://chipnet.imaginary.cash/tx/c96a928911e301a808859080fbd842004ab47e79992f63023110a5f3884388ce) |
| run3 | fill | [f6d03597...a7a2](https://chipnet.imaginary.cash/tx/f6d0359759159ac189383ea76155d2bc7dad63d153c67f95ca9162df6ab0a7a2) |

The saved invitations are in [invitations/](invitations/); the full list, failures included, is in
[docs/CHIPNET-RUNS.md](docs/CHIPNET-RUNS.md).

## Open a saved invitation in the XO debug tool

The XO debugging wallet at https://blaze.xo.cash/ reads the saved invitations and the chipnet transactions. Use a new
disposable account there; no funds are needed to view.

1. Open https://blaze.xo.cash/, choose "Create new account", set the network to `chipnet`, then "Save and use account".
2. "Import Template", paste the contents of [template/swap-intent.json](template/swap-intent.json) and choose
   "Import JSON". The tool reports `Template imported: Swap Intent (c4f2cf94...a456)`. Regenerate the file with
   `npx tsx scripts/export-template.ts` after changing `template/swap-intent.ts`.
3. "Join Invitation", paste a file from [invitations/](invitations/) (for example `run2-cancel.json`) and choose
   "View invitation". The tool lists the action, each commit with its role, and the broadcast result. Choose "Cancel"
   to leave without accepting.
4. "Inspect", choose `chipnet` and paste a txid from the table above. The script debugger steps through each input;
   the offer input shows the redeem script with the fill and cancel branches.

## AI disclosure

The code, tests, README and build journal in this repository were written by an AI coding agent working for the entrant,
with the entrant reviewing the result. The feedback in FEEDBACK.md was written by the entrant, by hand, without AI.

## Related

The entrant's main BCH BLAZE 2026 project is Sampan: https://sampan.sasateguh.com and https://github.com/aimanmalib/sampan

## License

MIT, see [LICENSE](LICENSE).
