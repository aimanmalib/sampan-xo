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
| 2026-11-14 19:29 | run1 | open | 74fb6c7b5299ec2be0e0b4832ab4c4bd6837f8904505fe0905b932c0c77c3b99 | invitations/run1-open.json | ok |
| 2026-11-14 19:30 | run2 | open | 66b0a6d5cb7b263e960bfa4ed9d9c8ec3952501dc4d7ae3f8a22edcaa2768d85 | invitations/run2-open.json | ok |
| 2026-11-14 19:38 | run1 | fill | 326ee1c18edae7a42317c062237028150145d6f8e8cd5579baa3653e094d6862 | invitations/run1-fill.json | ok |
| 2026-11-14 19:40 | run3 | open | c96a928911e301a808859080fbd842004ab47e79992f63023110a5f3884388ce | invitations/run3-open.json | ok |
| 2026-11-14 19:41 | run3 | fill | f6d0359759159ac189383ea76155d2bc7dad63d153c67f95ca9162df6ab0a7a2 | invitations/run3-fill.json | ok |
| 2026-11-14 19:56 | run2 | cancel | 8472ca5d982bff800fa471f0811b5c9a3af597c96b8dd0e73d555a7ed44de110 | invitations/run2-cancel.json | ok |

run2 is the open -> cancel run: the offer opened at 19:30 was cancelled by the maker at 19:56. The fill steps in between are saved as `<run>-fill-start.json` (maker adds
the offer coin) and `<run>-fill-taken.json` (taker adds the payment and signs).
