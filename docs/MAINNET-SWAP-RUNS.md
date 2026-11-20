# Mainnet Swap Intent runs

Every mainnet transaction of the Swap Intent template, failures included. There is one minimum run, `swapmain1`:
`open`, then `expire` back to the same maker wallet with no key (`cancel` only as the safe way back if `expire` is
refused). There is no `fill` on mainnet: it needs real tokens, and no token is created on mainnet. Values are in
`config/mainnet-swap.json`; `src/swap-network.ts` rejects anything above 5000 sat offered, a fee above 1000 sat, an
expiry outside 1 to 12 blocks, a step other than open, expire and cancel, and a run name other than `swapmain<n>`.
The maker is the mainnet payer account of the Landing run. A row is marked `ok` only after the txid was opened on a
public mainnet explorer (https://blockchair.com/bitcoin-cash/transaction/). Invitations are saved under `invitations/`.

| Date (UTC) | Run | Action | Txid | Invitation | Result |
| --- | --- | --- | --- | --- | --- |
| 2026-11-20 07:19 | swapmain1 | fund | fde04dc1d9ad0179595ad50950448793f3a5d0c0b6490bcece32a972621d855f | - | ok |
| 2026-11-20 07:20 | swapmain1 | open | 06e1273d217e3b2e4c4f009d1f33009f141116cc59e0abb9bb5d16f04d3ee6ba | invitations/swapmain1-open.json | ok |
