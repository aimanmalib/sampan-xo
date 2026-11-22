# run8: fill paying one token unit short, refused by the chipnet node

One deliberate negative test of the Swap Intent covenant on chipnet (run `run8`, 2026-11-22, `@xo-cash/engine`
0.1.1-next.18230317763 pinned). Its row is the run8 `fill` row with result `fail` in [docs/CHIPNET-RUNS.md](../CHIPNET-RUNS.md). The
template and its covenant are the same as for every other run; nothing was changed for this test.

## What was sent

- Input 0: the open offer `6cebb159890ee46c7852378da0f211798bac67238bf3d497a862f55e721a7049:0` (20000 sat, asking for
  1000 units of `008eebd7...f95a`), unlocked with the fill selector (`OP_1`) and the redeem bytecode.
- Input 1: a plain P2PKH coin of the taker account holding 1000 test token units and 8800 sat
  (`7c8c5e71227621687e97219c88397951709f4bc4973a4d6209acfab295b1e366:0`, the `fund` row of run8). The covenant does
  not check who supplies the tokens.
- Output 0: the maker's locking script, 1000 sat with **999** units of `008eebd7...f95a`. The offer wants 1000.
- Output 1: the taker account's own script, 27310 sat (the offered 20000 sat plus the coin's 8800 sat, less 1000 sat for
  output 0 and a 490 sat fee) and the remaining unit.

Transaction `9b41d1ef6fe2e1d163b18923d0df2b5bb5375a599b65c99387cbf3dd16f54803`:

```
020000000249701a725ef562a897d4f38b2367ac8b7911f2a08d3752786ce40e8959b1eb6c000000009e514c9b63c0cd1976a914ed1888a7a879a2c7126b05160dc0ba3dbe8ce47788ac88c0d1bc20008eebd7502376715a8ffc87f6b6341cbe284c27237ea0204eaee167603ff95a88c0d302e803a2676352b275c3519dc4519d00cd1976a914ed1888a7a879a2c7126b05160dc0ba3dbe8ce47788ac8800d1008800cc02204e02f40194a26776a914a92edc15bc44cb308dde49fd11983d328a1dec6388ac68680000000066e3b195b2faac09624d3a97c44b9f70517939889c21977e68217622715e8c7c000000006441062baaa46923b1be8aa1ed3d2238a37fe2184f6988d5eb48e26afc78d26c240a40036b98c2e8a29509e32fca500d8d4333844ea12f6055f624222c9c52dc3ca7412102fb37d073fc9391f649e5c39359825b5d2a18e9d6b7f6fa33bdc145319a34398f0000000002e8030000000000003eef5af93f6067e1ae4e20a07e23274c28be1c34b6f687fc8f5a71762350d7eb8e0010fde70376a914ed1888a7a879a2c7126b05160dc0ba3dbe8ce47788acae6a0000000000003cef5af93f6067e1ae4e20a07e23274c28be1c34b6f687fc8f5a71762350d7eb8e00100176a914c31cdc0c49f803b574e0d04c891fb741531ad2fd88ac00000000
```

## What the node answered

Sent once, at 03:42 UTC, to the first chipnet Electrum server of `config/chipnet.json` (chipnet.imaginary.cash):

```
the transaction was rejected by network rules.

mandatory-script-verify-flag-failed (Script evaluated without error but finished with a false/empty top stack element) (code 16)
```

Right after, `blockchain.transaction.get 9b41d1ef...4803` answered
`No such mempool or blockchain transaction. Use gettransaction for wallet transactions.` (code -5), and
https://chipnet.imaginary.cash/tx/9b41d1ef6fe2e1d163b18923d0df2b5bb5375a599b65c99387cbf3dd16f54803 shows the same
error at 03:44 UTC. The transaction was never mined. The offer then left through a valid fill through the XO engine that
paid the maker 1000 units (`3956954fb7c6c6ccb6d7ac927327eade52df348897643c43d533b5150dc5c933`).

## Why it must fail

The last script of the fill path, `enforceWantedAmount` in `template/swap-intent.ts`:

```
OP_INPUTINDEX OP_OUTPUTTOKENAMOUNT <wantedAmount> OP_GREATERTHANOREQUAL
```

999 is less than 1000, so the script ends with an empty (false) top stack item. The two checks before it hold: output 0
pays the maker's locking script and carries the wanted category. The same transaction paying 1000 units passes the
libauth BCH 2026 virtual machine; with 999 it stops with
`error in evaluating input index 0: Unsuccessful evaluation: completed with a non-truthy value on top of the stack.`
The script prints both results before it sends anything, and it does not send when the 999 unit build passes locally.
`tests/swap-fill-under.test.ts` checks the same pair offline and decodes this transaction from
`tests/fixtures/run8-short-fill.json`.

## The same payment through the XO engine

Asked to build the same short payment (`fill-take-under` by the taker with the maker output's token amount set to 999,
then the maker's build in `fill-under-amount`, which never broadcasts), engine 0.1.1-next.18230317763 built and signed
it without an error (built txid `7c5211e5ffe45e5319bc798057dd3de1e2cdcef4c9bb742f8cb6b5a615c7f580`, output 0 1000 sat
with 999 units, then the 20000 sat payout and the taker's token and plain change). It was not sent. The script reads the
redeem bytecode from input 0 of that build and checks that it hashes to the offer address before it builds its own.

## How to repeat

```
npx tsx scripts/send.ts taker <taker plain token address> tokens 1000 run<n>   # tokens for the plain coin of input 1
npx tsx scripts/run.ts open run<n>
npx tsx scripts/run.ts fill-start run<n>
npx tsx scripts/run.ts fill-take-under run<n>
npx tsx scripts/run.ts fill-under-amount run<n> --dry-run   # builds, checks locally, sends nothing
npx tsx scripts/run.ts fill-under-amount run<n>             # sends once; the node must refuse it
npx tsx scripts/run.ts fill-start run<n>                    # then the valid fill
npx tsx scripts/run.ts fill-take run<n>
npx tsx scripts/run.ts fill-finish run<n>
```

`fill-under-amount` runs on chipnet only; `--network mainnet` stops with
`fill-under-amount runs on chipnet only, not mainnet`. The taker's plain address comes from
`npx tsx scripts/wallets.ts addresses` (the `bchtest:z...` address on the taker line is the token-aware form).
