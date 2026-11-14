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
