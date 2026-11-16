import type { XOTemplate } from '@xo-cash/types';

/**
 * Landing: the Sampan landing address contract (`contracts/landing.cash` in https://github.com/aimanmalib/sampan),
 * ported to an XO template. BCH paid to the landing address can only leave to the owner.
 *
 * - `land` (payer, start action): pays `landedSatoshis` to the landing locking script.
 * - `convert` (converter, follow-up): the landing coin is input 0, there are as many outputs as inputs, output 0 pays
 *   `ownerLockingScript` fungible tokens of `tokenCategory`, at least `landedSatoshis * rateNum / rateDen` of them.
 *   The converter adds one token coin as input 1 and takes the landed satoshis and the rest of its tokens at output 1.
 * - `giveBack` (follow-up, anyone; the runs use the payer): once the coin is `returnAfter` blocks old, one input and one
 *   output paying the owner plain BCH, at most 1000 satoshis less than the landed value.
 *
 * Neither path needs a key: the scripts below are `landing.cash` written in CashASM, one `require` per line.
 * The landing script is wrapped as pay to script hash 32 by the `p2sh` locking type (Sampan uses P2SH20).
 * Token categories are written in display byte order (as block explorers show them) and reversed inside the script,
 * because the VM pushes categories in transaction byte order.
 */
export const landingTemplate = {
  $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json',
  name: 'Landing',
  description:
    'A landing address that accepts BCH from anyone and lets it leave only to its owner: converted to a fungible ' +
    'CashToken at or above a minimum rate, or returned as BCH once the coin is old enough. No key is needed to finish.',
  icon: 'receive',
  version: '1',
  supported: ['BCH_2023_05', 'BCH_2024_05', 'BCH_2025_05', 'BCH_2026_05'],
  resources: [
    {
      name: 'Original landing contract',
      description: 'The CashScript contract of the Sampan landing address that this template implements.',
      url: 'https://github.com/aimanmalib/sampan/blob/main/contracts/landing.cash',
    },
  ],
  roles: {
    payer: {
      name: 'Payer',
      description: 'Pays BCH to the landing address. Can also return a coin to the owner once it is old enough.',
      icon: 'user',
    },
    converter: {
      name: 'Converter',
      description: 'Pays the owner the tokens for a landed coin at or above the minimum rate and takes its satoshis.',
      icon: 'user',
    },
  },
  start: [{ action: 'land', role: 'payer' }],
  actions: {
    land: {
      name: 'Land',
      description: 'Pay $(<landedSatoshis>) satoshis to the landing address of the owner.',
      icon: 'send',
      roles: {
        payer: {
          name: 'Land',
          description: 'Fund the landing output and state the owner, the token category, the minimum rate and the return age.',
          icon: 'user',
          requirements: {
            variables: ['landedSatoshis', 'ownerLockingScript', 'tokenCategory', 'rateNum', 'rateDen', 'returnAfter'],
          },
        },
      },
      requirements: { participants: [{ role: 'payer', slots: { min: 1, max: 1 } }] },
      transaction: 'landTransaction',
    },
    convert: {
      name: 'Convert',
      description: 'Pay the owner at least $(convertTokenAmount) tokens and take the $(<landedSatoshis>) landed satoshis.',
      icon: 'swap',
      roles: {
        converter: {
          name: 'Convert',
          description: 'Provide one token coin as input 1, the network fee, and the locking script that receives the payout.',
          icon: 'user',
          requirements: {
            variables: ['converterLockingScript', 'converterCoinSatoshis', 'converterCoinTokens', 'convertFeeSatoshis'],
          },
        },
      },
      requirements: { participants: [{ role: 'converter', slots: { min: 1, max: 1 } }] },
      transaction: 'convertTransaction',
    },
    giveBack: {
      name: 'Give back',
      description: 'Return the $(<landedSatoshis>) landed satoshis to the owner as BCH, less the network fee.',
      icon: 'receive',
      roles: {
        payer: {
          name: 'Give back',
          description: 'Anyone may do this once the coin is $(<returnAfter>) blocks old. No key is needed.',
          icon: 'user',
          requirements: { variables: ['giveBackFeeSatoshis'] },
        },
      },
      requirements: { participants: [{ role: 'payer', slots: { min: 1, max: 1 } }] },
      transaction: 'giveBackTransaction',
    },
  },
  transactions: {
    landTransaction: {
      name: 'Landed',
      description: '$(<landedSatoshis>) satoshis paid to the landing address.',
      icon: 'send',
      inputs: [],
      outputs: [{ output: 'landingOutput' }],
      version: 2,
      locktime: 0,
      composable: true,
    },
    convertTransaction: {
      name: 'Converted',
      description: '$(convertTokenAmount) tokens paid to the owner for $(<landedSatoshis>) satoshis.',
      icon: 'swap',
      inputs: [{ input: 'convertInput', inputIndex: 0 }],
      outputs: [
        { output: 'ownerTokenOutput', outputIndex: 0 },
        { output: 'converterPayoutOutput', outputIndex: 1 },
      ],
      version: 2,
      locktime: 0,
      composable: true,
    },
    giveBackTransaction: {
      name: 'Given back',
      description: 'The landed satoshis returned to the owner as BCH.',
      icon: 'receive',
      inputs: [{ input: 'giveBackInput', inputIndex: 0 }],
      outputs: [{ output: 'giveBackOutput', outputIndex: 0 }],
      version: 2,
      locktime: 0,
      composable: false,
    },
  },
  inputs: {
    convertInput: {
      name: 'Landed coin',
      description: 'The landed coin being converted. Holds $(<landedSatoshis>) satoshis and no tokens.',
      icon: 'swap',
      valueSatoshis: '$(<landedSatoshis>)',
      token: null,
      unlockingScript: 'convertUnlockingBytecode',
    },
    giveBackInput: {
      name: 'Landed coin',
      description: 'The landed coin being returned. Its sequence number carries the relative lock of $(<returnAfter>) blocks.',
      icon: 'receive',
      valueSatoshis: '$(<landedSatoshis>)',
      token: null,
      sequenceNumber: '$(<returnAfter>)',
      unlockingScript: 'giveBackUnlockingBytecode',
    },
  },
  outputs: {
    landingOutput: {
      name: 'Landed coin',
      description: '$(<landedSatoshis>) satoshis that can only leave to the owner.',
      icon: 'receive',
      lockingScript: 'landingLockingScript',
      valueSatoshis: '$(<landedSatoshis>)',
      token: null,
    },
    ownerTokenOutput: {
      name: 'Tokens to owner',
      description: '$(convertTokenAmount) tokens paid to the owner. Must be output 0.',
      icon: 'receive',
      lockingScript: '$(<ownerLockingScript>)',
      valueSatoshis: '$(<tokenOutputSatoshis>)',
      token: { category: '$(<tokenCategory>)', amount: '$(convertTokenAmount)', nft: null },
      roles: { converter: { relevant: false } },
    },
    converterPayoutOutput: {
      name: 'Payout to converter',
      description: 'The landed satoshis and the rest of the token coin, received by the converter at output 1.',
      icon: 'receive',
      lockingScript: '$(<converterLockingScript>)',
      valueSatoshis: '$(converterPayoutSatoshis)',
      token: { category: '$(<tokenCategory>)', amount: '$(converterPayoutTokens)', nft: null },
      roles: { payer: { relevant: false } },
    },
    giveBackOutput: {
      name: 'Returned to owner',
      description: 'The landed satoshis returned to the owner as BCH, less the network fee.',
      icon: 'receive',
      lockingScript: '$(<ownerLockingScript>)',
      valueSatoshis: '$(giveBackSatoshis)',
      token: null,
    },
  },
  lockingScripts: {
    landingLockingScript: {
      name: 'Landing address',
      description:
        'Pays out only to the owner: as tokens at or above the minimum rate (convert), or as BCH once the coin is ' +
        '$(<returnAfter>) blocks old (giveBack).',
      icon: 'receive',
      lockingType: 'p2sh',
      lockingBytecode: 'landingLockingBytecode',
      state: { variables: ['landedSatoshis', 'ownerLockingScript', 'tokenCategory', 'rateNum', 'rateDen', 'returnAfter'] },
      selectable: false,
      roles: {
        payer: {
          actions: [{ action: 'giveBack', role: 'payer' }],
          balance: { satoshis: 0n, fungibleTokens: 0n, nonfungibleTokens: 0 },
          selectable: false,
        },
        converter: {
          actions: [{ action: 'convert', role: 'converter' }],
          balance: { satoshis: 0n, fungibleTokens: 0n, nonfungibleTokens: 0 },
          selectable: false,
        },
      },
    },
  },
  scripts: {
    // Smallest token amount the covenant accepts for the landed value: ceil(landedSatoshis * rateNum / rateDen).
    convertTokenAmount: '<landedSatoshis> <rateNum> OP_MUL <rateDen> OP_ADD OP_1SUB <rateDen> OP_DIV',
    converterPayoutSatoshis:
      '<landedSatoshis> <converterCoinSatoshis> OP_ADD <tokenOutputSatoshis> OP_SUB <convertFeeSatoshis> OP_SUB',
    converterPayoutTokens: '<converterCoinTokens> convertTokenAmount OP_SUB',
    giveBackSatoshis: '<landedSatoshis> <giveBackFeeSatoshis> OP_SUB',
    // require(this.activeInputIndex == 0);
    enforceInputZero: 'OP_INPUTINDEX OP_0 OP_NUMEQUALVERIFY',
    // require(tx.outputs.length == tx.inputs.length);
    enforceOutputsMatchInputs: 'OP_TXOUTPUTCOUNT OP_TXINPUTCOUNT OP_NUMEQUALVERIFY',
    // require(tx.outputs[0].lockingBytecode == ownerLock);
    enforcePaysOwner: 'OP_0 OP_OUTPUTBYTECODE <ownerLockingScript> OP_EQUALVERIFY',
    // require(tx.outputs[0].tokenCategory == tokenCategory);
    enforceTokenCategory: 'OP_0 OP_OUTPUTTOKENCATEGORY OP_REVERSEBYTES <tokenCategory> OP_EQUALVERIFY',
    // require(tx.outputs[0].tokenAmount * rateDen >= tx.inputs[0].value * rateNum);
    enforceRate: 'OP_0 OP_OUTPUTTOKENAMOUNT <rateDen> OP_MUL OP_0 OP_UTXOVALUE <rateNum> OP_MUL OP_GREATERTHANOREQUAL',
    // require(this.age >= returnAfter);
    enforceAge: '<returnAfter> OP_CHECKSEQUENCEVERIFY OP_DROP',
    // require(tx.inputs.length == 1); require(tx.outputs.length == 1);
    enforceSingleInputOutput: 'OP_TXINPUTCOUNT OP_1 OP_NUMEQUALVERIFY OP_TXOUTPUTCOUNT OP_1 OP_NUMEQUALVERIFY',
    // require(tx.outputs[0].tokenCategory == 0x);
    enforceNoToken: 'OP_0 OP_OUTPUTTOKENCATEGORY OP_0 OP_EQUALVERIFY',
    // require(tx.outputs[0].value >= tx.inputs[0].value - 1000);
    // A literal, as in the original: the engine does not pass template constants when it compiles a locking script.
    enforceReturnedValue: 'OP_0 OP_OUTPUTVALUE OP_0 OP_UTXOVALUE <1000> OP_SUB OP_GREATERTHANOREQUAL',
    convertPath: 'enforceOutputsMatchInputs enforcePaysOwner enforceTokenCategory enforceRate',
    giveBackPath: 'enforceAge enforceSingleInputOutput enforcePaysOwner enforceNoToken enforceReturnedValue',
    landingLockingBytecode: 'enforceInputZero OP_IF convertPath OP_ELSE giveBackPath OP_ENDIF',
    convertUnlockingBytecode: 'OP_1',
    giveBackUnlockingBytecode: 'OP_0',
  },
  constants: {
    tokenOutputSatoshis: {
      name: 'Token output satoshis',
      description: 'Satoshis carried by the token output paid to the owner. Paid by the converter.',
      type: 'satoshis',
      value: 1000n,
    },
  },
  variables: {
    landedSatoshis: {
      name: 'Landed satoshis',
      description: 'Satoshis the payer sends to the landing address.',
      type: 'satoshis',
    },
    ownerLockingScript: {
      name: 'Owner locking script',
      description: 'Full locking bytecode of the owner address, the only place a landed coin can go.',
      type: 'locking_script',
    },
    tokenCategory: {
      name: 'Token category',
      description: 'Category of the fungible CashToken the owner accepts, in display byte order (as block explorers show it).',
      type: 'token_category',
    },
    rateNum: {
      name: 'Rate numerator',
      description: 'Minimum token base units the owner receives per rate denominator satoshis.',
      type: 'integer',
    },
    rateDen: {
      name: 'Rate denominator',
      description: 'Satoshis that the rate numerator refers to. Must be greater than zero.',
      type: 'integer',
    },
    returnAfter: {
      name: 'Return age',
      description: 'Blocks a landed coin must wait before it can be given back as BCH.',
      type: 'integer',
    },
    converterLockingScript: {
      name: 'Converter receiving locking script',
      description: 'Where the converter receives the landed satoshis and the rest of its token coin.',
      type: 'locking_script',
    },
    converterCoinSatoshis: {
      name: 'Converter coin satoshis',
      description: 'Satoshis of the token coin the converter spends at input 1.',
      type: 'satoshis',
    },
    converterCoinTokens: {
      name: 'Converter coin tokens',
      description: 'Token amount of the coin the converter spends at input 1. Must be at least the amount paid to the owner.',
      type: 'token_amount',
    },
    convertFeeSatoshis: {
      name: 'Convert fee',
      description: 'Satoshis the converter leaves for the network fee of the convert transaction.',
      type: 'satoshis',
    },
    giveBackFeeSatoshis: {
      name: 'Give back fee',
      description: 'Satoshis kept back from the returned value for the network fee. The covenant allows at most 1000.',
      type: 'satoshis',
    },
  },
} satisfies XOTemplate;
