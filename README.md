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

Status: work in progress. The template, the offline tests and the chipnet runs are added step by step; the
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
bash scripts/gerbang-ujian.sh         # offline checks: typecheck and unit tests, no network
```

Chipnet coins come from a public chipnet faucet such as https://chipnet.bch.ninja/ or https://tbch.googol.cash/.
Settings that may change (Electrum servers, derivation path, explorers, amounts) live in `config/chipnet.json`.

## AI disclosure

The code, tests, README and build journal in this repository were written by an AI coding agent working for the entrant,
with the entrant reviewing the result. The feedback in FEEDBACK.md was written by the entrant, by hand, without AI.

## Related

The entrant's main BCH BLAZE 2026 project is Sampan: https://sampan.sasateguh.com and https://github.com/aimanmalib/sampan

## License

MIT, see [LICENSE](LICENSE).
