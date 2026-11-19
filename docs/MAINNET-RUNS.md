# Mainnet runs

Every mainnet transaction made for this repository, failures included. There is one minimum Landing run, `mainnet1`
(land, then giveBack to the owner account), with the limits checked in `src/landing-network.ts`; nothing else touches
mainnet. A row is marked `ok` only after the txid was opened on a public mainnet explorer
(https://blockchair.com/bitcoin-cash/transaction/). Invitations are saved under `invitations/`.

| Date (UTC) | Run | Action | Txid | Invitation | Result |
| --- | --- | --- | --- | --- | --- |
| 2026-11-19 12:58 | mainnet1 | fund | 9a66aa086bbf1488ef0d04c7cf61b741bc790d75bf80e006bb2c1365ac9cbe72 | - | ok |
