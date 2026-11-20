# Mainnet runs

Every mainnet transaction made for this repository, failures included. There is one minimum Landing run, `mainnet1`
(land, then giveBack to the owner account), with the limits checked in `src/landing-network.ts`. The one minimum
mainnet Swap Intent run is listed apart, in `docs/MAINNET-SWAP-RUNS.md`. A row is marked `ok` only after the txid was opened on a public mainnet explorer.
Each row links the txid on two public explorers, Blockchair (https://blockchair.com/bitcoin-cash/transaction/) and
3xpl (https://3xpl.com/bitcoin-cash/transaction/). `Engine` is the `@xo-cash/engine` version pinned in `package.json`
in the commit that recorded the row; the `fund` rows are plain wallet transfers that did not use the engine. Invitations
are saved under `invitations/`.

| Date (UTC) | Run | Action | Txid | Invitation | Engine | Explorers | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-19 12:58 | mainnet1 | fund | 9a66aa086bbf1488ef0d04c7cf61b741bc790d75bf80e006bb2c1365ac9cbe72 | - | `0.1.1-next.18029697917` | [Blockchair](https://blockchair.com/bitcoin-cash/transaction/9a66aa086bbf1488ef0d04c7cf61b741bc790d75bf80e006bb2c1365ac9cbe72) · [3xpl](https://3xpl.com/bitcoin-cash/transaction/9a66aa086bbf1488ef0d04c7cf61b741bc790d75bf80e006bb2c1365ac9cbe72) | ok |
| 2026-11-19 13:24 | mainnet1 | fund | c8ab57d9279b2920c46b278bec131b127ecc5a02511b5f045083288c8e247599 | - | `0.1.1-next.18029697917` | [Blockchair](https://blockchair.com/bitcoin-cash/transaction/c8ab57d9279b2920c46b278bec131b127ecc5a02511b5f045083288c8e247599) · [3xpl](https://3xpl.com/bitcoin-cash/transaction/c8ab57d9279b2920c46b278bec131b127ecc5a02511b5f045083288c8e247599) | ok |
| 2026-11-19 14:06 | mainnet1 | land | 7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef | invitations/mainnet1-land.json | `0.1.1-next.18029697917` | [Blockchair](https://blockchair.com/bitcoin-cash/transaction/7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef) · [3xpl](https://3xpl.com/bitcoin-cash/transaction/7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef) | ok |
| 2026-11-19 23:14 | mainnet1 | giveBack | 80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8 | invitations/mainnet1-giveBack.json | `0.1.1-next.18029697917` | [Blockchair](https://blockchair.com/bitcoin-cash/transaction/80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8) · [3xpl](https://3xpl.com/bitcoin-cash/transaction/80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8) | ok |

mainnet1 is the land -> giveBack run with the byte-identical template: 5000 sat landed, and the giveBack paid the owner
account 4000 sat (5000 landed, 1000 fee) as BCH with no token, in a transaction with one input and one output.
