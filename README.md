# Swap Intent: an XO template for CashTokens swaps on chipnet

OTC offers of BCH for CashTokens without an online maker or escrow: whoever pays the wanted tokens fills the offer,
and expired offers return to the maker without a key.

![Swap Intent: open, then fill, cancel or expire](docs/swap-intent-flow.svg)

New project. First commit after the 14 November start: [1ac2691](https://github.com/aimanmalib/sampan-xo/commit/1ac2691e4c699dcc3563fafcd2815bf6eadd6b94) (2026-11-14 17:40 UTC).

An entry for the "Build with XO" bounty at BCH BLAZE 2026. The same repository also holds the "Migrate to XO" entry:
the Sampan landing contract as an XO template, see [Migrate to XO](#migrate-to-xo).

## For judges

- Build with XO: [BUILD-WITH-XO.md](BUILD-WITH-XO.md) (submitted invitation, the four chipnet flows, how to check).
- Build with XO, taker side in the XO debug tool: [33 s clip](docs/debug-tool/swap-intent/taker-clip.mp4) of run browser2.
- Migrate to XO: [MIGRATE-TO-XO.md](MIGRATE-TO-XO.md) (before and after diagram, same redeem bytecode, chipnet and mainnet runs).

## What it is

Swap Intent is an XO template with three roles:

- `maker` opens an offer: locks some BCH and states which CashToken category and how many tokens they want for it.
- `taker` fills the offer: pays the wanted tokens to the maker and takes the BCH.
- `maker` can cancel an open offer and take the BCH back.
- `expirer` (anyone) can return an offer that is `expireAfter` blocks old to the maker, with no key (template version 2).

The offer is enforced by the locking script, not by either party: a fill is valid only if the output at the same index as the
offer input pays the maker's locking bytecode, carries the wanted token category, and carries at least the wanted token amount.

Status: template, offline tests and the chipnet flows fill, cancel and expire are done; see the [journal](JOURNAL.md).

```mermaid
sequenceDiagram
    participant M as maker
    participant O as offer output (P2SH32)
    participant T as taker
    M->>O: open: lock offeredSatoshis, state wantedCategory and wantedAmount
    alt fill
        T->>M: output at the offer's index: wantedAmount tokens of wantedCategory
        O->>T: offeredSatoshis
    else cancel
        M->>O: maker signature
        O->>M: offeredSatoshis less cancelFeeSatoshis
    else expire, once the offer is expireAfter blocks old
        O->>M: at least offeredSatoshis less expireFeeSatoshis, no key
    end
```

Template variables:

| Variable | Set by | Meaning |
| --- | --- | --- |
| `offeredSatoshis` | maker on `open` | BCH locked in the offer; the taker receives all of it on fill |
| `wantedCategory` | maker on `open` | CashToken category the maker wants, in explorer byte order |
| `wantedAmount` | maker on `open` | minimum fungible token amount the maker wants |
| `makerLockingScript` | maker on `open` | where the tokens (on fill) or the refund (on cancel or expire) go |
| `expireAfter` | maker on `open` | offer age in blocks after which anyone can expire it (relative lock, `config/chipnet.json` `swap.expireAfterBlocks`) |
| `expireFeeSatoshis` | maker on `open` | most the expire transaction may keep as fee (`swap.expireFeeSatoshis`) |
| `makerKey` | generated on `open` | key whose signature is the only way to cancel |
| `takerLockingScript` | taker on `fill` | where the taker receives the offered satoshis |

The template source is [template/swap-intent.ts](template/swap-intent.ts); the same template as JSON for import into
XO tools is [template/swap-intent.json](template/swap-intent.json) (`npx tsx scripts/export-template.ts` writes it).

## Requirements

- Node.js 22 (see `.nvmrc`) and npm.
- Package versions are pinned exactly in `package.json` and `package-lock.json`. The ones that matter: `@xo-cash/engine`
  0.1.1-next.18170561234, `@xo-cash/templates` 0.0.12, `@xo-cash/types` 0.0.8, `@xo-cash/utils` 0.0.10, `@bitauth/libauth`
  3.1.0-next.8, `@electrum-cash/network` 4.4.8, `typescript` 5.9.3, `tsx` 4.23.15, `vitest` 3.2.7. Swap Intent runs run5,
  run6 and browser2 (20 November) used this engine; run1 to run4 and browser1 (14 to 19 November) used 0.1.1-next.18029697917.
- The Swap Intent runs on chipnet only. The Landing template has one minimum mainnet run (land, then giveBack),
  recorded in `docs/MAINNET-RUNS.md`; its amounts are limited in `src/landing-network.ts`.

## Setup, step by step

1. Install and run the offline checks (typecheck and unit tests, no network):

   ```sh
   npm ci
   npm test
   ```

2. Create two chipnet test wallets. This writes `.env` (mode 0600; the variable names are in `.env.example`) with a
   maker and a taker phrase and prints the two funding addresses only. Never put a mainnet phrase there.

   ```sh
   npx tsx scripts/wallets.ts generate
   ```

3. Get chipnet coins for the maker address from a public chipnet faucet such as https://chipnet.bch.ninja/ or
   https://tbch.googol.cash/ (100,000 satoshis is enough), then check:

   ```sh
   npx tsx scripts/wallets.ts balance
   ```

4. Send the taker coins for fees and create a fungible test token for it (outside XO, with libauth). After `mint`,
   put the printed category into `testToken.category` in `config/chipnet.json`.

   ```sh
   npx tsx scripts/mint-test-token.ts fund
   npx tsx scripts/mint-test-token.ts mint
   ```

5. Move each account's coins (and the taker's test tokens) into its XO engine wallet:

   ```sh
   npx tsx scripts/deposit.ts maker
   npx tsx scripts/deposit.ts taker
   ```

6. Run open -> fill, then a second offer with open -> cancel (next section):

   ```sh
   npx tsx scripts/run.ts fill run1
   npx tsx scripts/run.ts open run2
   npx tsx scripts/run.ts cancel run2
   npx tsx scripts/run.ts open run4
   # once the offer is swap.expireAfterBlocks blocks old (see Chipnet runs):
   npx tsx scripts/run.ts expire run4
   ```

The token, deposit and run commands accept `--dry-run` (build and check, no broadcast); `npx tsx scripts/run.ts --help`
prints the run steps. Settings that may change (Electrum servers, derivation path, explorers, amounts) live in
`config/chipnet.json`. Every chipnet transaction is listed in [docs/CHIPNET-RUNS.md](docs/CHIPNET-RUNS.md).

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

`npx tsx scripts/run.ts expire <run>` returns an offer that is at least `expireAfter` blocks old to the maker's locking
script: one input with sequence `expireAfter`, one output of `offeredSatoshis` less `expireFeeSatoshis`, no signature.
The script reads the offer coin from Electrum and refuses while it is younger. The step runs with the maker account:
the XO engine completes an input only for a coin its own account tracks, and an account without `makerKey` cannot
rebuild the offer script to track it. A refused attempt is archived so the step can be run again.

Every step accepts `--dry-run` (build and check without broadcasting). The chipnet transactions:

| Run | Action | Txid |
| --- | --- | --- |
| run1 | open | [74fb6c7b...3b99](https://chipnet.imaginary.cash/tx/74fb6c7b5299ec2be0e0b4832ab4c4bd6837f8904505fe0905b932c0c77c3b99) |
| run1 | fill | [326ee1c1...6862](https://chipnet.imaginary.cash/tx/326ee1c18edae7a42317c062237028150145d6f8e8cd5579baa3653e094d6862) |
| run2 | open | [66b0a6d5...8d85](https://chipnet.imaginary.cash/tx/66b0a6d5cb7b263e960bfa4ed9d9c8ec3952501dc4d7ae3f8a22edcaa2768d85) |
| run2 | cancel | [8472ca5d...e110](https://chipnet.imaginary.cash/tx/8472ca5d982bff800fa471f0811b5c9a3af597c96b8dd0e73d555a7ed44de110) |
| run3 | open | [c96a9289...88ce](https://chipnet.imaginary.cash/tx/c96a928911e301a808859080fbd842004ab47e79992f63023110a5f3884388ce) |
| run3 | fill | [f6d03597...a7a2](https://chipnet.imaginary.cash/tx/f6d0359759159ac189383ea76155d2bc7dad63d153c67f95ca9162df6ab0a7a2) |
| browser1 | open | [7f3896ae...1101](https://chipnet.imaginary.cash/tx/7f3896aed87a94eb1b9dee9dd938f5c6567ad97766cca8a702af2a8e54151101) |
| browser1 | fill | [f9215922...18a6](https://chipnet.imaginary.cash/tx/f92159229f9ec6b3b55feeb43ffc48cd67e297075d259671c8d6d41a71c118a6) |
| run4 | open | [d76f3c9f...f367](https://chipnet.imaginary.cash/tx/d76f3c9f2a190dcddd8c0c28dae338d0fc5f69ecb48d0d1195faa2dc11ecf367) |
| run4 | expire | [4d92f782...5f48](https://chipnet.imaginary.cash/tx/4d92f782949444f9751ce3dcbd685696319f474f129893fc617f5792f5b35f48) |

run5 (open -> fill), run6 (open -> cancel) and browser2 are listed in the table further down. The saved invitations are in
[invitations/](invitations/); the full list, failures included, is in [docs/CHIPNET-RUNS.md](docs/CHIPNET-RUNS.md).
Each invitation names its template by id; the exact template is in `template/used/<id>.json`. The id is the one the
XO engine computes (sha256 of the serialized template); `npx tsx scripts/used-templates.ts --check` confirms that every
invitation has its file and that each file hashes to its own name.

One exception: the P2PKH wallet template of `@xo-cash/templates` (`a31eb858...c672`, the fund invitations) has a public
example private key in its test scenario, replaced by a placeholder in the stored copy. That file is checked against the
package export with the same replacement, and the unchanged export must hash to the file's name.

## Runs, invitations and templates

One line per broadcast transaction with a saved invitation: network, txid (linked to an explorer), invitation file and
the exact template it names. `npx tsx scripts/runs-table.ts --write` writes it from the `ok` rows of
[docs/CHIPNET-RUNS.md](docs/CHIPNET-RUNS.md) and the mainnet run lists; `--check` confirms it is up to date. Setup
transactions without an invitation (token mint, plain deposits) and failed attempts are only in the run lists.

<!-- runs-table:start -->
| Network | Run | Action | Txid | Invitation | Template |
| --- | --- | --- | --- | --- | --- |
| chipnet | run1 | open | [74fb6c7b5299ec2be0e0b4832ab4c4bd6837f8904505fe0905b932c0c77c3b99](https://chipnet.imaginary.cash/tx/74fb6c7b5299ec2be0e0b4832ab4c4bd6837f8904505fe0905b932c0c77c3b99) | [invitations/run1-open.json](invitations/run1-open.json) | [template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json](template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json) |
| chipnet | run2 | open | [66b0a6d5cb7b263e960bfa4ed9d9c8ec3952501dc4d7ae3f8a22edcaa2768d85](https://chipnet.imaginary.cash/tx/66b0a6d5cb7b263e960bfa4ed9d9c8ec3952501dc4d7ae3f8a22edcaa2768d85) | [invitations/run2-open.json](invitations/run2-open.json) | [template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json](template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json) |
| chipnet | run1 | fill | [326ee1c18edae7a42317c062237028150145d6f8e8cd5579baa3653e094d6862](https://chipnet.imaginary.cash/tx/326ee1c18edae7a42317c062237028150145d6f8e8cd5579baa3653e094d6862) | [invitations/run1-fill.json](invitations/run1-fill.json) | [template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json](template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json) |
| chipnet | run3 | open | [c96a928911e301a808859080fbd842004ab47e79992f63023110a5f3884388ce](https://chipnet.imaginary.cash/tx/c96a928911e301a808859080fbd842004ab47e79992f63023110a5f3884388ce) | [invitations/run3-open.json](invitations/run3-open.json) | [template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json](template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json) |
| chipnet | run3 | fill | [f6d0359759159ac189383ea76155d2bc7dad63d153c67f95ca9162df6ab0a7a2](https://chipnet.imaginary.cash/tx/f6d0359759159ac189383ea76155d2bc7dad63d153c67f95ca9162df6ab0a7a2) | [invitations/run3-fill.json](invitations/run3-fill.json) | [template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json](template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json) |
| chipnet | run2 | cancel | [8472ca5d982bff800fa471f0811b5c9a3af597c96b8dd0e73d555a7ed44de110](https://chipnet.imaginary.cash/tx/8472ca5d982bff800fa471f0811b5c9a3af597c96b8dd0e73d555a7ed44de110) | [invitations/run2-cancel.json](invitations/run2-cancel.json) | [template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json](template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json) |
| chipnet | landing1 | land | [7883280023308e712beb1a51f5f9ba050dd740b7a8099fcf14e18a98437ca894](https://chipnet.imaginary.cash/tx/7883280023308e712beb1a51f5f9ba050dd740b7a8099fcf14e18a98437ca894) | [invitations/landing1-land.json](invitations/landing1-land.json) | [template/used/03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515.json](template/used/03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515.json) |
| chipnet | landing1 | convert | [7a9b82e8159b01bcf53e5c556f90d568a32961a4aef7551d119454bc7461d056](https://chipnet.imaginary.cash/tx/7a9b82e8159b01bcf53e5c556f90d568a32961a4aef7551d119454bc7461d056) | [invitations/landing1-convert.json](invitations/landing1-convert.json) | [template/used/03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515.json](template/used/03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515.json) |
| chipnet | landing2 | land | [a0e6da274c8c5881bfc5c0c103c4d64f1612d1d69b79aeac876fea165ffdce47](https://chipnet.imaginary.cash/tx/a0e6da274c8c5881bfc5c0c103c4d64f1612d1d69b79aeac876fea165ffdce47) | [invitations/landing2-land.json](invitations/landing2-land.json) | [template/used/03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515.json](template/used/03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515.json) |
| chipnet | landing2 | giveBack | [de83797632b64d4725fcd47ec9325fc49dc36cddf30fdd7d301137d01d1819dd](https://chipnet.imaginary.cash/tx/de83797632b64d4725fcd47ec9325fc49dc36cddf30fdd7d301137d01d1819dd) | [invitations/landing2-giveBack.json](invitations/landing2-giveBack.json) | [template/used/03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515.json](template/used/03fad65372a2941104b9256de44ed263452ea26e26b4a6bef39b9d44d20e3515.json) |
| chipnet | browser1 | fund | [95bb24063f8d4b67562e0a8d417fe4b0d1144b8821e85c8ad0559cd161a442b2](https://chipnet.imaginary.cash/tx/95bb24063f8d4b67562e0a8d417fe4b0d1144b8821e85c8ad0559cd161a442b2) | [invitations/browser1-fund-tokens.json](invitations/browser1-fund-tokens.json) | [template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json](template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json) |
| chipnet | browser1 | fund | [9288186e171e9fd123960c30252361bbe9025c7721c3597d197ff6b11c18e41d](https://chipnet.imaginary.cash/tx/9288186e171e9fd123960c30252361bbe9025c7721c3597d197ff6b11c18e41d) | [invitations/browser1-fund-sats.json](invitations/browser1-fund-sats.json) | [template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json](template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json) |
| chipnet | browser1 | open | [7f3896aed87a94eb1b9dee9dd938f5c6567ad97766cca8a702af2a8e54151101](https://chipnet.imaginary.cash/tx/7f3896aed87a94eb1b9dee9dd938f5c6567ad97766cca8a702af2a8e54151101) | [invitations/browser1-open.json](invitations/browser1-open.json) | [template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json](template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json) |
| chipnet | browser1 | fill | [f92159229f9ec6b3b55feeb43ffc48cd67e297075d259671c8d6d41a71c118a6](https://chipnet.imaginary.cash/tx/f92159229f9ec6b3b55feeb43ffc48cd67e297075d259671c8d6d41a71c118a6) | [invitations/browser1-fill.json](invitations/browser1-fill.json) | [template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json](template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json) |
| chipnet | landing4 | land | [faa1a8abb2dc2c80052d118413ebf6d2190f0b99ea7b1cbd736fca3d9ab781f2](https://chipnet.imaginary.cash/tx/faa1a8abb2dc2c80052d118413ebf6d2190f0b99ea7b1cbd736fca3d9ab781f2) | [invitations/landing4-land.json](invitations/landing4-land.json) | [template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing3 | land | [af2ba18fd27ca75c6fa5422a73bf602900be6019850efa3d57877e01eae0c9db](https://chipnet.imaginary.cash/tx/af2ba18fd27ca75c6fa5422a73bf602900be6019850efa3d57877e01eae0c9db) | [invitations/landing3-land.json](invitations/landing3-land.json) | [template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing3 | convert | [5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1](https://chipnet.imaginary.cash/tx/5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1) | [invitations/landing3-convert.json](invitations/landing3-convert.json) | [template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing4 | giveBack | [84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d](https://chipnet.imaginary.cash/tx/84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d) | [invitations/landing4-giveBack.json](invitations/landing4-giveBack.json) | [template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing5 | fund | [656b56d28238f2fbd32e36d6722f177ffddfb49285ac7da804d3741c39573aeb](https://chipnet.imaginary.cash/tx/656b56d28238f2fbd32e36d6722f177ffddfb49285ac7da804d3741c39573aeb) | [invitations/landing5-fund-tokens.json](invitations/landing5-fund-tokens.json) | [template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json](template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json) |
| chipnet | landing5 | land | [5414325621b01e474b7c21f39576d7fe6ea4bf17bc6d84b04dab6be959d68b1b](https://chipnet.imaginary.cash/tx/5414325621b01e474b7c21f39576d7fe6ea4bf17bc6d84b04dab6be959d68b1b) | [invitations/landing5-land.json](invitations/landing5-land.json) | [template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing5 | convert | [ac0318bac8697bf3ca46f2f24cb49718c33e58574c530ed71923ccf6d90e128a](https://chipnet.imaginary.cash/tx/ac0318bac8697bf3ca46f2f24cb49718c33e58574c530ed71923ccf6d90e128a) | [invitations/landing5-convert.json](invitations/landing5-convert.json) | [template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | run4 | open | [d76f3c9f2a190dcddd8c0c28dae338d0fc5f69ecb48d0d1195faa2dc11ecf367](https://chipnet.imaginary.cash/tx/d76f3c9f2a190dcddd8c0c28dae338d0fc5f69ecb48d0d1195faa2dc11ecf367) | [invitations/run4-open.json](invitations/run4-open.json) | [template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json](template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json) |
| chipnet | run4 | expire | [4d92f782949444f9751ce3dcbd685696319f474f129893fc617f5792f5b35f48](https://chipnet.imaginary.cash/tx/4d92f782949444f9751ce3dcbd685696319f474f129893fc617f5792f5b35f48) | [invitations/run4-expire.json](invitations/run4-expire.json) | [template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json](template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json) |
| chipnet | landing6 | land | [9631b0162267422547f5982065daec2835d699b0ea6ade8bd153f06a566b4f01](https://chipnet.imaginary.cash/tx/9631b0162267422547f5982065daec2835d699b0ea6ade8bd153f06a566b4f01) | [invitations/landing6-land.json](invitations/landing6-land.json) | [template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing6 | convert | [29c6bf27b461bc26809331131f8271c07c23ab9f4400322e125182c000c72d7c](https://chipnet.imaginary.cash/tx/29c6bf27b461bc26809331131f8271c07c23ab9f4400322e125182c000c72d7c) | [invitations/landing6-convert.json](invitations/landing6-convert.json) | [template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | run6 | open | [cc29d1c8151b91de2a7fa899412d61686b2d25afec0f650002fb1797baba04d4](https://chipnet.imaginary.cash/tx/cc29d1c8151b91de2a7fa899412d61686b2d25afec0f650002fb1797baba04d4) | [invitations/run6-open.json](invitations/run6-open.json) | [template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json](template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json) |
| chipnet | run5 | open | [70e14b031f3571ac477fc2634b6517f60f6bcad5374b53daa4634c4141dc1545](https://chipnet.imaginary.cash/tx/70e14b031f3571ac477fc2634b6517f60f6bcad5374b53daa4634c4141dc1545) | [invitations/run5-open.json](invitations/run5-open.json) | [template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json](template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json) |
| chipnet | run5 | fill | [565cc19f701d41f6dae8fe48b0a0de0ed7fae492b45c7610e47549d336ca8103](https://chipnet.imaginary.cash/tx/565cc19f701d41f6dae8fe48b0a0de0ed7fae492b45c7610e47549d336ca8103) | [invitations/run5-fill.json](invitations/run5-fill.json) | [template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json](template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json) |
| chipnet | run6 | cancel | [2670cc505471e5692f37ba7c1bd05bc38b92d44e7d9ac2e9fc8e8e49083fd355](https://chipnet.imaginary.cash/tx/2670cc505471e5692f37ba7c1bd05bc38b92d44e7d9ac2e9fc8e8e49083fd355) | [invitations/run6-cancel.json](invitations/run6-cancel.json) | [template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json](template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json) |
| chipnet | browser2 | open | [0b712fdf8958d3df4f6904dfb266f7d9c0919f906aca80b2850726551186d93e](https://chipnet.imaginary.cash/tx/0b712fdf8958d3df4f6904dfb266f7d9c0919f906aca80b2850726551186d93e) | [invitations/browser2-open.json](invitations/browser2-open.json) | [template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json](template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json) |
| chipnet | browser2 | fund | [d8a5128b774cb28693466d59141ed78930c159d6472cb14f1e7102c76dd6f47d](https://chipnet.imaginary.cash/tx/d8a5128b774cb28693466d59141ed78930c159d6472cb14f1e7102c76dd6f47d) | [invitations/browser2-fund-tokens.json](invitations/browser2-fund-tokens.json) | [template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json](template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json) |
| chipnet | browser2 | fund | [8892eb73414c3f1816cbe671e809dea5d44bb2924055f03fdb29b1f64ada87cd](https://chipnet.imaginary.cash/tx/8892eb73414c3f1816cbe671e809dea5d44bb2924055f03fdb29b1f64ada87cd) | [invitations/browser2-fund-sats.json](invitations/browser2-fund-sats.json) | [template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json](template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json) |
| chipnet | browser2 | fill | [c145510b5a1080e6e48755b7cd7bb08d6551cd6483c49d1b38832cb9b072c195](https://chipnet.imaginary.cash/tx/c145510b5a1080e6e48755b7cd7bb08d6551cd6483c49d1b38832cb9b072c195) | [invitations/browser2-fill.json](invitations/browser2-fill.json) | [template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json](template/used/8f0fb78d266c54d77852910b1ed8fb3772a1a7cd625dde6b548a247f9896712e.json) |
| mainnet | mainnet1 | land | [7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef](https://blockchair.com/bitcoin-cash/transaction/7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef) | [invitations/mainnet1-land.json](invitations/mainnet1-land.json) | [template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| mainnet | mainnet1 | giveBack | [80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8](https://blockchair.com/bitcoin-cash/transaction/80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8) | [invitations/mainnet1-giveBack.json](invitations/mainnet1-giveBack.json) | [template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
<!-- runs-table:end -->

## Open a saved invitation in the XO debug tool

The XO debugging wallet at https://blaze.xo.cash/ reads the saved invitations and the chipnet transactions. Use a new
disposable account there; no funds are needed to view.

1. Open https://blaze.xo.cash/, choose "Create new account", set the network to `chipnet`, then "Save and use account".
2. "Import Template", paste the contents of [template/swap-intent.json](template/swap-intent.json) and choose
   "Import JSON". The tool reports `Template imported: Swap Intent (8f0fb78d...712e)`, template version 2, named by
   the run4 invitations. The invitations of run1 to run3 and browser1 name version 1: import
   `template/used/c4f2cf9439468e95f8a43852b2c874d336ebb082652467766ed4cf03275aa456.json` for those.
3. "Join Invitation", paste a file from [invitations/](invitations/) (for example `run2-cancel.json`) and choose
   "View invitation". The tool lists the action, each commit with its role, and the broadcast result. Choose "Cancel"
   to leave without accepting.
4. "Inspect", choose `chipnet` and paste a txid from the table above. The script debugger steps through each input;
   the offer input shows the redeem script with the fill and cancel branches.

Screenshots of each step, for every saved Swap Intent invitation and transaction, are in
[docs/debug-tool/](docs/debug-tool/README.md).

## Take an offer from inside the XO debug tool

In runs `browser1` and `browser2` the taker was a new disposable chipnet account in https://blaze.xo.cash/, which built,
signed and exported its part of the fill; browser2 is recorded in
[taker-clip.mp4](docs/debug-tool/swap-intent/taker-clip.mp4). To do the same:

1. In the debug tool create a chipnet account and import `template/swap-intent.json` (steps 1 and 2 above). "Receive"
   asks for a default receive policy: choose "Set up default receive", then `Receive` and `Wallet (P2PKH)`. Do the same
   for `Change` under Settings, Defaults, or the tool cannot add change later. "Receive" then shows the address.
2. Fund that address from the maker's engine wallet:

   ```sh
   npx tsx scripts/send.ts maker <bchtest:address> tokens 1000 <run>
   npx tsx scripts/send.ts maker <bchtest:address> sats 30000 <run>
   ```

3. Open the offer and start the fill: `npx tsx scripts/run.ts open <run>`, then `npx tsx scripts/run.ts fill-start <run>`.
4. In the debug tool: "Join Invitation", paste `invitations/<run>-fill-start.json`, "View invitation", choose the role
   `Taker`, "Accept invitation", "Add to invitation". On the invitation page paste the account's address as
   `takerLockingScript` and "Add"; "Set up output" for both outputs with role `taker`; "Add input", "Select all";
   "Add change", "Add selected change"; then "Sign", "Generate selected", "Append to invitation". Every change asks
   for a confirmation ("Add to invitation").
5. "Copy invitation" and save the JSON as `invitations/<run>-fill-taken.json`, then
   `npx tsx scripts/run.ts fill-finish <run>` completes the offer input and broadcasts. "Update invitation" with
   `invitations/<run>-fill.json` shows the invitation as completed in the tool.

## Known limits

- The covenant checks only the output at the same index as the offer input. One offer is filled as a whole; there are
  no partial fills.
- The fill path needs no signature, so anyone who sees an open offer can fill it; the first valid transaction wins.
- Template version 2 adds `expire`: once an offer is `expireAfter` blocks old, anyone can return it to the maker
  without a key (docs/decisions/0003-swap-intent-expiry.md). Offers opened with version 1 (run1 to run3, browser1)
  have no expire branch and stay open until they are filled or cancelled.
- The expire transaction needs no key, but through the XO engine only an account that tracks the offer coin (the
  maker's) can build it. A third party would build it outside the engine.
- Through the XO engine in this repository, a fill is interactive: only the maker's engine tracks the offer coin, so the
  maker adds the offer input (`fill-start`) and its unlocking bytecode (`fill-finish`) around the taker's step.
- The cancel fee is a fixed template constant (`cancelFeeSatoshis`, 500 satoshis).
- `Engine.stop()` did not always settle during the chipnet runs, so the scripts wait at most
  `swap.engineStopTimeoutSeconds` for it and then exit.
- Chipnet test wallets only. The code has not been reviewed for use with real funds.

## Migrate to XO

A second entry in this repository, for the "Migrate to XO" bounty at BCH BLAZE 2026: the landing address contract of
Sampan, ported to an XO template named "Landing" and run on chipnet with two follow-up actions.

- Original project: https://sampan.sasateguh.com, source https://github.com/aimanmalib/sampan, contract
  `contracts/landing.cash` (CashScript, P2SH20). Sampan runs it on mainnet; nothing here touches that deployment.
- XO implementation: [template/landing.ts](template/landing.ts), exported for XO tools as
  [template/landing.json](template/landing.json); run script [scripts/landing-run.ts](scripts/landing-run.ts); saved
  invitations `invitations/landing*.json`; design record [docs/decisions/0001-migrate-landing.md](docs/decisions/0001-migrate-landing.md).
- Evidence: the locking script is byte-identical to the deployed Sampan contract ([Proof the port is faithful](#proof-the-port-is-faithful)),
  the chipnet runs of `land`, `convert` and `giveBack` are [below](#chipnet-runs-landing), and debug tool screenshots
  of each invitation and transaction are in [docs/debug-tool/](docs/debug-tool/README.md#landing).
- Before and after, side by side (source, compiler, redeem bytecode hash, P2SH wrapper, transactions): [MIGRATE-TO-XO.md](MIGRATE-TO-XO.md#before-and-after).

The original contract: anyone pays BCH to the landing address, and the coin can then leave only to the owner, either
converted to tokens at or above a minimum rate (`convert`) or returned as BCH once it is a few blocks old (`giveBack`).
No key of the service is needed for either path. The XO template keeps those rules in its locking script.

| Original (`contracts/landing.cash`) | XO template "Landing" |
| --- | --- |
| pay BCH to the contract address from any wallet | start action `land`, role `payer` |
| function `convert` | follow-up action `convert` on the landing output, role `converter` adds the token input |
| function `giveBack` | follow-up action `giveBack` on the landing output; no key, the runs use the payer |
| constructor `ownerLock` | variable `ownerLockingScript` |
| constructor `tokenCategory` | variable `tokenCategory` (explorer byte order, reversed inside the script) |
| constructor `rateNum`, `rateDen` | variables `rateNum`, `rateDen` |
| constructor `returnAfter` | variable `returnAfter`, carried as the sequence number of the `giveBack` input |

The rules enforced by the landing locking script, as in the original:

- `convert`: the landing coin is input 0, there are as many outputs as inputs, output 0 pays `ownerLockingScript` and
  carries fungible tokens of `tokenCategory`, and `tokenAmount * rateDen >= landedValue * rateNum`.
- `giveBack`: the landing coin is input 0 and at least `returnAfter` blocks old (`OP_CHECKSEQUENCEVERIFY`), one input and
  one output, output 0 pays `ownerLockingScript` with no token and at least the landed value less 1000 satoshis.

```mermaid
sequenceDiagram
    participant P as payer
    participant L as landing output (P2SH32)
    participant C as converter
    participant O as owner
    P->>L: land: landedSatoshis
    alt convert (any time)
        C->>O: output 0: at least landedSatoshis * rateNum / rateDen tokens
        L->>C: output 1: landedSatoshis
    else giveBack (returnAfter blocks later)
        L->>O: output 0: landedSatoshis less the fee, no token
    end
```

### Differences from the original

- **P2SH32 instead of P2SH20.** The template uses the XO `p2sh` locking type, which is P2SH32, so the landing address
  differs from the one Sampan computes for the same parameters. The redeem bytecode is the same: see
  `npx tsx scripts/check-bytecode.ts` and [docs/decisions/0002](docs/decisions/0002-byte-identical-port.md).
- **A `converter` role instead of a Cauldron pool.** Chipnet has no Sampan token and no pool for it. The fungible test
  token minted for the Swap Intent runs (`testToken.category` in `config/chipnet.json`) stands in, and the `taker`
  account, which holds it, adds the token input and receives the landed BCH. The contract never checked who provides the
  other inputs, so this changes the counterparty, not the rules.
- **The output count is fixed by the template.** The converter states its token coin's satoshis and tokens and the fee
  as variables, so `convert` has two inputs and two outputs and the engine adds no change output.
- The values used on chipnet live in `config/chipnet.json` under `landing`: 10000 landed satoshis, rate 1/100 (100 test
  token units for 10000 satoshis), `returnAfter` 6 as in Sampan, a 500 satoshi giveBack fee.

### Chipnet runs (Landing)

With the byte-identical template (template `e0e9b742...e03e`, see [Proof the port is faithful](#proof-the-port-is-faithful)):

| Run | Action | Txid | Invitation |
| --- | --- | --- | --- |
| landing3 | land | [af2ba18f...c9db](https://chipnet.imaginary.cash/tx/af2ba18fd27ca75c6fa5422a73bf602900be6019850efa3d57877e01eae0c9db) | [landing3-land.json](invitations/landing3-land.json) |
| landing3 | convert | [5c15f12c...abe1](https://chipnet.imaginary.cash/tx/5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1) | [landing3-convert.json](invitations/landing3-convert.json) |
| landing4 | land | [faa1a8ab...81f2](https://chipnet.imaginary.cash/tx/faa1a8abb2dc2c80052d118413ebf6d2190f0b99ea7b1cbd736fca3d9ab781f2) | [landing4-land.json](invitations/landing4-land.json) |
| landing4 | giveBack | [84db84e9...164d](https://chipnet.imaginary.cash/tx/84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d) | [landing4-giveBack.json](invitations/landing4-giveBack.json) |

With the earlier hand-written script (template `03fad653...3515`, same rules in a different opcode order):

| Run | Action | Txid | Invitation |
| --- | --- | --- | --- |
| landing1 | land | [78832800...a894](https://chipnet.imaginary.cash/tx/7883280023308e712beb1a51f5f9ba050dd740b7a8099fcf14e18a98437ca894) | [landing1-land.json](invitations/landing1-land.json) |
| landing1 | convert | [7a9b82e8...d056](https://chipnet.imaginary.cash/tx/7a9b82e8159b01bcf53e5c556f90d568a32961a4aef7551d119454bc7461d056) | [landing1-convert.json](invitations/landing1-convert.json) |
| landing2 | land | [a0e6da27...ce47](https://chipnet.imaginary.cash/tx/a0e6da274c8c5881bfc5c0c103c4d64f1612d1d69b79aeac876fea165ffdce47) | [landing2-land.json](invitations/landing2-land.json) |
| landing2 | giveBack | [de837976...19dd](https://chipnet.imaginary.cash/tx/de83797632b64d4725fcd47ec9325fc49dc36cddf30fdd7d301137d01d1819dd) | [landing2-giveBack.json](invitations/landing2-giveBack.json) |

All eight ran through the XO engine, including both follow-up actions. In the convert runs (landing3, landing1) the
owner received 100 test token units at output 0. In the giveBack runs (landing4, landing2) the owner received 9500
satoshis with no token. The first giveBack attempts were refused by the chipnet nodes as `non-BIP68-final` until about
an hour after the land coin was mined; the refusals are rows in [docs/CHIPNET-RUNS.md](docs/CHIPNET-RUNS.md) and the
measurements are in the [journal](JOURNAL.md). The exact template each invitation names is linked from
[Runs, invitations and templates](#runs-invitations-and-templates).

### Mainnet run (Landing)

One minimum mainnet run, `mainnet1`, with the byte-identical template (`e0e9b742...e03e`) and the values in
`config/mainnet.json`; every row is in [docs/MAINNET-RUNS.md](docs/MAINNET-RUNS.md).

| Run | Action | Txid | Invitation |
| --- | --- | --- | --- |
| mainnet1 | land | [7307ceeb...b8ef](https://blockchair.com/bitcoin-cash/transaction/7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef) | [mainnet1-land.json](invitations/mainnet1-land.json) |
| mainnet1 | giveBack | [80387030...a8d8](https://blockchair.com/bitcoin-cash/transaction/80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8) | [mainnet1-giveBack.json](invitations/mainnet1-giveBack.json) |

The land locked 5000 sat at the landing address. The giveBack, sent once the land coin was more than six blocks
old, paid the owner account 4000 sat (5000 landed, 1000 fee) as BCH with no token. Token category, `rateNum`, `rateDen` and `returnAfter` are those of the
deployed Sampan contract (`tests/fixtures/landing-deployed.json`); only `ownerLockingScript` differs, so the coin
returned to this run's owner account. No convert ran on mainnet. Screenshots of both invitations and both transactions
in the XO debug tool on `mainnet`: [docs/debug-tool/](docs/debug-tool/README.md#landing-mainnet-mainnet1).

### Reproduce the invitations

After steps 1 to 5 of the setup above (wallets, chipnet coins for the maker, test token and deposits):

1. Add the owner account. This appends `OWNER_MNEMONIC` to `.env` and refuses to replace a phrase that is already set.
   Put the printed token-aware owner address into `landing.ownerAddress` in `config/chipnet.json`.

   ```sh
   npx tsx scripts/wallets.ts add
   npx tsx scripts/wallets.ts addresses
   ```

2. Check the locking script for your parameters against the deployed contract (offline):

   ```sh
   npx tsx scripts/check-bytecode.ts --params config/chipnet.json
   ```

3. Land and convert under a new run name (the three convert steps run as separate processes; payer and converter
   exchange invitation files):

   ```sh
   npx tsx scripts/landing-run.ts land landing7
   npx tsx scripts/landing-run.ts convert landing7
   ```

4. Land a second coin, wait until it is `landing.returnAfter` blocks old, then return it to the owner. The giveBack
   step reads the coin's age from chipnet Electrum first and refuses a coin that is too young.

   ```sh
   npx tsx scripts/landing-run.ts land landing8
   npx tsx scripts/landing-run.ts giveBack landing8
   ```

Each step writes `invitations/<run>-<step>.json` and accepts `--dry-run`; `npx tsx scripts/landing-run.ts --help`
prints the steps. Existing run names (`landing1` to `landing6`) already have saved invitations; landing6 ran on engine
0.1.1-next.18170561234, the earlier runs on 0.1.1-next.18029697917. After a run,
`npx tsx scripts/used-templates.ts --write` and `npx tsx scripts/runs-table.ts --write` add its template and table row.
The offline tests for the template (convert and giveBack paths, each covenant check failing on its
own) are `tests/landing-*.test.ts` and run with `npm test`.

### Open the Landing invitations in the XO debug tool

Follow "Open a saved invitation in the XO debug tool" above with the Landing files:

1. "Import Template" with the contents of [template/landing.json](template/landing.json). The tool reports
   Landing `e0e9b742...e03e`, "2 roles · 3 actions · 12 scripts" (the byte-identical template; landing1 and landing2
   were made with the earlier `03fad653...3515`, also kept in [template/used/](template/used/)). Regenerate the file with
   `npx tsx scripts/export-template.ts` after changing `template/landing.ts`.
2. "Join Invitation" with any `invitations/landing*.json`, then "View invitation". `landing3-convert.json` shows the
   `convert` action with its six commits and the broadcast result; `landing4-giveBack.json` shows `giveBack` with four.
3. "Inspect" on `chipnet` with the convert or giveBack txid above steps through the landing input and decodes its
   P2SH32 redeem script with both branches.

Screenshots of each step for the landing3 and landing4 invitations and transactions, all four with status SUCCESS in
"Inspect", are in [docs/debug-tool/](docs/debug-tool/README.md#landing).

In run `landing5` the converter was a new disposable chipnet account in the debug tool: the script landed and started
the convert, and the tool joined `landing5-convert-start.json` as `Converter`, gave its four variables, set up both
outputs, added and signed its token coin and exported `landing5-convert-taken.json`; `convert-finish` completed the
landed coin input and broadcast [ac0318ba...128a](https://chipnet.imaginary.cash/tx/ac0318bac8697bf3ca46f2f24cb49718c33e58574c530ed71923ccf6d90e128a).
The steps follow "Take an offer from inside the XO debug tool" above (fund the account with
`npx tsx scripts/send.ts taker <bchtest:address> tokens 200 <run>`; no change output, since the covenant needs as many
outputs as inputs). Screenshots: [docs/debug-tool/](docs/debug-tool/README.md#landing5-the-converter-side-signed-inside-the-tool).

### Known limits (Landing)

- The engine does not wait for the relative lock and does not check a coin's age before it broadcasts; the run script
  does that check, and a node may still refuse the transaction for a while after it passes (see the journal).
- A broadcast that fails keeps the coin reserved by its invitation in the engine; the invitation has to be archived
  before the step can run again.
- Each `convert` or `giveBack` spends one landed coin, at input 0, as in the original.
- Chipnet test wallets and a test token only. The code has not been reviewed for use with real funds.

## Proof the port is faithful

The Landing locking script is the bytecode cashc 0.14.0 compiles from `contracts/landing.cash`, with template
variables in place of the constructor arguments. For the parameters of a Sampan landing address that was spent on
mainnet, the XO engine compiles it to the same redeem bytecode, byte for byte.

- Deployed contract: the Sampan `giveBack` transaction
  [5671fd920b3a3c74d322b23250d31a33326452e28528236227f0c89f3a585ba6](https://blockchair.com/bitcoin-cash/transaction/5671fd920b3a3c74d322b23250d31a33326452e28528236227f0c89f3a585ba6).
  Its unlocking script carries the 136-byte redeem bytecode; the output it spends is `OP_HASH160 <hash160(redeem)> OP_EQUAL`.
  Both raw transactions are in [tests/fixtures/landing-deployed.json](tests/fixtures/landing-deployed.json), read once
  from a public Electrum server. The cashc artifact is [tests/fixtures/landing-artifact.json](tests/fixtures/landing-artifact.json).
- Check, offline: `npx tsx scripts/check-bytecode.ts` (add `--json` for the full bytecode). It verifies the fixture
  (hash of the raw transaction, redeem push, spent output), then compares three redeem bytecodes: the deployed one,
  the template's as compiled by the XO engine, and cashc's (constructor arguments plus artifact bytecode). Output:
  `identical: true`. `--params config/chipnet.json` does the same comparison for the chipnet parameters.
- Tests: [tests/landing-bytecode.test.ts](tests/landing-bytecode.test.ts) turn red when one opcode is removed, the
  category byte order changes, the rate changes by one, or one byte of the fixture changes.
- Same redeem bytecode, different P2SH wrapper: XO's `p2sh` locking type is P2SH32 and Sampan addresses are P2SH20,
  so the address is not the same. Unlocking pushes the cashc function selector (`0` convert, `1` giveBack).
- The chipnet runs `landing1` and `landing2` above were made with an earlier hand-written script that enforced the
  same rules in a different opcode order. Record: [docs/decisions/0002-byte-identical-port.md](docs/decisions/0002-byte-identical-port.md).

## AI disclosure

The code, tests, README and build journal in this repository were written by an AI coding agent working for the entrant,
with the entrant reviewing the result. The feedback in FEEDBACK.md was written by the entrant, by hand. No AI was used for it.

## Related

The entrant's main BCH BLAZE 2026 project is Sampan: https://sampan.sasateguh.com and https://github.com/aimanmalib/sampan

## License

MIT, see [LICENSE](LICENSE).
