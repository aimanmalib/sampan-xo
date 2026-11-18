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
