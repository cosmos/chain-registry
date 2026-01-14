# assetlist.json Guide

Asset metadata for tokens on a blockchain: native tokens, IBC tokens, CW20/ERC20 tokens.

## Asset Type

```
Native token on this chain?  → sdk.coin
From another chain via IBC?  → ics20 + traces
CosmWasm contract?           → cw20 + address
Ethereum contract?           → erc20 + address
Secret Network contract?     → snip20 + address (snip25 address optional)
```

## Native Token

```jsonc
{
  "$schema": "../assetlist.schema.json",
  "chain_name": "yourchain",
  "assets": [{
    "description": "Short description of the token",
    "denom_units": [
      { "denom": "atoken", "exponent": 0 },        // Base MUST have exponent 0
      { "denom": "utoken", "exponent": 6 },        // 1 utoken = 10^6 atoken
      { "denom": "token", "exponent": 18 }         // 1 token = 10^18 atoken
    ],
    "type_asset": "sdk.coin",
    "base": "atoken",                               // Must match a denom_unit
    "display": "token",                             // Must match a denom_unit
    "name": "Token Name",                           // Max 60 chars
    "symbol": "TOKEN",                              // Pattern: ^[a-zA-Z0-9._-]+$ (no spaces)
    "coingecko_id": "token-id",
    "logo_URIs": {
      "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/yourchain/images/token.png",
      "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/yourchain/images/token.svg"
    },
    "images": [{
      "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/yourchain/images/token.png",
      "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/yourchain/images/token.svg",
      "theme": { "circle": true }
    }],
    "socials": {
      "website": "https://yourproject.com",
      "twitter": "https://twitter.com/yourproject"
    }
  }]
}
```

> [!TIP]
> Copy and replace placeholder values. Required: `$schema`, `chain_name`, `assets`, `denom_units`, `type_asset`, `base`, `display`, `name`, `symbol`. Also required: `address` for cw20/erc20/snip20, `traces` for ics20. Update `coingecko_id` and image paths (`yourchain/images/token.png`) to match your chain.

## IBC Token

```jsonc
{
  "description": "The native staking token of Source Chain.",
  "denom_units": [
    { "denom": "ibc/ABC123HASH...", "exponent": 0, "aliases": ["microtoken", "utoken"] },
    { "denom": "mtoken", "exponent": 3, "aliases": ["millitoken"] },
    { "denom": "token", "exponent": 6 }
  ],
  "type_asset": "ics20",
  "base": "ibc/ABC123HASH...",
  "name": "Source Chain Token",
  "display": "token",
  "symbol": "TOKEN",
  "traces": [{
    "type": "ibc",
    "counterparty": {
      "chain_name": "sourcechain",
      "base_denom": "utoken",
      "channel_id": "channel-1"
    },
    "chain": {
      "channel_id": "channel-99",
      "path": "transfer/channel-99/utoken"
    }
  }],
  "logo_URIs": {
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/sourcechain/images/token.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/sourcechain/images/token.svg"
  },
  "images": [{
    "image_sync": { "chain_name": "sourcechain", "base_denom": "utoken" },
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/sourcechain/images/token.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/sourcechain/images/token.svg"
  }],
  "coingecko_id": "source-chain-token"
}
```

## Trace Types

| Type | Use Case | Required Fields |
|------|----------|-----------------|
| `ibc` | Standard IBC transfer | `counterparty.{chain_name, base_denom, channel_id}`, `chain.{channel_id, path}` |
| `ibc-cw20` | CW20 over IBC | Above + `port` on both sides |
| `ibc-bridge` | Bridge protocol (Eureka) | Above + `provider` |
| `bridge` | Non-IBC bridge (Axelar, Gravity) | `counterparty.{chain_name, base_denom}`, `provider` |
| `wrapped` | Wrapped on same chain (WETH) | Same as bridge |
| `liquid-stake` | LST (stATOM) | Same as bridge |
| `additional-mintage` | Same token on multiple chains | Same as bridge |
| `test-mintage` | Testnet version | Same as bridge |
| `legacy-mintage` | Deprecated, replaced by newer | Same as bridge |

### Multi-Hop Traces

Each network in a multi-hop transfer assigns the asset a unique IBC denom. These must be registered in order, with the last trace representing the most recent hop.

```jsonc
"traces": [
  { "type": "ibc", "counterparty": { "chain_name": "migaloo", "base_denom": "factory/migaloo1.../ophir", "channel_id": "channel-5" }, "chain": { "channel_id": "channel-642", "path": "transfer/channel-642/..." } },
  { "type": "ibc", "counterparty": { "chain_name": "osmosis", "base_denom": "ibc/3AF2E322D...", "channel_id": "channel-0" }, "chain": { "channel_id": "channel-141", "path": "transfer/channel-141/transfer/channel-642/..." } }
]
```

## coingecko_id Rules

| Trace Type | coingecko_id |
|------------|--------------|
| `ibc`, `ibc-cw20`, `additional-mintage`, `test-mintage` | Same as source |
| `bridge`, `ibc-bridge` | Different (bridge-specific ID) |

## image_sync

Reference images from origin chain instead of duplicating:

```jsonc
"images": [{
  "image_sync": { "chain_name": "axelar", "base_denom": "uusdc" },
  "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/axelar/images/usdc.png"
}]
```

Use for IBC tokens, bridged tokens, LSTs. Don't use for native tokens unique to your chain.

## CW20/ERC20 Token

```jsonc
{
  "type_asset": "cw20",
  "address": "terra1contractaddress",     // Required for cw20/erc20/snip20
  "base": "cw20:terra1contractaddress",
  "denom_units": [
    { "denom": "cw20:terra1contractaddress", "exponent": 0 },
    { "denom": "token", "exponent": 6 }
  ],
  "display": "token",
  "name": "My Token",
  "symbol": "TOKEN"
}
```

## Common Mistakes

```jsonc
{
  "$schema": "../assetlist.schema.json",
  "chain_name": "yourchain",
  "assets": [{
    "denom_units": [
      { "denom": "utoken", "exponent": 6 }           // Wrong: base denom must have exponent 0
    ],
    "type_asset": "ics20",                           // Wrong: ics20 requires traces array
    "base": "utoken",                                // Wrong: doesn't match a denom_unit with exponent 0
    "display": "TOKEN",                              // Wrong: doesn't match any denom_unit
    "name": "This is a very long name that exceeds the sixty character limit for names",
    "symbol": "MY TOKEN",                            // Wrong: spaces not allowed
    "images": [{
      "image_sync": { "chain_name": "cosmoshub" },   // Wrong: missing base_denom
      "png": "https://github.com/cosmos/chain-registry/blob/master/yourchain/images/token.png"  // Wrong: use raw.githubusercontent.com, not github.com/blob
    }]
  }]
}
```

> [!TIP]
> Copy the URL from the example above and edit the path to match the relevant chain and token names.

## Reference

- Schema: `assetlist.schema.json`
- Examples: [osmosis/assetlist.json](https://github.com/cosmos/chain-registry/blob/master/osmosis/assetlist.json)
