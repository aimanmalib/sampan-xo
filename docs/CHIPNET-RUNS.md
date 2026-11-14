# Chipnet runs

Every chipnet transaction made for this repository, failures included. A row is marked `ok` only after the txid was
opened on a public chipnet explorer (https://chipnet.imaginary.cash/tx/). Invitations are saved under `invitations/`.

| Date (UTC) | Run | Action | Txid | Invitation | Result |
| --- | --- | --- | --- | --- | --- |
| 2026-11-14 18:56 | setup | fund | 008eebd7502376715a8ffc87f6b6341cbe284c27237ea0204eaee167603ff95a | - | ok |
| 2026-11-14 18:57 | setup | mint | 6f2d6fc236659c342ed5cae76219a777d7fda0fef04d26a4f85198cafa512883 | - | ok |
| 2026-11-14 19:14 | deposit-maker | fund | 95c68c23f1885c0b02646232610ece168357fc0c8a51a8a20e74517a037ca69d | - | ok |
| 2026-11-14 19:16 | deposit-taker | fund | - (rejected: `mandatory-script-verify-flag-failed (Signature must be zero for failed CHECK(MULTI)SIG operation)`) | - | fail |
| 2026-11-14 19:18 | deposit-taker | fund | dc91ae0b673d5569938578528eaf97b2fcb2f6d6ad3f2446c27bd1a0d6015e93 | - | ok |
