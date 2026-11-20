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
| 2026-11-16 09:17 | landing1 | land | 7883280023308e712beb1a51f5f9ba050dd740b7a8099fcf14e18a98437ca894 | invitations/landing1-land.json | ok |
| 2026-11-16 09:18 | landing1 | convert | 7a9b82e8159b01bcf53e5c556f90d568a32961a4aef7551d119454bc7461d056 | invitations/landing1-convert.json | ok |
| 2026-11-16 09:19 | landing2 | land | a0e6da274c8c5881bfc5c0c103c4d64f1612d1d69b79aeac876fea165ffdce47 | invitations/landing2-land.json | ok |
| 2026-11-16 09:27 | landing2 | giveBack | - (rejected: `non-BIP68-final (code 64)`; built txid de83797632b64d4725fcd47ec9325fc49dc36cddf30fdd7d301137d01d1819dd, land coin 8 blocks old) | - | fail |
| 2026-11-16 10:19 | landing2 | giveBack | de83797632b64d4725fcd47ec9325fc49dc36cddf30fdd7d301137d01d1819dd | invitations/landing2-giveBack.json | ok |
| 2026-11-18 16:19 | browser1 | fund | 95bb24063f8d4b67562e0a8d417fe4b0d1144b8821e85c8ad0559cd161a442b2 | invitations/browser1-fund-tokens.json | ok |
| 2026-11-18 16:19 | browser1 | fund | 9288186e171e9fd123960c30252361bbe9025c7721c3597d197ff6b11c18e41d | invitations/browser1-fund-sats.json | ok |
| 2026-11-18 16:21 | browser1 | open | 7f3896aed87a94eb1b9dee9dd938f5c6567ad97766cca8a702af2a8e54151101 | invitations/browser1-open.json | ok |
| 2026-11-18 17:50 | browser1 | fill | - (not built: `TemplateUnlockingScriptNotFoundError: Unlocking script not found for locking script "sendingLockingscript"`) | - | fail |
| 2026-11-18 17:51 | browser1 | fill | f92159229f9ec6b3b55feeb43ffc48cd67e297075d259671c8d6d41a71c118a6 | invitations/browser1-fill.json | ok |
| 2026-11-18 19:00 | landing4 | land | faa1a8abb2dc2c80052d118413ebf6d2190f0b99ea7b1cbd736fca3d9ab781f2 | invitations/landing4-land.json | ok |
| 2026-11-18 19:01 | landing3 | land | af2ba18fd27ca75c6fa5422a73bf602900be6019850efa3d57877e01eae0c9db | invitations/landing3-land.json | ok |
| 2026-11-18 19:02 | landing3 | convert | - (not built: `the converter engine wallet has no coin with 100 test token units`) | - | fail |
| 2026-11-18 19:05 | landing3 | convert | 5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1 | invitations/landing3-convert.json | ok |
| 2026-11-18 19:07 | landing4 | giveBack | - (rejected: `non-BIP68-final (code 64)`; built txid 84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d, land coin 6 blocks old) | - | fail |
| 2026-11-18 20:12 | landing4 | giveBack | 84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d | invitations/landing4-giveBack.json | ok |
| 2026-11-19 15:00 | landing5 | fund | 656b56d28238f2fbd32e36d6722f177ffddfb49285ac7da804d3741c39573aeb | invitations/landing5-fund-tokens.json | ok |
| 2026-11-19 15:01 | landing5 | land | 5414325621b01e474b7c21f39576d7fe6ea4bf17bc6d84b04dab6be959d68b1b | invitations/landing5-land.json | ok |
| 2026-11-19 15:20 | landing5 | convert | - (not built: `InvitationHistoryConflictError: Invitation "0345103c0705474e335ce4d91c8ebb21" history conflict at stored commit "1885a381830f4932807a513c7353c30b"`) | - | fail |
| 2026-11-19 15:25 | landing5 | convert | ac0318bac8697bf3ca46f2f24cb49718c33e58574c530ed71923ccf6d90e128a | invitations/landing5-convert.json | ok |
| 2026-11-19 19:05 | run4 | open | d76f3c9f2a190dcddd8c0c28dae338d0fc5f69ecb48d0d1195faa2dc11ecf367 | invitations/run4-open.json | ok |
| 2026-11-19 19:06 | run4 | expire | - (not built, taker account: `InputUnspentOutputUnavailableError: Unspent output d76f3c9f2a190dcddd8c0c28dae338d0fc5f69ecb48d0d1195faa2dc11ecf367:0 of merged input 0 in invitation "76b8fce858b955482e95cc9128992ee3" not tracked by this account`) | - | fail |
| 2026-11-19 19:10 | run4 | expire | - (expire-early, rejected: `non-BIP68-final (code 64)`; offer 1 to 2 blocks old) | - | fail |
| 2026-11-19 19:13 | run4 | expire | - (rejected: `non-BIP68-final (code 64)`; built txid 4d92f782949444f9751ce3dcbd685696319f474f129893fc617f5792f5b35f48, offer 12 or more blocks old by Electrum height; refused again at 19:21, 19:22 and 19:25) | - | fail |
| 2026-11-19 19:26 | run4 | expire | 4d92f782949444f9751ce3dcbd685696319f474f129893fc617f5792f5b35f48 | invitations/run4-expire.json | ok |
| 2026-11-19 23:38 | landing6 | land | 9631b0162267422547f5982065daec2835d699b0ea6ade8bd153f06a566b4f01 | invitations/landing6-land.json | ok |
| 2026-11-19 23:38 | landing6 | convert | 29c6bf27b461bc26809331131f8271c07c23ab9f4400322e125182c000c72d7c | invitations/landing6-convert.json | ok |
| 2026-11-20 00:57 | run6 | open | cc29d1c8151b91de2a7fa899412d61686b2d25afec0f650002fb1797baba04d4 | invitations/run6-open.json | ok |
| 2026-11-20 00:58 | run5 | open | 70e14b031f3571ac477fc2634b6517f60f6bcad5374b53daa4634c4141dc1545 | invitations/run5-open.json | ok |
| 2026-11-20 01:00 | run5 | fill | 565cc19f701d41f6dae8fe48b0a0de0ed7fae492b45c7610e47549d336ca8103 | invitations/run5-fill.json | ok |
| 2026-11-20 01:14 | run6 | cancel | 2670cc505471e5692f37ba7c1bd05bc38b92d44e7d9ac2e9fc8e8e49083fd355 | invitations/run6-cancel.json | ok |

run2 is the open -> cancel run: the offer opened at 19:30 was cancelled by the maker at 19:56. The fill steps in between are saved as `<run>-fill-start.json` (maker adds
the offer coin) and `<run>-fill-taken.json` (taker adds the payment and signs).

landing1 is the land -> convert run: the owner received 100 test token units at output 0 of the convert transaction.
landing2 is the land -> giveBack run: the owner received 9500 sat (10000 landed, 500 fee) as BCH with no token. The nodes refused
the same transaction as `non-BIP68-final` from 09:27 until 10:18 although the land already had 8 confirmations by Electrum
height at 09:25; see the journal.
landing1 and landing2 used the earlier hand-written script (template `03fad653...`). landing3 and landing4 repeat the
same actions with the byte-identical template (`e0e9b742...`, the cashc bytecode of the deployed contract; see
docs/decisions/0002-byte-identical-port.md).
landing3 is the land -> convert run with the byte-identical template: the owner received 100 test token units at output 0.
The failed row is the first converter step: an abandoned, never broadcast draft in the taker engine still reserved both
token coins; see the journal.
landing4 is the land -> giveBack run with the byte-identical template: the owner received 9500 sat (10000 landed, 500 fee)
as BCH with no token. The failed row is the first attempt at 6 confirmations, refused as `non-BIP68-final`; the same
transaction was accepted at 20:12; see the journal.

browser1 is the open -> fill run with the taker part done by hand in the XO debug tool (https://blaze.xo.cash/), in a new
disposable chipnet account created there. The project's maker sent that account 1000 test tokens and 30000 sat (the two
`fund` rows, P2PKH wallet template `sendFungibleTokens` and `sendSatoshis` through the XO engine), opened the offer and
started the fill (`browser1-fill-start.json`). In the debug tool the taker joined that invitation, added its receiving
script, both outputs, its two coins and change, signed its two inputs and exported the invitation
(`browser1-fill-taken.json`: the tool's "Copy invitation" JSON, pretty printed). The maker then completed the offer input and broadcast
(`browser1-fill.json`). The failed row is the first finish attempt, before the fix described in the journal.

landing5 is the land -> convert run with the converter part done by hand in the XO debug tool (https://blaze.xo.cash/),
in a new disposable chipnet account created there, with the byte-identical template. The project's taker sent that
account one coin of 200 test token units and 16800 sat (the `fund` row, `sendFungibleTokens` through the XO engine).
The payer (maker) landed 10000 sat and put the landed coin into a convert (`landing5-convert-start.json`). In the debug
tool the converter joined that invitation, gave its four variables (receiving script, coin satoshis, coin tokens, fee),
set up both outputs, added its token coin (input 1), signed it and exported the invitation (`landing5-convert-taken.json`:
the tool's "Copy invitation" JSON, pretty printed). The payer then completed the landed coin input and broadcast
(`landing5-convert.json`). The owner received 100 test token units at output 0; the converter received 24800 sat and the
other 100 units at output 1. The failed row is a first convert invitation that a dry run of `convert-finish` had already
stored in the payer engine; see the journal.
The landing5 rows were opened on https://explorer.selene.cash/ (chipnet) at 23:00 on 2026-11-19; the links in the README
point to chipnet.imaginary.cash.

run4 is the open -> expire run with template version 2. The maker opened the offer at 19:05 with `expireAfter` 2.
The expire step was first run with the taker account, which the engine refused because only the maker's account
tracks the offer coin (see the journal); it then ran with the maker account. The expire transaction has one input
with sequence 2 and no signature, and one output of 19500 sat (20000 offered, 500 fee) to the maker's locking script,
no token. The chipnet nodes refused it as `non-BIP68-final` until 19:26, when the offer had 20 confirmations by
Electrum height; the accepted transaction is the same txid that was refused at 19:13.
Both run4 rows were opened on https://explorer.selene.cash/ (chipnet) at 20:51: https://chipnet.imaginary.cash/
did not answer from 19:20 to 20:50 (see the journal). The links in the README still point to chipnet.imaginary.cash.

landing6 is the land -> convert run on `@xo-cash/engine` 0.1.1-next.18170561234 (the `next` tag on 2026-11-19), with
the same template `e0e9b742...e03e` as landing3 to landing5. The payer (maker) landed 10000 sat at the landing address
`bchtest:pvp48e6zfhj9glvrlwp8tzap2rmpkl3yel2g29rt9h9y99ja86hfqc2u6lnlx` (output 0 locking bytecode = `templateLocking`
of `check-bytecode --params config/chipnet.json`). In the convert the converter (taker) added its token coin as input 1;
output 0 pays the owner `bchtest:zz4rr7mn324zdkeav5v3gpqvlf3jx9u68q0vhr6hgz` 100 test token units with 1000 sat, output 1
returns 997500 units with 8800 sat to the converter. Both rows were opened on https://explorer.selene.cash/ (chipnet) at
23:40 on 2026-11-19 (land 3 confirmations, convert unconfirmed); https://chipnet.imaginary.cash/ did not answer.

run5 and run6 use `@xo-cash/engine` 0.1.1-next.18170561234 (the `next` tag, unchanged on 2026-11-20) with template
version 2 (`8f0fb78d...712e`). run5 is the open -> fill run: in the fill, output 0 pays the maker 1000 sat with the
test tokens and output 1 pays the taker the 20000 offered sat. run6 is an open -> cancel run that came from an operator
mistake: `run.ts open run5` was run first and then `run.ts fill run5`, which opens a new offer itself. The first offer
(`cc29d1c8...04d4`) was left open and its file `run5-open.json` was overwritten by the second open. Its invitation was
still in the maker's engine and was exported again as `run6-open.json`; the maker then cancelled it, and output 0 of the
cancel returns 19500 sat (20000 offered, 500 fee) to the maker. All four rows were opened on
https://explorer.selene.cash/ (chipnet) between 01:04 and 01:24 on 2026-11-20; https://chipnet.imaginary.cash/ did not answer.
