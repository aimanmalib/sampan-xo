# XO debug tool screenshots

Screenshots of https://blaze.xo.cash/ reading the files in this repository and the chipnet transactions. Every
image was taken with a new disposable chipnet account in the tool; account creation and settings screens are not
included. Images are viewport or full page captures at 1366 px width, reduced to 128 colours.

## Swap Intent

Taken on 2026-11-18 with a fresh account: import [template/swap-intent.json](../../template/swap-intent.json), then
"Join Invitation" and "View invitation" (not accepted) for each saved invitation, then "Inspect" on `chipnet`
for each transaction. Steps to repeat are in the main README, "Open a saved invitation in the XO debug tool".

| Image | What it shows | Invitation or txid |
|---|---|---|
| [01-import-template.png](swap-intent/01-import-template.png) | Template JSON pasted into "Import Template" | [template/swap-intent.json](../../template/swap-intent.json) |
| [02-templates.png](swap-intent/02-templates.png) | Swap Intent listed under "Templates" | - |
| [03-view-run1-open.png](swap-intent/03-view-run1-open.png) | "Join Invitation" review: template, action, commits with roles, broadcast transaction hash | [invitations/run1-open.json](../../invitations/run1-open.json) |
| [04-view-run2-open.png](swap-intent/04-view-run2-open.png) | "Join Invitation" review: template, action, commits with roles, broadcast transaction hash | [invitations/run2-open.json](../../invitations/run2-open.json) |
| [05-view-run1-fill.png](swap-intent/05-view-run1-fill.png) | "Join Invitation" review: template, action, commits with roles, broadcast transaction hash | [invitations/run1-fill.json](../../invitations/run1-fill.json) |
| [06-view-run3-open.png](swap-intent/06-view-run3-open.png) | "Join Invitation" review: template, action, commits with roles, broadcast transaction hash | [invitations/run3-open.json](../../invitations/run3-open.json) |
| [07-view-run3-fill.png](swap-intent/07-view-run3-fill.png) | "Join Invitation" review: template, action, commits with roles, broadcast transaction hash | [invitations/run3-fill.json](../../invitations/run3-fill.json) |
| [08-view-run2-cancel.png](swap-intent/08-view-run2-cancel.png) | "Join Invitation" review: template, action, commits with roles, broadcast transaction hash | [invitations/run2-cancel.json](../../invitations/run2-cancel.json) |
| [09-view-browser1-open.png](swap-intent/09-view-browser1-open.png) | "Join Invitation" review: template, action, commits with roles, broadcast transaction hash | [invitations/browser1-open.json](../../invitations/browser1-open.json) |
| [10-view-browser1-fill.png](swap-intent/10-view-browser1-fill.png) | "Join Invitation" review: template, action, commits with roles, broadcast transaction hash | [invitations/browser1-fill.json](../../invitations/browser1-fill.json) |
| [11-inspect-run1-open.png](swap-intent/11-inspect-run1-open.png) | "Inspect" script debugger, status SUCCESS | [74fb6c7b5299ec2be0e0b4832ab4c4bd6837f8904505fe0905b932c0c77c3b99](https://chipnet.imaginary.cash/tx/74fb6c7b5299ec2be0e0b4832ab4c4bd6837f8904505fe0905b932c0c77c3b99) |
| [12-inspect-run2-open.png](swap-intent/12-inspect-run2-open.png) | "Inspect" script debugger, status SUCCESS | [66b0a6d5cb7b263e960bfa4ed9d9c8ec3952501dc4d7ae3f8a22edcaa2768d85](https://chipnet.imaginary.cash/tx/66b0a6d5cb7b263e960bfa4ed9d9c8ec3952501dc4d7ae3f8a22edcaa2768d85) |
| [13-inspect-run1-fill.png](swap-intent/13-inspect-run1-fill.png) | "Inspect" script debugger, status SUCCESS | [326ee1c18edae7a42317c062237028150145d6f8e8cd5579baa3653e094d6862](https://chipnet.imaginary.cash/tx/326ee1c18edae7a42317c062237028150145d6f8e8cd5579baa3653e094d6862) |
| [14-inspect-run3-open.png](swap-intent/14-inspect-run3-open.png) | "Inspect" script debugger, status SUCCESS | [c96a928911e301a808859080fbd842004ab47e79992f63023110a5f3884388ce](https://chipnet.imaginary.cash/tx/c96a928911e301a808859080fbd842004ab47e79992f63023110a5f3884388ce) |
| [15-inspect-run3-fill.png](swap-intent/15-inspect-run3-fill.png) | "Inspect" script debugger, status SUCCESS | [f6d0359759159ac189383ea76155d2bc7dad63d153c67f95ca9162df6ab0a7a2](https://chipnet.imaginary.cash/tx/f6d0359759159ac189383ea76155d2bc7dad63d153c67f95ca9162df6ab0a7a2) |
| [16-inspect-run2-cancel.png](swap-intent/16-inspect-run2-cancel.png) | "Inspect" script debugger, status SUCCESS | [8472ca5d982bff800fa471f0811b5c9a3af597c96b8dd0e73d555a7ed44de110](https://chipnet.imaginary.cash/tx/8472ca5d982bff800fa471f0811b5c9a3af597c96b8dd0e73d555a7ed44de110) |
| [17-inspect-browser1-open.png](swap-intent/17-inspect-browser1-open.png) | "Inspect" script debugger, status SUCCESS | [7f3896aed87a94eb1b9dee9dd938f5c6567ad97766cca8a702af2a8e54151101](https://chipnet.imaginary.cash/tx/7f3896aed87a94eb1b9dee9dd938f5c6567ad97766cca8a702af2a8e54151101) |
| [18-inspect-browser1-fill.png](swap-intent/18-inspect-browser1-fill.png) | "Inspect" script debugger, status SUCCESS | [f92159229f9ec6b3b55feeb43ffc48cd67e297075d259671c8d6d41a71c118a6](https://chipnet.imaginary.cash/tx/f92159229f9ec6b3b55feeb43ffc48cd67e297075d259671c8d6d41a71c118a6) |

### browser1: the taker side signed inside the tool

Taken on 2026-11-18 during run `browser1`: a script opened the offer, and a disposable account in the tool joined
[invitations/browser1-fill-start.json](../../invitations/browser1-fill-start.json) as `taker`, added the outputs and
its own inputs, signed them, and took the final commits back. Steps are in the main README, "Take an offer from
inside the XO debug tool".

| Image | What it shows | Invitation or txid |
|---|---|---|
| [browser1-01-join-view.png](swap-intent/browser1-01-join-view.png) | "Join Invitation" review before accepting, role `Taker` | [invitations/browser1-fill-start.json](../../invitations/browser1-fill-start.json) |
| [browser1-02-joined-as-taker.png](swap-intent/browser1-02-joined-as-taker.png) | Invitation joined as taker; outputs still to add | [invitations/browser1-fill-start.json](../../invitations/browser1-fill-start.json) |
| [browser1-03-outputs-added.png](swap-intent/browser1-03-outputs-added.png) | Payment to maker (1000 tokens) and payout to taker (20000 satoshis) added | [invitations/browser1-fill-start.json](../../invitations/browser1-fill-start.json) |
| [browser1-04-inputs-added.png](swap-intent/browser1-04-inputs-added.png) | Taker inputs from the tool's wallet added | [invitations/browser1-fill-start.json](../../invitations/browser1-fill-start.json) |
| [browser1-05-sign.png](swap-intent/browser1-05-sign.png) | Sign tab: inputs ready to sign | [invitations/browser1-fill-start.json](../../invitations/browser1-fill-start.json) |
| [browser1-06-signed.png](swap-intent/browser1-06-signed.png) | Taker inputs signed in the tool | [invitations/browser1-fill-taken.json](../../invitations/browser1-fill-taken.json) |
| [browser1-07-update-with-final.png](swap-intent/browser1-07-update-with-final.png) | "Update invitation" with the maker's final commits | [invitations/browser1-fill.json](../../invitations/browser1-fill.json) |
| [browser1-08-completed.png](swap-intent/browser1-08-completed.png) | Fill offer shown as COMPLETED | [invitations/browser1-fill.json](../../invitations/browser1-fill.json) |
| [browser1-09-inspect-fill.png](swap-intent/browser1-09-inspect-fill.png) | "Inspect" of the fill transaction, status SUCCESS | [f92159229f9ec6b3b55feeb43ffc48cd67e297075d259671c8d6d41a71c118a6](https://chipnet.imaginary.cash/tx/f92159229f9ec6b3b55feeb43ffc48cd67e297075d259671c8d6d41a71c118a6) |

### run4: open -> expire (template version 2)

Taken on 2026-11-19 with a new disposable chipnet account: import the version 2 [template/swap-intent.json](../../template/swap-intent.json),
"Join Invitation" and "View invitation" (not accepted) for both run4 files, then "Inspect" on `chipnet` for both transactions.

| Image | What it shows | Invitation or txid |
|---|---|---|
| [run4-01-view-open.png](swap-intent/run4-01-view-open.png) | "Join Invitation" review of the open, broadcast transaction hash | [invitations/run4-open.json](../../invitations/run4-open.json) |
| [run4-02-view-expire.png](swap-intent/run4-02-view-expire.png) | "Join Invitation" review of the expire: action `expire`, a commit with role `expirer`, the input extending the open commit, result transaction | [invitations/run4-expire.json](../../invitations/run4-expire.json) |
| [run4-03-inspect-open.png](swap-intent/run4-03-inspect-open.png) | "Inspect" script debugger, status SUCCESS | [d76f3c9f2a190dcddd8c0c28dae338d0fc5f69ecb48d0d1195faa2dc11ecf367](https://chipnet.imaginary.cash/tx/d76f3c9f2a190dcddd8c0c28dae338d0fc5f69ecb48d0d1195faa2dc11ecf367) |
| [run4-04-inspect-expire.png](swap-intent/run4-04-inspect-expire.png) | "Inspect" of the expire: redeem script with the `OP_2 OP_CHECKSEQUENCEVERIFY` branch, status SUCCESS, "Transaction is already known on chipnet" | [4d92f782949444f9751ce3dcbd685696319f474f129893fc617f5792f5b35f48](https://chipnet.imaginary.cash/tx/4d92f782949444f9751ce3dcbd685696319f474f129893fc617f5792f5b35f48) |

### run5: open -> fill (engine 0.1.1-next.18170561234)

Taken on 2026-11-20 with a new disposable chipnet account: import the version 2 [template/swap-intent.json](../../template/swap-intent.json),
"Join Invitation" and "View invitation" (not accepted) for both run5 files, then "Inspect" on `chipnet` for both transactions.

| Image | What it shows | Invitation or txid |
|---|---|---|
| [run5-01-view-open.png](swap-intent/run5-01-view-open.png) | "Join Invitation" review of the open | [invitations/run5-open.json](../../invitations/run5-open.json) |
| [run5-02-view-fill.png](swap-intent/run5-02-view-fill.png) | "Join Invitation" review of the fill: commits with role `taker`, result `fillTransaction` with the broadcast transaction hash | [invitations/run5-fill.json](../../invitations/run5-fill.json) |
| [run5-03-inspect-open.png](swap-intent/run5-03-inspect-open.png) | "Inspect" script debugger, status SUCCESS | [70e14b031f3571ac477fc2634b6517f60f6bcad5374b53daa4634c4141dc1545](https://explorer.selene.cash/tx/70e14b031f3571ac477fc2634b6517f60f6bcad5374b53daa4634c4141dc1545?network=chipnet) |
| [run5-04-inspect-fill.png](swap-intent/run5-04-inspect-fill.png) | "Inspect" of the fill: input 0 spends the offer through the fill branch, status SUCCESS, "Transaction is already known on chipnet" | [565cc19f701d41f6dae8fe48b0a0de0ed7fae492b45c7610e47549d336ca8103](https://explorer.selene.cash/tx/565cc19f701d41f6dae8fe48b0a0de0ed7fae492b45c7610e47549d336ca8103?network=chipnet) |

### run6: open -> cancel (engine 0.1.1-next.18170561234)

Taken on 2026-11-20 in the same way as run5, for both run6 files and both transactions.

| Image | What it shows | Invitation or txid |
|---|---|---|
| [run6-01-view-open.png](swap-intent/run6-01-view-open.png) | "Join Invitation" review of the open | [invitations/run6-open.json](../../invitations/run6-open.json) |
| [run6-02-view-cancel.png](swap-intent/run6-02-view-cancel.png) | "Join Invitation" review of the cancel | [invitations/run6-cancel.json](../../invitations/run6-cancel.json) |
| [run6-03-inspect-open.png](swap-intent/run6-03-inspect-open.png) | "Inspect" script debugger, status SUCCESS | [cc29d1c8151b91de2a7fa899412d61686b2d25afec0f650002fb1797baba04d4](https://explorer.selene.cash/tx/cc29d1c8151b91de2a7fa899412d61686b2d25afec0f650002fb1797baba04d4?network=chipnet) |
| [run6-04-inspect-cancel.png](swap-intent/run6-04-inspect-cancel.png) | "Inspect" of the cancel, status SUCCESS | [2670cc505471e5692f37ba7c1bd05bc38b92d44e7d9ac2e9fc8e8e49083fd355](https://explorer.selene.cash/tx/2670cc505471e5692f37ba7c1bd05bc38b92d44e7d9ac2e9fc8e8e49083fd355?network=chipnet) |

### browser2: the taker side recorded (engine 0.1.1-next.18170561234)

Taken on 2026-11-20 during run `browser2`, the same flow as browser1 with template version 2: a new disposable account
joined [invitations/browser2-fill-start.json](../../invitations/browser2-fill-start.json) as `taker`, added its receiving script,
both outputs, its two coins and change, signed its two inputs and exported the invitation; the maker completed and
broadcast the fill. The session was recorded after the account was created and funded:
[taker-clip.mp4](swap-intent/taker-clip.mp4) (33 s, no audio), [taker-clip.gif](swap-intent/taker-clip.gif) and the
poster [taker-clip.png](swap-intent/taker-clip.png).

| Image | What it shows | Invitation or txid |
|---|---|---|
| [browser2-01-join-view.png](swap-intent/browser2-01-join-view.png) | "Join Invitation" review before accepting, role `Taker` | [invitations/browser2-fill-start.json](../../invitations/browser2-fill-start.json) |
| [browser2-02-receiving-script.png](swap-intent/browser2-02-receiving-script.png) | The account's address pasted as `takerLockingScript` | [invitations/browser2-fill-start.json](../../invitations/browser2-fill-start.json) |
| [browser2-03-select-coins.png](swap-intent/browser2-03-select-coins.png) | "Select coins": the BCH coin and the test token coin | [invitations/browser2-fill-start.json](../../invitations/browser2-fill-start.json) |
| [browser2-04-signed.png](swap-intent/browser2-04-signed.png) | Taker inputs signed and appended to the invitation | [invitations/browser2-fill-taken.json](../../invitations/browser2-fill-taken.json) |
| [browser2-05-completed.png](swap-intent/browser2-05-completed.png) | After "Update invitation" with the maker's final file: COMPLETED | [invitations/browser2-fill.json](../../invitations/browser2-fill.json) |
| [browser2-06-inspect-fill.png](swap-intent/browser2-06-inspect-fill.png) | "Inspect" of the fill transaction, status SUCCESS | [c145510b5a1080e6e48755b7cd7bb08d6551cd6483c49d1b38832cb9b072c195](https://explorer.selene.cash/tx/c145510b5a1080e6e48755b7cd7bb08d6551cd6483c49d1b38832cb9b072c195?network=chipnet) |

### swapmain1: open -> expire on mainnet

Taken on 2026-11-20 with a new disposable `mainnet` account of the tool, after importing the version 2
[template/swap-intent.json](../../template/swap-intent.json): "Join Invitation" and "View invitation" (not accepted) for
both swapmain1 files, then "Inspect" on `mainnet` for both transactions. Rows are in
[docs/MAINNET-SWAP-RUNS.md](../MAINNET-SWAP-RUNS.md).

| Image | What it shows | Invitation or txid |
|---|---|---|
| [swapmain1-01-view-open.png](swap-intent/swapmain1-01-view-open.png) | "Join Invitation" review of the mainnet open, result `openTransaction` | [invitations/swapmain1-open.json](../../invitations/swapmain1-open.json) |
| [swapmain1-02-view-expire.png](swap-intent/swapmain1-02-view-expire.png) | "Join Invitation" review of the expire | [invitations/swapmain1-expire.json](../../invitations/swapmain1-expire.json) |
| [swapmain1-03-inspect-open.png](swap-intent/swapmain1-03-inspect-open.png) | "Inspect" on `mainnet`, status SUCCESS | [06e1273d217e3b2e4c4f009d1f33009f141116cc59e0abb9bb5d16f04d3ee6ba](https://blockchair.com/bitcoin-cash/transaction/06e1273d217e3b2e4c4f009d1f33009f141116cc59e0abb9bb5d16f04d3ee6ba) ([3xpl](https://3xpl.com/bitcoin-cash/transaction/06e1273d217e3b2e4c4f009d1f33009f141116cc59e0abb9bb5d16f04d3ee6ba)) |
| [swapmain1-04-inspect-expire.png](swap-intent/swapmain1-04-inspect-expire.png) | "Inspect" of the expire on `mainnet`: the offer input spent with no signature, status SUCCESS | [1a0ce51bcafda1328a2045aaadbdadb4d74486bd86672ad46e4161a767a2d511](https://blockchair.com/bitcoin-cash/transaction/1a0ce51bcafda1328a2045aaadbdadb4d74486bd86672ad46e4161a767a2d511) ([3xpl](https://3xpl.com/bitcoin-cash/transaction/1a0ce51bcafda1328a2045aaadbdadb4d74486bd86672ad46e4161a767a2d511)) |

## Landing

Taken on 2026-11-18 with a fresh account: import [template/landing.json](../../template/landing.json) (the
byte-identical template), then "Join Invitation" and "View invitation" (not accepted) for each invitation of the runs
`landing3` (land, convert) and `landing4` (land, giveBack), then "Inspect" on `chipnet` for each transaction.

| Image | What it shows | Invitation or txid |
|---|---|---|
| [01-import-template.png](landing/01-import-template.png) | Template JSON pasted into "Import Template" | [template/landing.json](../../template/landing.json) |
| [02-templates.png](landing/02-templates.png) | Landing listed under "Templates" | - |
| [03-view-landing3-land.png](landing/03-view-landing3-land.png) | "Join Invitation" review: template Landing, action, commits with roles | [invitations/landing3-land.json](../../invitations/landing3-land.json) |
| [04-view-landing3-convert-start.png](landing/04-view-landing3-convert-start.png) | "Join Invitation" review: template Landing, action, commits with roles | [invitations/landing3-convert-start.json](../../invitations/landing3-convert-start.json) |
| [05-view-landing3-convert-taken.png](landing/05-view-landing3-convert-taken.png) | "Join Invitation" review: template Landing, action, commits with roles | [invitations/landing3-convert-taken.json](../../invitations/landing3-convert-taken.json) |
| [06-view-landing3-convert.png](landing/06-view-landing3-convert.png) | "Join Invitation" review: template Landing, action, commits with roles | [invitations/landing3-convert.json](../../invitations/landing3-convert.json) |
| [07-view-landing4-land.png](landing/07-view-landing4-land.png) | "Join Invitation" review: template Landing, action, commits with roles | [invitations/landing4-land.json](../../invitations/landing4-land.json) |
| [08-view-landing4-giveBack.png](landing/08-view-landing4-giveBack.png) | "Join Invitation" review: template Landing, action, commits with roles | [invitations/landing4-giveBack.json](../../invitations/landing4-giveBack.json) |
| [09-inspect-landing3-land.png](landing/09-inspect-landing3-land.png) | "Inspect" script debugger, status SUCCESS | [af2ba18fd27ca75c6fa5422a73bf602900be6019850efa3d57877e01eae0c9db](https://chipnet.imaginary.cash/tx/af2ba18fd27ca75c6fa5422a73bf602900be6019850efa3d57877e01eae0c9db) |
| [10-inspect-landing3-convert.png](landing/10-inspect-landing3-convert.png) | "Inspect" script debugger, status SUCCESS | [5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1](https://chipnet.imaginary.cash/tx/5c15f12c1e4fe868a5c0761c4592b019c07d71106e3faba99a00c8e240dfabe1) |
| [11-inspect-landing4-land.png](landing/11-inspect-landing4-land.png) | "Inspect" script debugger, status SUCCESS | [faa1a8abb2dc2c80052d118413ebf6d2190f0b99ea7b1cbd736fca3d9ab781f2](https://chipnet.imaginary.cash/tx/faa1a8abb2dc2c80052d118413ebf6d2190f0b99ea7b1cbd736fca3d9ab781f2) |
| [12-inspect-landing4-giveBack.png](landing/12-inspect-landing4-giveBack.png) | "Inspect" script debugger, status SUCCESS | [84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d](https://chipnet.imaginary.cash/tx/84db84e9a1bc8d6f959432eddb91d52b368ffd1872722cf87723e717c273164d) |

### landing5: the converter side signed inside the tool

Taken on 2026-11-19 during run `landing5`: a script landed 10000 sat and put the landed coin into a convert, and a
disposable chipnet account in the tool (funded with one coin of 200 test token units by the project's taker) joined
[invitations/landing5-convert-start.json](../../invitations/landing5-convert-start.json) as `Converter`, gave its
variables, set up both outputs, added its token coin, signed it and exported the invitation. The script then completed
the landed coin input and broadcast. Rows are in [docs/CHIPNET-RUNS.md](../CHIPNET-RUNS.md).

| Image | What it shows | Invitation or txid |
|---|---|---|
| [browser-01-join-view.png](landing/browser-01-join-view.png) | "Join Invitation" review of the convert, role `Converter` chosen, before accepting | [invitations/landing5-convert-start.json](../../invitations/landing5-convert-start.json) |
| [browser-02-joined.png](landing/browser-02-joined.png) | Invitation joined as converter; variables and outputs still to add | [invitations/landing5-convert-start.json](../../invitations/landing5-convert-start.json) |
| [browser-03-variables.png](landing/browser-03-variables.png) | The four converter variables typed in: receiving address, coin satoshis 16800, coin tokens 200, fee 1000 | [invitations/landing5-convert-start.json](../../invitations/landing5-convert-start.json) |
| [browser-04-outputs.png](landing/browser-04-outputs.png) | Both outputs set up: 100 tokens to the owner at output 0, the payout to the converter at output 1 | [invitations/landing5-convert-start.json](../../invitations/landing5-convert-start.json) |
| [browser-05-input-selected.png](landing/browser-05-input-selected.png) | "Select coins": the account's one coin, 16800 sat and 200 test token units, selected | [invitations/landing5-convert-start.json](../../invitations/landing5-convert-start.json) |
| [browser-06-sign-preview.png](landing/browser-06-sign-preview.png) | "Sign": unlocking bytecode generated for input 1 (the converter's coin), before appending | [invitations/landing5-convert-start.json](../../invitations/landing5-convert-start.json) |
| [browser-07-signed.png](landing/browser-07-signed.png) | Converter input signed; input 0 waits on the payer | [invitations/landing5-convert-taken.json](../../invitations/landing5-convert-taken.json) |
| [browser-08-completed.png](landing/browser-08-completed.png) | "Update invitation" with the payer's final commit: convert shown as COMPLETED | [invitations/landing5-convert.json](../../invitations/landing5-convert.json) |
| [browser-09-inspect-convert.png](landing/browser-09-inspect-convert.png) | "Inspect" of the convert transaction on `chipnet`, status SUCCESS | [ac0318bac8697bf3ca46f2f24cb49718c33e58574c530ed71923ccf6d90e128a](https://chipnet.imaginary.cash/tx/ac0318bac8697bf3ca46f2f24cb49718c33e58574c530ed71923ccf6d90e128a) |

### Landing mainnet (mainnet1)

Taken on 2026-11-19 at 23:26 UTC with a fresh `mainnet` account of the tool (the tool offers `mainnet`, `chipnet` and
`testnet4`), after importing [template/landing.json](../../template/landing.json): "Join Invitation" and "View
invitation" (not accepted) for both invitations of the mainnet run, then "Inspect" with the `mainnet` network for both
transactions. Rows are in [docs/MAINNET-RUNS.md](../MAINNET-RUNS.md).

| Image | What it shows | Invitation or txid |
|---|---|---|
| [mainnet-01-view-mainnet1-land.png](landing/mainnet-01-view-mainnet1-land.png) | "Join Invitation" review: template Landing, action `land`, commits with roles | [invitations/mainnet1-land.json](../../invitations/mainnet1-land.json) |
| [mainnet-02-view-mainnet1-giveBack.png](landing/mainnet-02-view-mainnet1-giveBack.png) | "Join Invitation" review: template Landing, action `giveBack`, commit with role `payer`, the input extending the land commit, result transaction hash | [invitations/mainnet1-giveBack.json](../../invitations/mainnet1-giveBack.json) |
| [mainnet-03-inspect-mainnet1-land.png](landing/mainnet-03-inspect-mainnet1-land.png) | "Inspect" on `mainnet` of the land transaction, status SUCCESS | [7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef](https://blockchair.com/bitcoin-cash/transaction/7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef) ([3xpl](https://3xpl.com/bitcoin-cash/transaction/7307ceebe247f57b177f8dbcb69cad97a3a05055712d74934b65f0713551b8ef)) |
| [mainnet-04-inspect-mainnet1-giveBack.png](landing/mainnet-04-inspect-mainnet1-giveBack.png) | "Inspect" on `mainnet` of the giveBack: input 0 (5000 sat) unlocked with `OP_1` and the 136-byte redeem script, P2SH32 locking script, status SUCCESS | [80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8](https://blockchair.com/bitcoin-cash/transaction/80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8) ([3xpl](https://3xpl.com/bitcoin-cash/transaction/80387030d47911bb9fa144892cf853a61cb3e4e8bc5f3ce948e78e99e67ca8d8)) |
