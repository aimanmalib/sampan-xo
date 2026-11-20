# Migrate to XO: the Sampan landing address as the XO template "Landing"

Sampan's landing address contract, live on BCH mainnet, is now the XO template Landing: the XO engine compiles the same
136-byte redeem bytecode as the deployed contract, and its actions ran through XO invitations (`land`, `convert` and
`giveBack` on chipnet, `land` then `giveBack` on mainnet).

![Before and after](docs/migrate-before-after.svg)

New project: first commit after the 14 November start ([1ac2691](https://github.com/aimanmalib/sampan-xo/commit/1ac2691e4c699dcc3563fafcd2815bf6eadd6b94), 2026-11-14 17:40 UTC).

Submitted invitation: `invitations/mainnet1-giveBack.json` (the mainnet `giveBack` that returned the landed coin to the
owner, 4000 sat after a 1000 sat fee, no token).

Original project: https://sampan.sasateguh.com (Sampan, live on BCH mainnet) and its contract source
https://github.com/aimanmalib/sampan/blob/main/contracts/landing.cash. Without opening either, the deployed contract can be
checked from a spend of it on mainnet,
[5671fd920b3a3c74d322b23250d31a33326452e28528236227f0c89f3a585ba6](https://blockchair.com/bitcoin-cash/transaction/5671fd920b3a3c74d322b23250d31a33326452e28528236227f0c89f3a585ba6),
whose raw transaction is saved in [tests/fixtures/landing-deployed.json](tests/fixtures/landing-deployed.json).

## Before and after

<!-- before-after:start -->
| | Original (Sampan, CashScript) | XO template (this repo) |
| --- | --- | --- |
| Contract source | [contracts/landing.cash](https://github.com/aimanmalib/sampan/blob/main/contracts/landing.cash) | [template/landing.ts](template/landing.ts), exported as [template/landing.json](template/landing.json) |
| Compiler | cashc 0.14.0 (artifact: [tests/fixtures/landing-artifact.json](tests/fixtures/landing-artifact.json)) | XO template CashASM, compiled by `@xo-cash/engine` 0.1.1-next.18170561234 (`@xo-cash/templates` 0.0.12, `@xo-cash/types` 0.0.8); chipnet `landing6` ran on this version, the earlier runs on 0.1.1-next.18029697917 |
| sha256 of the redeem bytecode (136 bytes, parameters of the deployed contract) | `1901bbb619676836ffa58180113e57612d01e47caad8d8a1fb1aedbff586f01d` (from the deployed transaction) | `1901bbb619676836ffa58180113e57612d01e47caad8d8a1fb1aedbff586f01d` (compiled by the XO engine); `check-bytecode` prints `identical: true` |
| P2SH wrapper | P2SH20 address | P2SH32 address: XO's `p2sh` locking type is P2SH32 and there is no P2SH20 type ([ADR 0002](docs/decisions/0002-byte-identical-port.md)) |
| Who builds the transactions | Sampan's own code; for `convert` the other inputs and outputs are Cauldron pools | The XO engine, through invitations: one role per party, saved as `invitations/*.json` |
| Functions and actions | pay to the address from any wallet; functions `convert` and `giveBack` | start action `land`; follow-up actions `convert` and `giveBack` on the `land` output |
| Network proof | mainnet `giveBack` [5671fd920b3a3c74d322b23250d31a33326452e28528236227f0c89f3a585ba6](https://blockchair.com/bitcoin-cash/transaction/5671fd920b3a3c74d322b23250d31a33326452e28528236227f0c89f3a585ba6) | chipnet `landing3` `convert` [5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1](https://explorer.selene.cash/tx/5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1?network=chipnet), chipnet `landing4` `giveBack` [84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d](https://explorer.selene.cash/tx/84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d?network=chipnet), mainnet `mainnet1` `land` [7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef](https://blockchair.com/bitcoin-cash/transaction/7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef), mainnet `mainnet1` `giveBack` [80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8](https://blockchair.com/bitcoin-cash/transaction/80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8) |
<!-- before-after:end -->

Check it offline: `npx tsx scripts/check-bytecode.ts --json`. It verifies the raw deployed transaction in
[tests/fixtures/landing-deployed.json](tests/fixtures/landing-deployed.json), then compares the deployed redeem bytecode,
the one the XO engine compiles from the template, and the one cashc's artifact gives for the same parameters.

The mainnet run `mainnet1` (land, then giveBack) seen in the XO debug tool, "Inspect" status `SUCCESS` on `mainnet`:
[docs/debug-tool/](docs/debug-tool/README.md#landing-mainnet-mainnet1).

## Runs

Every Landing transaction made with the final (byte-identical) template, with its saved invitation and the exact
template that invitation names. Template `e0e9b742...e03e` is [template/landing.json](template/landing.json);
`a31eb858...c672` is the stock XO wallet template the debug tool used to fund its account.

| Network | Run | Action | Txid | Invitation | Template |
| --- | --- | --- | --- | --- | --- |
| chipnet | landing3 | land | [af2ba18fd27ca75c6fa5422a73bf602900be6019850efa3d57877e01eae0c9db](https://explorer.selene.cash/tx/af2ba18fd27ca75c6fa5422a73bf602900be6019850efa3d57877e01eae0c9db?network=chipnet) | [invitations/landing3-land.json](invitations/landing3-land.json) | [e0e9b742...e03e](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing3 | convert | [5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1](https://explorer.selene.cash/tx/5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1?network=chipnet) | [invitations/landing3-convert.json](invitations/landing3-convert.json) | [e0e9b742...e03e](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing4 | land | [faa1a8abb2dc2c80052d118413ebf6d2190f0b99ea7b1cbd736fca3d9ab781f2](https://explorer.selene.cash/tx/faa1a8abb2dc2c80052d118413ebf6d2190f0b99ea7b1cbd736fca3d9ab781f2?network=chipnet) | [invitations/landing4-land.json](invitations/landing4-land.json) | [e0e9b742...e03e](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing4 | giveBack | [84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d](https://explorer.selene.cash/tx/84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d?network=chipnet) | [invitations/landing4-giveBack.json](invitations/landing4-giveBack.json) | [e0e9b742...e03e](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing5 | fund | [656b56d28238f2fbd32e36d6722f177ffddfb49285ac7da804d3741c39573aeb](https://explorer.selene.cash/tx/656b56d28238f2fbd32e36d6722f177ffddfb49285ac7da804d3741c39573aeb?network=chipnet) | [invitations/landing5-fund-tokens.json](invitations/landing5-fund-tokens.json) | [a31eb858...c672](template/used/a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.json) |
| chipnet | landing5 | land | [5414325621b01e474b7c21f39576d7fe6ea4bf17bc6d84b04dab6be959d68b1b](https://explorer.selene.cash/tx/5414325621b01e474b7c21f39576d7fe6ea4bf17bc6d84b04dab6be959d68b1b?network=chipnet) | [invitations/landing5-land.json](invitations/landing5-land.json) | [e0e9b742...e03e](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing5 | convert | [ac0318bac8697bf3ca46f2f24cb49718c33e58574c530ed71923ccf6d90e128a](https://explorer.selene.cash/tx/ac0318bac8697bf3ca46f2f24cb49718c33e58574c530ed71923ccf6d90e128a?network=chipnet) | [invitations/landing5-convert.json](invitations/landing5-convert.json) | [e0e9b742...e03e](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing6 | land | [9631b0162267422547f5982065daec2835d699b0ea6ade8bd153f06a566b4f01](https://explorer.selene.cash/tx/9631b0162267422547f5982065daec2835d699b0ea6ade8bd153f06a566b4f01?network=chipnet) | [invitations/landing6-land.json](invitations/landing6-land.json) | [e0e9b742...e03e](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| chipnet | landing6 | convert | [29c6bf27b461bc26809331131f8271c07c23ab9f4400322e125182c000c72d7c](https://explorer.selene.cash/tx/29c6bf27b461bc26809331131f8271c07c23ab9f4400322e125182c000c72d7c?network=chipnet) | [invitations/landing6-convert.json](invitations/landing6-convert.json) | [e0e9b742...e03e](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| mainnet | mainnet1 | land | [7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef](https://blockchair.com/bitcoin-cash/transaction/7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef) | [invitations/mainnet1-land.json](invitations/mainnet1-land.json) | [e0e9b742...e03e](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |
| mainnet | mainnet1 | giveBack | [80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8](https://blockchair.com/bitcoin-cash/transaction/80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8) | [invitations/mainnet1-giveBack.json](invitations/mainnet1-giveBack.json) | [e0e9b742...e03e](template/used/e0e9b742197a31a69c65ce6b378ef414f45d7a0f4f9b73fa637e5ae075e4e03e.json) |

- landing3: land, then convert; the owner received 100 test token units at output 0.
- landing4: land, then giveBack after 6 blocks; the owner received 9500 sat (500 sat fee), no token.
- landing5: the converter role was a new account inside the XO debug tool, which signed its token input there.
- landing6: land, then convert on `@xo-cash/engine` 0.1.1-next.18170561234; the earlier runs used 0.1.1-next.18029697917.
- mainnet1: 5000 sat landed, giveBack paid the owner 4000 sat; the only mainnet run (`config/mainnet.json`).

Failed attempts and the runs `landing1` and `landing2` (made with an earlier hand-written script, template
`03fad653...3515`) are listed in [docs/CHIPNET-RUNS.md](docs/CHIPNET-RUNS.md); the mainnet rows, including the two
funding transactions, are in [docs/MAINNET-RUNS.md](docs/MAINNET-RUNS.md).

## In the XO debug tool

At https://blaze.xo.cash/, "Import Template" with [template/landing.json](template/landing.json), then "Join Invitation"
with any file above and "View invitation"; "Inspect" with a txid steps through the landing input and its redeem script.
Screenshots of each step, with "Inspect" status `SUCCESS` for landing3, landing4, landing5 and mainnet1, are in
[docs/debug-tool/landing/](docs/debug-tool/landing/) and described in [docs/debug-tool/README.md](docs/debug-tool/README.md#landing).

## How to check

Offline, from a clean clone (Node 22):

```sh
npm ci
npm test
npx tsx scripts/check-bytecode.ts --json
npx tsx scripts/landing-run.ts --help
```

`npm test` includes the template tests `tests/landing-*.test.ts` (the convert and giveBack paths, and each covenant
check failing on its own). To make new chipnet runs, follow [Reproduce the invitations](README.md#reproduce-the-invitations).
The full write-up, with the function to action map and the differences from the original, is the
[README section](README.md#migrate-to-xo).
