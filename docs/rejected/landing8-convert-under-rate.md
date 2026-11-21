# landing8: convert under the rate, refused by the chipnet node

One deliberate negative test of the Landing covenant on chipnet (run `landing8`, 2026-11-21, `@xo-cash/engine`
0.1.1-next.18230317763 pinned). Its row is the `rejected` row in [docs/CHIPNET-RUNS.md](../CHIPNET-RUNS.md).

## What was sent

- Input 0: the landed coin `afebaf3d75ca1fb9a6682df22b5b798d48de33251a549d859d1920ce44a5e538:0` (10000 sat, P2SH32 landing
  address of `config/chipnet.json`), unlocked with the convert selector (`OP_0`) and the redeem bytecode.
- Input 1: a plain P2PKH coin of the owner account holding 100 test token units
  (`7a9b82e8159b01bcf53e5c556f90d568a32961a4aef7551d119454bc7461d056:0`). The covenant does not check who supplies the tokens.
- Output 0: the owner, 1000 sat with **99** units of `008eebd7...f95a`. The minimum for 10000 sat at rate 1/100 is 100.
- Output 1: the owner account's own coin, the remaining unit and the satoshis less the fee.

Transaction `ed835bf65cc6a20feff041b4afd5f2f38c40761ad7ff3da52e939024c84f3eea`:

```
020000000238e5a544ce20199d859d541a2533de488d795b2bf22d68a6b91fca753dafebaf0000000084004c8156016451205af93f6067e1ae4e20a07e23274c28be1c34b6f687fc8f5a71762350d7eb8e001976a914aa31fb738aaa26db3d651914040cfa6323179a3888ac5579009c63c0009dc4c39d00cd8800d18800d37b9500c67b95a2777767557a519dc0009d547ab275c3519dc4519d00cd8800d1008800cc00c602e80394a2777777680000000056d06174bc5494111d55f7aea46129a368d5906f555c3ef5bc019b15e8829b7a000000006441fb128850b38c15a3881827ed096d09fb49404d05cc6134298fc24ec03560cb69e89260ff253b15dde0d91266b6ddf529c1f54410ec7ca03cc4ecac05eee16074412102cf147db925d06a37f2ea9a5c223bfb88aaadce5564650f1051e68b1b615184ac0000000002e8030000000000003cef5af93f6067e1ae4e20a07e23274c28be1c34b6f687fc8f5a71762350d7eb8e00106376a914aa31fb738aaa26db3d651914040cfa6323179a3888ac42250000000000003cef5af93f6067e1ae4e20a07e23274c28be1c34b6f687fc8f5a71762350d7eb8e00100176a914aa31fb738aaa26db3d651914040cfa6323179a3888ac00000000
```

## What the node answered

Sent once, at 14:28 UTC, to the first chipnet Electrum server of `config/chipnet.json` (chipnet.imaginary.cash):

```
the transaction was rejected by network rules.

mandatory-script-verify-flag-failed (Script evaluated without error but finished with a false/empty top stack element) (code 16)
```

Right after, `blockchain.transaction.get ed835bf6...3eea` answered
`No such mempool or blockchain transaction. Use gettransaction for wallet transactions.` (code -5), and
https://chipnet.imaginary.cash/tx/ed835bf65cc6a20feff041b4afd5f2f38c40761ad7ff3da52e939024c84f3eea shows the same
`getrawtransaction` error. The transaction was never mined. The landed coin then left through a valid convert that paid
the owner 100 units (`3c2245b3ff96b9958384c8270cbf04f39e1b8a8ec5b6c4648c78a37e1b0fd0e5`).

## Why it must fail

The last line of `convert` in `contracts/landing.cash`, kept byte for byte in `template/landing.ts`:

```
require(tx.outputs[0].tokenAmount * rateDen >= tx.inputs[0].value * rateNum);
```

99 * 100 = 9900 is less than 10000 * 1 = 10000, so the script ends with an empty (false) top stack item. Every other
check of `convert` holds: input 0 is active, two inputs and two outputs, output 0 is the owner with the right category.
The same transaction with 100 units passes the libauth BCH 2026 virtual machine; with 99 it stops with
`error in evaluating input index 0: Unsuccessful evaluation: completed with a non-truthy value on top of the stack.`
The script prints both results before it sends anything, and it does not send when the 99 unit build passes locally.
`tests/landing-under-rate.test.ts` checks the same pair offline.

## The same payment through the XO engine

Asked to build the same short payment (`convert-take-under-rate`, then `convert-finish-under-rate`, a dry run that never
broadcasts), engine 0.1.1-next.18230317763 built and signed it without an error (built txid
`d09005afc700aa73650e9e2acb42c6f1be1f1c544cab9308d0b2eecaa7c2b12b`, output 0 99 units). The libauth virtual machine
refuses that build with the message above. In it the converter payout still subtracted the template's 100 units, so
the outputs carried one token unit fewer than the inputs. It was not sent.

## How to repeat

```
npx tsx scripts/landing-run.ts land landing<n>
npx tsx scripts/landing-run.ts convert-under-rate landing<n> --dry-run   # builds, checks locally, sends nothing
npx tsx scripts/landing-run.ts convert-under-rate landing<n>             # sends once; the node must refuse it
npx tsx scripts/landing-run.ts convert landing<n>                        # the valid convert
```

`convert-under-rate` runs on chipnet only; `--network mainnet` stops with
`convert-under-rate runs on chipnet only, not mainnet`. It needs the owner account's plain address to hold a coin with at
least 100 test token units.
