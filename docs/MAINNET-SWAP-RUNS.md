# Mainnet Swap Intent runs

Every mainnet transaction of the Swap Intent template, failures included. There is one minimum run, `swapmain1`:
`open`, then `expire` back to the same maker wallet with no key (`cancel` only as the safe way back if `expire` is
refused). There is no `fill` on mainnet: it needs real tokens, and no token is created on mainnet. Values are in
`config/mainnet-swap.json`; `src/swap-network.ts` rejects anything above 5000 sat offered, a fee above 1000 sat, an
expiry outside 1 to 12 blocks, a step other than open, expire and cancel, and a run name other than `swapmain<n>`.
The maker is the mainnet payer account of the Landing run. A row is marked `ok` only after the txid was opened on a
public mainnet explorer. Each row links the txid on two public explorers, Blockchair
(https://blockchair.com/bitcoin-cash/transaction/) and 3xpl (https://3xpl.com/bitcoin-cash/transaction/). `Engine` is
the `@xo-cash/engine` version pinned in `package.json` in the commit that recorded the row; the `fund` row is a plain
wallet transfer that did not use the engine. Invitations are saved under `invitations/`.

| Date (UTC) | Run | Action | Txid | Invitation | Engine | Explorers | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-20 07:19 | swapmain1 | fund | fde04dc1d9ad0179595ad50950448793f3a5d0c0b6490bcece32a972621d855f | - | `0.1.1-next.18170561234` | [Blockchair](https://blockchair.com/bitcoin-cash/transaction/fde04dc1d9ad0179595ad50950448793f3a5d0c0b6490bcece32a972621d855f) · [3xpl](https://3xpl.com/bitcoin-cash/transaction/fde04dc1d9ad0179595ad50950448793f3a5d0c0b6490bcece32a972621d855f) | ok |
| 2026-11-20 07:20 | swapmain1 | open | 06e1273d217e3b2e4c4f009d1f33009f141116cc59e0abb9bb5d16f04d3ee6ba | invitations/swapmain1-open.json | `0.1.1-next.18170561234` | [Blockchair](https://blockchair.com/bitcoin-cash/transaction/06e1273d217e3b2e4c4f009d1f33009f141116cc59e0abb9bb5d16f04d3ee6ba) · [3xpl](https://3xpl.com/bitcoin-cash/transaction/06e1273d217e3b2e4c4f009d1f33009f141116cc59e0abb9bb5d16f04d3ee6ba) | ok |
| 2026-11-20 08:27 | swapmain1 | expire | 1a0ce51bcafda1328a2045aaadbdadb4d74486bd86672ad46e4161a767a2d511 | invitations/swapmain1-expire.json | `0.1.1-next.18170561234` | [Blockchair](https://blockchair.com/bitcoin-cash/transaction/1a0ce51bcafda1328a2045aaadbdadb4d74486bd86672ad46e4161a767a2d511) · [3xpl](https://3xpl.com/bitcoin-cash/transaction/1a0ce51bcafda1328a2045aaadbdadb4d74486bd86672ad46e4161a767a2d511) | ok |
