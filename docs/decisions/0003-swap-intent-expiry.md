# 0003 Swap Intent: keyless expire after a relative lock

Date: 2026-11-19. Status: accepted.

## Context

Before this change an open offer stayed locked until a taker filled it or the maker cancelled it with `makerKey`. If the
maker lost the engine database that holds `makerKey`, the offered satoshis could only leave through a fill. A maker who
no longer wants the trade has no way back without that key.

## Decision

1. The offer locking script has a third branch, `expire`. Selectors on top of the unlocking stack: `OP_1` is fill,
   `OP_1 OP_0` is expire, `<sig> <pk> OP_0 OP_0` is cancel. The fill and cancel checks are unchanged; the cancel
   unlocking script gains one `OP_0` to reach its branch.
2. The expire branch checks, in this order:
   - `<expireAfter> OP_CHECKSEQUENCEVERIFY OP_DROP`: the input sequence number carries a relative lock (BIP68, blocks)
     of at least `expireAfter`. The transaction must be version 2.
   - exactly one input and one output;
   - output 0 pays `makerLockingScript`, carries no token, and holds at least `offeredSatoshis - expireFeeSatoshis`.
3. No signature. The branch can only send the coin back to the maker, so anyone may broadcast it, and the expirer needs
   no key: `src/swap-expire.ts` finds the coin through Electrum by the offer address from the open invitation. The template names this party with a separate role, `expirer`.
4. Relative, not absolute: the lock counts from the block that confirms the offer, so the maker does not have to
   predict a block height when opening. The same pattern as the Landing template `giveBack`.
5. `expireAfter` and `expireFeeSatoshis` are offer variables set by the maker at `open` (values in
   `config/chipnet.json`, `swap.expireAfterBlocks` and `swap.expireFeeSatoshis`) and are part of the offer script.
   The config check limits `expireAfterBlocks` to 1 to 65535 (the 16 bit BIP68 field) and the fee to 0 to 1000.

## Consequences

- The template identifier changed and the template `version` field is now `2`. The invitations of run1 to run3 and
  browser1 name the earlier template; its exact JSON stays in `template/used/<id>.json`, so they still open and verify.
- `readOfferVariables` now needs the six variables, so the fill and cancel scripts in this repository work only with
  offers opened with version 2.
- An offer can be returned to the maker by anyone once it is old enough, while a taker may still be trying to fill it.
  Whichever valid transaction is mined first wins, as with fill against cancel before.
- Measured on chipnet in run4 (journal 2026-11-19 19:20): the XO engine completes an input only for a coin its own
  account tracks, and tracking the offer means recompiling its script, which needs `makerKey.public_key`. The open
  invitation does not publish it, so an account other than the maker's cannot build the expire through the engine.
  `scripts/run.ts expire` therefore runs with the maker account; the transaction itself still carries no signature.
  Publishing the maker key hash in the open invitation would let any engine track the offer; not done, because it
  changes the template again and the keyless spend is already shown by the transaction.

## Way back

Revert the template change; offers opened with version 2 can still be spent with the version 2 JSON in `template/used/`.
