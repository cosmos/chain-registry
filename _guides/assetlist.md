# Comprehensive assetlist.json Guide

## Overview
`assetlist.json` contains metadata for assets (tokens) on a blockchain. This includes native tokens, IBC transferred tokens, CW20 tokens, ERC20 tokens, and other asset types. This guide documents all properties, validation rules, traces patterns, and best practices.

### On-Chain Structure
The asset JSON objects in this registry are modeled after the on-chain `DenomUnit` and `Metadata` structures used in Cosmos SDK chains. These structures define how tokens are represented and displayed in wallets, explorers, and other applications.

**Cosmos SDK On-Chain Structure (Protobuf):**
```protobuf
// From cosmos-sdk/proto/cosmos/bank/v1beta1/bank.proto

message Metadata {
  string description = 1;               // Maps to: description
  repeated DenomUnit denom_units = 2;   // Maps to: denom_units
  string base = 3;                      // Maps to: base
  string display = 4;                   // Maps to: display
  string name = 5;                      // Maps to: name
  string symbol = 6;                    // Maps to: symbol
  string uri = 7;                       // Not used in chain-registry
  string uri_hash = 8;                  // Not used in chain-registry
}

message DenomUnit {
  string denom = 1;                     // Maps to: denom_units[].denom
  uint32 exponent = 2;                  // Maps to: denom_units[].exponent
  repeated string aliases = 3;          // Maps to: denom_units[].aliases
}
```

**Source:** [cosmos-sdk/proto/cosmos/bank/v1beta1/bank.proto](https://github.com/cosmos/cosmos-sdk/blob/main/proto/cosmos/bank/v1beta1/bank.proto)

**How Registry JSON Maps to On-Chain Data:**
```json
{
  "name": "Osmosis",              // → Metadata.Name
  "symbol": "OSMO",               // → Metadata.Symbol
  "description": "Native token",  // → Metadata.Description
  "base": "uosmo",                // → Metadata.Base
  "display": "osmo",              // → Metadata.Display
  "denom_units": [                // → Metadata.DenomUnits
    {
      "denom": "uosmo",           // → DenomUnit.Denom
      "exponent": 0,              // → DenomUnit.Exponent
      "aliases": []               // → DenomUnit.Aliases
    },
    {
      "denom": "osmo",
      "exponent": 6
    }
  ]
}
```

**Additional Registry Fields (Not in On-Chain Metadata):**
The registry extends the on-chain structure with additional metadata for better UX:
- `type_asset` - Asset classification
- `address` - Contract address (for CW20/ERC20)
- `traces` - Asset provenance/journey
- `images` - Visual branding
- `socials` - Social media links
- `coingecko_id` - Market data integration

---

## Table of Contents
1. [Quick Reference Table](#quick-reference-table)
2. [Asset Type Decision Tree](#asset-type-decision-tree)
3. [Required Properties](#required-properties)
4. [Asset Types](#asset-types)
5. [Core Asset Properties](#core-asset-properties)
6. [Denom Units](#denom-units)
7. [Images & Branding](#images--branding)
8. [Traces - Asset Provenance](#traces---asset-provenance)
9. [IBC Assets](#ibc-assets)
10. [image_sync Pattern](#image_sync-pattern)
11. [Social Links](#social-links)
12. [Validation Rules](#validation-rules)
13. [Common Patterns](#common-patterns)
14. [Common Mistakes](#common-mistakes)

---

## Quick Reference Table

| Property | Required | Type | Notes |
|----------|----------|------|-------|
| `chain_name` | ✅ | string | Top-level |
| `assets` | ✅ | array | Must have ≥1 asset |
| `denom_units` | ✅ | array | Per asset, ≥1 unit |
| `type_asset` | ✅ | enum | Default: "sdk.coin" |
| `base` | ✅ | string | Must be in denom_units |
| `display` | ✅ | string | Must be in denom_units |
| `name` | ✅ | string | Max 60 chars |
| `symbol` | ✅ | string | Ticker symbol |
| `address` | ⚠️ | string | Required for cw20/erc20/snip20 |
| `description` | ❌ | string | Short description |
| `extended_description` | ❌ | string | Long description |
| `deprecated` | ❌ | boolean | Omit unless TRUE |
| `traces` | ⚠️ | array | Required for IBC assets |
| `images` | ❌ | array | Min 1 if present |
| `logo_URIs` | ❌ | object | PNG and/or SVG |
| `coingecko_id` | ❌ | string | CoinGecko identifier |
| `keywords` | ❌ | array | Max 20 items |
| `socials` | ❌ | object | Social media links |

Legend:
- ✅ = Always required
- ⚠️ = Conditionally required
- ❌ = Optional

---

## Asset Type Decision Tree

```
Is this a native token on your chain?
├─ YES → type_asset: "sdk.coin"
└─ NO → Is it from another chain via IBC?
    ├─ YES → type_asset: "ics20" + traces
    └─ NO → Is it a contract token?
        ├─ CosmWasm → type_asset: "cw20" + address
        ├─ Ethereum → type_asset: "erc20" + address
        ├─ Secret → type_asset: "snip20" + address
        └─ Other → Check type_asset enum options
```

---

## Required Properties

According to `assetlist.schema.json`, the **top-level** requirements are:

```json
{
  "$schema": "../assetlist.schema.json",  // REQUIRED
  "chain_name": "osmosis",                 // REQUIRED
  "assets": [...]                          // REQUIRED (must have at least 1 asset)
}
```

### For Each Asset:
```json
{
  "denom_units": [...],  // REQUIRED
  "type_asset": "sdk.coin",   // REQUIRED
  "base": "uosmo",            // REQUIRED
  "display": "osmo",          // REQUIRED
  "name": "Osmosis",          // REQUIRED (max 60 chars)
  "symbol": "OSMO"            // REQUIRED
}
```

### Conditionally Required:
**IF `type_asset` is "erc20", "cw20", or "snip20":**
```json
// ERC20 example
{
  "type_asset": "erc20",
  "address": "0x..."         // REQUIRED - Ethereum contract address
}

// CW20 example
{
  "type_asset": "cw20",
  "address": "terra1..."     // REQUIRED - CosmWasm contract address
}

// SNIP20 example
{
  "type_asset": "snip20",
  "address": "secret1..."    // REQUIRED - Secret Network contract address
}
```

**Note on Secret Network Token Standards:**
- **`snip20`** → `address` field is **REQUIRED** (contract-based private token)
- **`snip25`** → `address` field is **OPTIONAL** (IBC-enabled private token, may exist without contract address in some scenarios)

In practice, most `snip25` tokens still include an `address` field, but the schema doesn't enforce it as a requirement.

---

## Asset Types

### `type_asset` (REQUIRED)
**Type:** `string` (enum)

**Default:** `"sdk.coin"`

**Options:**
- `sdk.coin` - Native Cosmos SDK token (includes tokens issued by tokenfactory module)
- `cw20` - CosmWasm CW20 token (requires `address`)
- `erc20` - Ethereum ERC20 token (requires `address`)
- `ics20` - IBC transferred token
- `snip20` - Secret Network SNIP20 token (requires `address`)
- `snip25` - Secret Network SNIP25 token (address NOT required)
- `bitcoin-like` - Chains with single-asset models (no advanced on-chain computation)
- `evm-base` - EVM native assets
- `svm-base` - Solana VM native assets
- `substrate` - Substrate-based assets
- `unknown` - Unknown type

```json
"type_asset": "sdk.coin"      // Native token
"type_asset": "ics20"         // IBC token
"type_asset": "cw20"          // CosmWasm token
"type_asset": "erc20"         // Ethereum token
```

---

## Core Asset Properties

### 1. `description` (Optional)
**Type:** `string`

**Purpose:** Short description of the asset

```json
"description": "The native token of Osmosis"
```

---

### 2. `extended_description` (Optional)
**Type:** `string`

**Purpose:** Long, detailed description

```json
"extended_description": "Osmosis (OSMO) is the premier DEX and cross-chain DeFi hub..."
```

---

### 3. `base` (REQUIRED)
**Type:** `string`

**Purpose:** The smallest unit of the asset. Must exist in `denom_units` with exponent 0.

**Critical Rule:** The `base` denomination MUST have `exponent: 0` in the `denom_units` array.

```json
"base": "uosmo"                    // Native token
"base": "ibc/D189335C..."          // IBC token
"base": "terra1contract..."       // CW20 token
"base": "0xcontract..."           // ERC20 token
```

**Example:**
```json
{
  "base": "uatom",
  "denom_units": [
    {
      "denom": "uatom",
      "exponent": 0      // ✅ Base MUST have exponent 0
    },
    {
      "denom": "atom",
      "exponent": 6
    }
  ]
}
```

---

### 4. `name` (REQUIRED)
**Type:** `string`
**Max length:** 60 characters
**Purpose:** Project name

```json
"name": "Osmosis"
"name": "USD Coin"
"name": "Wrapped Bitcoin"
```

---

### 5. `display` (REQUIRED)
**Type:** `string`

**Purpose:** Human-friendly unit. Must exist in `denom_units`.

```json
"display": "osmo"     // User sees "10 osmo" instead of "10000000 uosmo"
```

---

### 6. `symbol` (REQUIRED)
**Type:** `string`

**Purpose:** Ticker symbol

**Pattern:** `/^[a-zA-Z0-9._-]+$/i`

**Allowed characters:** Letters (a-z, A-Z), Numbers (0-9), Period (.), Underscore (_), Hyphen (-)

**Examples:**
```json
"symbol": "OSMO"
"symbol": "ATOM"
"symbol": "USDC"
"symbol": "LP-DOT.axl-MNTA"
"symbol": "wETH.axl"
"symbol": "EDENBOOST"
```

**Invalid:**
```json
"symbol": "EDEN BOOST"         // ❌ INVALID - space not allowed
"symbol": "LP DOT-MNTA"        // ❌ INVALID - space not allowed
"symbol": "TOKEN/USD"          // ❌ INVALID - slash not allowed
"symbol": "COIN@v2"            // ❌ INVALID - @ not allowed
```

**Common Fixes:**
- Replace spaces with hyphens: `"EDEN BOOST"` → `"EDEN-BOOST"` or `"EDENBOOST"`
- Use periods for bridge prefixes: `"wETH.axl"` ✅
- Use hyphens for LP tokens: `"LP-ATOM-OSMO"` ✅
- Remove special characters: `"TOKEN/USD"` → `"TOKEN-USD"` or `"TOKENUSD"`


---

### 7. `address` (Conditionally Required)
**Type:** `string`

**Required for:** `cw20`, `erc20`, `snip20`
**Optional for:** `snip25`

**Purpose:** Contract address

```json
"type_asset": "cw20",
"address": "terra1..."           // CosmWasm contract

"type_asset": "erc20",
"address": "0x..."               // Ethereum contract

"type_asset": "snip20",
"address": "secret1..."          // Secret Network contract (REQUIRED)

"type_asset": "snip25",
"address": "secret1..."          // Secret Network contract (OPTIONAL)
```

**Why snip25 doesn't require address:**
SNIP25 is an IBC-enabled version of SNIP20 that can represent tokens transferred via IBC, which may not have a contract address on the destination chain. However, in practice, most snip25 tokens in the registry still include an address field.

---

### 8. `deprecated` (Optional)
**Type:** `boolean`

**Purpose:** Mark asset as deprecated
**Best practice:** Omit unless TRUE

```json
"deprecated": true
```

---

## Denom Units

### Structure (REQUIRED for each asset)
**Type:** `array` (must have at least 1 unit)

Each denom unit requires:
- `denom` (REQUIRED) - Unit name
- `exponent` (REQUIRED) - Integer exponent
- `aliases` (OPTIONAL) - Array of alternative names

```json
"denom_units": [
  {
    "denom": "uosmo",        // Base unit
    "exponent": 0            // Base must be 0
  },
  {
    "denom": "osmo",         // Display unit
    "exponent": 6            // 1 osmo = 1,000,000 uosmo
  }
]
```

### Critical Rule: Base Exponent Must Be 0 ✅

```json
// ✅ CORRECT
{
  "denom": "uatom",
  "exponent": 0      // Base is always 0
}

// ❌ WRONG
{
  "denom": "uatom",
  "exponent": 6      // NEVER do this
}
```

### Common Exponent Values
- **6** - Most Cosmos tokens (ATOM, OSMO, JUNO)
- **8** - Bitcoin-based tokens (WBTC)
- **18** - Ethereum-based tokens (ETH, many ERC20s)

### With Aliases
```json
{
  "denom": "ibc/D189335C...",
  "exponent": 0,
  "aliases": ["uusdc"]    // Alternative names
}
```

---

## Images & Branding

### `logo_URIs` (Optional)
**Type:** `object`
**Properties:** `png`, `svg`

```json
"logo_URIs": {
  "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png",
  "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.svg"
}
```

---

### `images` (Optional)
**Type:** `array` (min 1 item if present)

```json
"images": [
  {
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.svg",
    "theme": {
      "circle": true
    }
  }
]
```

**URL Pattern:**
```
^https://raw\\.githubusercontent\\.com/cosmos/chain-registry/master/(|testnets/|_non-cosmos/)[a-z0-9]+/images/.+\\.(png|svg)$
```

---

## Traces - Asset Provenance

### What are Traces?
**Purpose:** Document the origin and journey of an asset across chains
**Required when:** Asset came from another chain or was transformed

### Types of Traces

#### 1. **IBC Transition** (Standard IBC Transfer)
**Type:** `"ibc"`
**Required:** `counterparty`, `chain`

```json
"traces": [
  {
    "type": "ibc",
    "counterparty": {
      "chain_name": "axelar",           // Source chain
      "base_denom": "uusdc",            // Source denom
      "channel_id": "channel-3"         // Source channel
    },
    "chain": {
      "channel_id": "channel-208",      // Destination channel
      "path": "transfer/channel-208/uusdc"  // IBC denom path
    }
  }
]
```

**Channel ID Pattern:** `^channel-\\d+$` or `^channel-(JEnb|\\d+)$` for counterparty

---

#### 2. **IBC-CW20 Transition** (CW20 over IBC)
**Type:** `"ibc-cw20"`
**Required:** `counterparty` (with `port`), `chain` (with `port`)

```json
"traces": [
  {
    "type": "ibc-cw20",
    "counterparty": {
      "chain_name": "juno",
      "base_denom": "cw20:juno1contract...",
      "port": "wasm.juno1port...",
      "channel_id": "channel-42"
    },
    "chain": {
      "port": "transfer",
      "channel_id": "channel-169",
      "path": "transfer/channel-169/wasm.juno1port.../cw20:juno1contract..."
    }
  }
]
```

---

#### 3. **IBC-Bridge Transition** (Bridge Protocol)
**Type:** `"ibc-bridge"`
**Required:** `counterparty`, `chain`, `provider`

```json
"traces": [
  {
    "type": "ibc-bridge",
    "counterparty": {
      "chain_name": "ethereum",
      "base_denom": "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",  // WBTC
      "channel_id": "cosmoshub-0"
    },
    "chain": {
      "channel_id": "08-wasm-1369",
      "path": "transfer/08-wasm-1369/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"
    },
    "provider": "Eureka"              // Bridge provider name
  }
]
```

**Use case:** Ethereum to Cosmos Hub via Eureka bridge

---

#### 4. **Non-IBC Transition** (Bridge, Liquid Stake, Wrapped, etc.)
**Type:** `"bridge"`, `"liquid-stake"`, `"synthetic"`, `"wrapped"`, `"additional-mintage"`, `"test-mintage"`, `"legacy-mintage"`
**Required:** `counterparty`, `provider`
**Optional:** `chain` (with `contract`)

```json
"traces": [
  {
    "type": "liquid-stake",
    "counterparty": {
      "chain_name": "cosmoshub",
      "base_denom": "uatom",
      "contract": "terra1liquidstaking..."  // Optional
    },
    "chain": {
      "contract": "terra1statomcontract..."  // Where transformation happens
    },
    "provider": "Lido"
  }
]
```

**Type options:**
- `bridge` - Represents an asset from another chain (e.g., WBTC on Ethereum)
- `wrapped` - Wrapped version on the same chain (e.g., WETH on Ethereum)
- `liquid-stake` - Liquid staking derivative (e.g., stATOM, stOSMO)
- `synthetic` - Synthetic asset
- `additional-mintage` - Same project issues on multiple chains (e.g., USDT on Ethereum, Tron, Solana)
- `test-mintage` - Testnet/devnet version (e.g., uosmo on Osmosis Testnet)
- `legacy-mintage` - Deprecated token replaced by newer version

**Key Distinction - bridge vs wrapped:**
- `"bridge"` → Asset represents value from **different chain** (WBTC on Ethereum = BTC on Bitcoin)
- `"wrapped"` → Asset wrapped on **same chain** (WETH on Ethereum = ETH on Ethereum)

---

### Multi-Hop Traces
**When:** Asset traveled through multiple chains

**Important Requirements:**
- Each asset along the journey MUST be registered in the chain registry
- The **last object** in the traces array describes the **most recent hop**
- The traces array describes the full journey from origin to destination

```json
"traces": [
  {
    "type": "ibc",
    "counterparty": {
      "chain_name": "migaloo",
      "base_denom": "factory/migaloo1.../ophir",  // Must exist in migaloo/assetlist.json
      "channel_id": "channel-5"
    },
    "chain": {
      "channel_id": "channel-642",
      "path": "transfer/channel-642/factory/migaloo1.../ophir"
    }
  },
  {
    "type": "ibc",
    "counterparty": {
      "chain_name": "osmosis",
      "base_denom": "ibc/3AF2E322D...",     // Must exist in osmosis/assetlist.json
      "channel_id": "channel-0"
    },
    "chain": {
      "channel_id": "channel-141",
      "path": "transfer/channel-141/transfer/channel-642/factory/migaloo1.../ophir"
    }
  }  // ← This is the LAST (most recent) hop
]
```

**Path shows full journey:** Migaloo → Osmosis → Cosmos Hub

**Note:** Future registry enforcement may limit traces to a single hop, with the full journey explored by iterating through each asset's own registration. This prevents disagreement between derived traces vs human-defined traces.

---

## IBC Assets

### Pattern for IBC Transferred Assets

**Type:** `"ics20"`
**Base:** IBC denom hash (starts with `ibc/`)
**Must have:** `traces` array

### Critical Rule: Display Denom Exponent Must Match Source Chain

For IBC-transferred assets, the **display denom unit exponent MUST match** the display denom unit exponent on the source chain.

**Example:**
```json
// Source chain (cosmoshub/assetlist.json):
{
  "base": "uatom",
  "display": "atom",
  "denom_units": [
    { "denom": "uatom", "exponent": 0 },
    { "denom": "atom", "exponent": 6 }    // Display exponent = 6
  ]
}

// Destination chain (osmosis/assetlist.json) - IBC transferred ATOM:
{
  "base": "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  "display": "atom",
  "denom_units": [
    { "denom": "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2", "exponent": 0 },
    { "denom": "atom", "exponent": 6 }    // ✅ MUST match source (6)
  ]
}
```

```json
{
  "description": "Circle's stablecoin on Axelar",
  "denom_units": [
    {
      "denom": "ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858",
      "exponent": 0,
      "aliases": ["uusdc"]
    },
    {
      "denom": "usdc",
      "exponent": 6
    }
  ],
  "type_asset": "ics20",
  "base": "ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858",
  "name": "USD Coin",
  "display": "usdc",
  "symbol": "USDC",
  "traces": [
    {
      "type": "ibc",
      "counterparty": {
        "chain_name": "axelar",
        "base_denom": "uusdc",
        "channel_id": "channel-3"
      },
      "chain": {
        "channel_id": "channel-208",
        "path": "transfer/channel-208/uusdc"
      }
    }
  ]
}
```

---

## image_sync Pattern

### What is image_sync?
**Purpose:** Reference images from the asset's origin chain instead of duplicating files
**Benefits:**
- Avoids duplicate images
- Auto-updates when source changes
- Maintains single source of truth

### Structure
```json
"images": [
  {
    "image_sync": {
      "chain_name": "axelar",
      "base_denom": "uusdc"
    },
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/axelar/images/usdc.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/axelar/images/usdc.svg"
  }
]
```

**Properties:**
- `chain_name` (REQUIRED) - The chain where the asset originates
- `base_denom` (REQUIRED in practice) - The base denom of the asset on the origin chain

### When to Use image_sync

✅ **USE image_sync when:**
- Adding IBC tokens (ATOM on Osmosis)
- Adding testnet versions of mainnet tokens
- Adding wrapped/bridged tokens (wBTC, wETH)
- Adding liquid staking derivatives (stATOM)

❌ **DON'T use image_sync for:**
- Brand new native tokens on your chain
- Tokens that don't exist elsewhere

### Multiple image_sync Entries
```json
"images": [
  {
    "image_sync": {
      "chain_name": "axelar",
      "base_denom": "weth-wei"
    },
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/eth-white.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/eth-white.svg"
  },
  {
    "image_sync": {
      "chain_name": "ethereum",
      "base_denom": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
    },
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/weth.svg"
  }
]
```

---

## Social Links

### `socials` (Optional)
**Type:** `object`
**All properties optional:** `website`, `twitter`, `telegram`, `discord`, `github`, `medium`, `reddit`
**Format:** URI

```json
"socials": {
  "website": "https://osmosis.zone",
  "twitter": "https://twitter.com/osmosiszone",
  "telegram": "https://t.me/osmosis_chat",
  "discord": "https://discord.gg/osmosis",
  "github": "https://github.com/osmosis-labs",
  "medium": "https://medium.com/osmosis",
  "reddit": "https://reddit.com/r/osmosis"
}
```

---

### `keywords` (Optional)
**Type:** `array` of strings
**Min:** 1 item (if present)
**Max:** 20 items

```json
"keywords": ["dex", "staking", "defi"]
```

---

### `coingecko_id` (Optional)
**Type:** `string`

**Purpose:** CoinGecko API identifier

```json
"coingecko_id": "osmosis"
"coingecko_id": "cosmos"
"coingecko_id": "axlusdc"
```

**Critical Rules Based on Trace Type:**

### Trace Types That Use SAME coingecko_id as Source:

The following trace types should **reuse the original mainnet coingecko_id**:

- **`ibc`** - Standard IBC transfers
- **`ibc-cw20`** - CW20 tokens over IBC
- **`additional-mintage`** - Same project on multiple chains
- **`test-mintage`** - Testnet/devnet versions

**Example:**
```json
// ATOM on Cosmos Hub (cosmoshub/assetlist.json):
{
  "base": "uatom",
  "symbol": "ATOM",
  "coingecko_id": "cosmos"
}

// ATOM on Osmosis (osmosis/assetlist.json) - IBC transferred:
{
  "base": "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  "symbol": "ATOM",
  "coingecko_id": "cosmos"    // ✅ SAME as source
}
```

### Trace Types That Need DIFFERENT coingecko_id:

The following trace types **require a distinct coingecko_id**:

- **`bridge`** - Bridge protocols (e.g., Axelar, Gravity Bridge)
- **`ibc-bridge`** - IBC-based bridge protocols (e.g., Eureka)

**Example 1 - Axelar Bridge:**
```json
// Ethereum USDC (ethereum/assetlist.json):
{
  "base": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "symbol": "USDC",
  "coingecko_id": "usd-coin"
}

// Axelar-bridged USDC (axelar/assetlist.json):
{
  "base": "uusdc",
  "symbol": "USDC",
  "coingecko_id": "axlusdc"    // ✅ DIFFERENT
}
```

**Example 2 - Eureka Bridge:**
```json
// Ethereum PAXG (ethereum/assetlist.json):
{
  "base": "0x45804880De22913dAFE09f4980848ECE6EcbAf78",
  "symbol": "PAXG",
  "coingecko_id": "pax-gold"
}

// Eureka-bridged PAXG on Terra2 (terra2/assetlist.json):
{
  "base": "ibc/...",
  "symbol": "PAXG.atom",
  "coingecko_id": "eureka-bridged-pax-gold-terra"    // ✅ DIFFERENT
}
```

**Validation:**
- CoinGecko IDs are validated against the CoinGecko API
- The ID must be a real CoinGecko entry (can be a preview asset on CoinGecko)
- Find valid IDs at: https://api.coingecko.com/api/v3/coins/list

---

## Validation Rules

### Top-Level Requirements
```javascript
required: ["chain_name", "assets"]
assets.minContains: 1    // Must have at least 1 asset
```

### Per-Asset Requirements
```javascript
required: [
  "denom_units",
  "type_asset",
  "base",
  "display",
  "name",
  "symbol"      // Must match pattern: /^[a-zA-Z0-9._-]+$/i (Added PR #6684)
]

// Conditional requirement:
if (type_asset === "cw20" || type_asset === "erc20" || type_asset === "snip20") {
  required.push("address");
}

// Symbol validation (Added Oct 17, 2025 - PR #6684):
symbol.pattern: /^[a-zA-Z0-9._-]+$/i
// Only letters, numbers, period, underscore, hyphen allowed
// NO spaces or special characters
```

### Denom Unit Requirements
```javascript
required: ["denom", "exponent"]
exponent: integer
aliases: array (min 1 if present)
```

### Trace Requirements

**For IBC traces:**
```javascript
required: ["type", "counterparty", "chain"]
counterparty.required: ["chain_name", "base_denom", "channel_id"]
chain.required: ["channel_id", "path"]
```

**For IBC-CW20 traces:**
```javascript
counterparty.required: ["chain_name", "base_denom", "port", "channel_id"]
chain.required: ["port", "channel_id", "path"]
```

**For IBC-Bridge traces:**
```javascript
required: ["type", "counterparty", "chain", "provider"]
```

**For Non-IBC traces:**
```javascript
required: ["type", "counterparty", "provider"]
counterparty.required: ["chain_name", "base_denom"]
chain.required: ["contract"]  // If chain object exists
```

### Image Requirements
```javascript
images.minItems: 1  // If present
// No requirement for png vs svg - can have either or both
```

### Pattern Validations
- **Channel ID:** `^channel-\\d+$`
- **Counterparty Channel ID:** `^channel-(JEnb|\\d+)$`
- **Image URLs:** Must match GitHub raw URL pattern
- **Name:** Max 60 characters

---

## Common Patterns

### Minimal Native Token
```json
{
  "$schema": "../assetlist.schema.json",
  "chain_name": "examplechain",
  "assets": [
    {
      "description": "The native token of Example Chain",
      "denom_units": [
        {
          "denom": "uexample",
          "exponent": 0
        },
        {
          "denom": "example",
          "exponent": 6
        }
      ],
      "base": "uexample",
      "name": "Example",
      "display": "example",
      "symbol": "EXAMPLE",
      "type_asset": "sdk.coin",
      "logo_URIs": {
        "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/examplechain/images/example.png"
      }
    }
  ]
}
```

---

### IBC Token with image_sync
```json
{
  "description": "ATOM on Osmosis",
  "denom_units": [
    {
      "denom": "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
      "exponent": 0,
      "aliases": ["uatom"]
    },
    {
      "denom": "atom",
      "exponent": 6
    }
  ],
  "type_asset": "ics20",
  "base": "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  "name": "Cosmos Hub Atom",
  "display": "atom",
  "symbol": "ATOM",
  "traces": [
    {
      "type": "ibc",
      "counterparty": {
        "chain_name": "cosmoshub",
        "base_denom": "uatom",
        "channel_id": "channel-141"
      },
      "chain": {
        "channel_id": "channel-0",
        "path": "transfer/channel-0/uatom"
      }
    }
  ],
  "images": [
    {
      "image_sync": {
        "chain_name": "cosmoshub",
        "base_denom": "uatom"
      },
      "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png",
      "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.svg"
    }
  ],
  "logo_URIs": {
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.svg"
  }
}
```

---

### CW20 Token
```json
{
  "description": "A CosmWasm CW20 token",
  "denom_units": [
    {
      "denom": "cw20:terra1contractaddress",
      "exponent": 0
    },
    {
      "denom": "token",
      "exponent": 6
    }
  ],
  "type_asset": "cw20",
  "address": "terra1contractaddress",    // REQUIRED for cw20
  "base": "cw20:terra1contractaddress",
  "name": "My Token",
  "display": "token",
  "symbol": "TOKEN",
  "logo_URIs": {
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/terra/images/token.png"
  }
}
```

---

### Bridged Ethereum Asset
```json
{
  "description": "Wrapped Bitcoin on the Cosmos Hub",
  "denom_units": [
    {
      "denom": "ibc/D742E8566B0B8CC8F569D950051C09CF57988A88F0E45574BFB3079D41DE6462",
      "exponent": 0
    },
    {
      "denom": "wbtc",
      "exponent": 8       // Bitcoin uses 8 decimals
    }
  ],
  "type_asset": "ics20",
  "base": "ibc/D742E8566B0B8CC8F569D950051C09CF57988A88F0E45574BFB3079D41DE6462",
  "name": "Wrapped Bitcoin",
  "display": "wbtc",
  "symbol": "WBTC",
  "traces": [
    {
      "type": "ibc-bridge",
      "counterparty": {
        "chain_name": "ethereum",
        "base_denom": "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
        "channel_id": "cosmoshub-0"
      },
      "chain": {
        "channel_id": "08-wasm-1369",
        "path": "transfer/08-wasm-1369/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"
      },
      "provider": "Eureka"
    }
  ],
  "images": [
    {
      "image_sync": {
        "chain_name": "ethereum",
        "base_denom": "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"
      },
      "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/wbtc.png",
      "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/wbtc.svg"
    }
  ],
  "logo_URIs": {
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/wbtc.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/wbtc.svg"
  }
}
```

---

## Common Mistakes

### 1. ❌ Base Exponent Not Zero
```json
// WRONG
"denom_units": [
  {
    "denom": "uatom",
    "exponent": 6      // ❌ Base must be 0
  }
]

// CORRECT
"denom_units": [
  {
    "denom": "uatom",
    "exponent": 0      // ✅ Base is always 0
  },
  {
    "denom": "atom",
    "exponent": 6      // Display unit can be any exponent
  }
]
```

---

### 2. ❌ Using IBC Token Without Traces
```json
// WRONG - Missing traces
{
  "type_asset": "ics20",
  "base": "ibc/D189335C..."
  // Missing: traces array
}

// CORRECT
{
  "type_asset": "ics20",
  "base": "ibc/D189335C...",
  "traces": [
    {
      "type": "ibc",
      "counterparty": { ... },
      "chain": { ... }
    }
  ]
}
```

---

### 3. ❌ Using image_sync Without Traces
```json
// WRONG
{
  "type_asset": "ics20",
  "images": [
    {
      "image_sync": { ... }
    }
  ]
  // Missing: traces array
}

// CORRECT - Always use traces with image_sync
{
  "type_asset": "ics20",
  "traces": [ ... ],
  "images": [
    {
      "image_sync": { ... }
    }
  ]
}
```

---

### 4. ❌ Missing address for CW20/ERC20
```json
// WRONG
{
  "type_asset": "cw20"
  // Missing: address field (REQUIRED for cw20)
}

// CORRECT
{
  "type_asset": "cw20",
  "address": "terra1contractaddress"
}
```

---

### 5. ❌ Base Not in denom_units
```json
// WRONG
{
  "base": "uatom",
  "denom_units": [
    {
      "denom": "atom",   // Missing "uatom"
      "exponent": 6
    }
  ]
}

// CORRECT
{
  "base": "uatom",
  "denom_units": [
    {
      "denom": "uatom",  // ✅ Base must be in denom_units
      "exponent": 0
    },
    {
      "denom": "atom",
      "exponent": 6
    }
  ]
}
```

---

### 6. ❌ Display Not in denom_units
```json
// WRONG
{
  "display": "atom",
  "denom_units": [
    {
      "denom": "uatom",  // Missing "atom"
      "exponent": 0
    }
  ]
}

// CORRECT
{
  "display": "atom",
  "denom_units": [
    {
      "denom": "uatom",
      "exponent": 0
    },
    {
      "denom": "atom",  // ✅ Display must be in denom_units
      "exponent": 6
    }
  ]
}
```

---

### 7. ❌ Name Too Long
```json
// WRONG
{
  "name": "This is a very long token name that exceeds the sixty character limit for names"  // 80 chars
}

// CORRECT
{
  "name": "Token Name"  // Max 60 characters
}
```

---

### 8. ❌ Wrong Image URL Format
```json
// WRONG
{
  "png": "https://example.com/logo.png"
}

// CORRECT
{
  "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png"
}
```

---

## Schema Location

**File:** [assetlist.schema.json](https://github.com/cosmos/chain-registry/blob/master/assetlist.schema.json)

---

## Real-World Examples

- **Osmosis:** [osmosis/assetlist.json](https://github.com/cosmos/chain-registry/blob/master/osmosis/assetlist.json)
- **Cosmos Hub:** [cosmoshub/assetlist.json](https://github.com/cosmos/chain-registry/blob/master/cosmoshub/assetlist.json)

---

**Last Updated:** 2025-11-4
