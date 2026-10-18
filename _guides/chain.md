# Comprehensive chain.json Guide

## Overview
`chain.json` is the core metadata file that contains information about a blockchain in the Cosmos Chain Registry. This guide documents all properties, validation rules, and best practices based on the schema and real-world examples.

---

## Table of Contents
1. [Quick Reference Table](#quick-reference-table)
2. [Required Properties](#required-properties)
3. [Property Categories](#property-categories)
   - [Core Identification Properties](#core-identification-properties)
   - [Network & Status Properties](#network--status-properties)
   - [Blockchain Configuration](#blockchain-configuration)
   - [Fees & Staking](#fees--staking)
   - [Codebase Information](#codebase-information)
   - [Network Connectivity](#network-connectivity)
   - [Images & Branding](#images--branding)
4. [Chain Forks & Hard Forks - Archival Process](#chain-forks--hard-forks---archival-process)
5. [Validation Rules](#validation-rules)
6. [Common Patterns](#common-patterns)
7. [Common Mistakes](#common-mistakes)
8. [Schema Location](#schema-location)
9. [Additional Resources](#additional-resources)

---

## Quick Reference Table

| Property | Required | Type | Notes |
|----------|----------|------|-------|
| `$schema` | ✅ | string | Path to chain.schema.json |
| `chain_name` | ✅ | string | Lowercase alphanumeric only |
| `chain_type` | ✅ | enum | "cosmos", "eip155", etc. |
| `status` | ✅ | enum | "live", "upcoming", "killed" - **Enforced by node validation** |
| `network_type` | 🔵 | enum | "mainnet", "testnet", "devnet" |
| `chain_id` | ⚠️ | string | Required for cosmos/eip155 |
| `bech32_prefix` | ⚠️ | string | Required for cosmos chains |
| `slip44` | ⚠️ | number | Required for live cosmos mainnets (validation script) |
| `fees` | 🔵 | object | Fee token information (best practice) |
| `logo_URIs` | 🔵 | object | PNG/SVG logos (best practice) |
| `images` | 🔵 | array | Extended image metadata (best practice) |
| `pretty_name` | ❌ | string | Display name |
| `website` | ❌ | URI | Official URL |
| `staking` | ❌ | object | Staking token information |
| `codebase` | ❌ | object | Version & build information |
| `peers` | ❌ | object | Seeds & persistent peers |
| `apis` | ❌ | object | RPC, REST, gRPC endpoints |
| `explorers` | ❌ | array | Block explorer links |
| `description` | ❌ | string | Max 3000 chars |
| `keywords` | ❌ | array | Max 20 items |

Legend:
- ✅ = Required (enforced by JSON schema or node validation - will fail CI)
- 🔵 = Recommended (best practice - should be provided)
- ⚠️ = Conditionally required
- ❌ = Optional

---

## Required Properties

According to `chain.schema.json`, **3 properties** are formally REQUIRED by JSON schema validation:

### ✅ Required (Schema)
```json
{
  "$schema": "../chain.schema.json",  // REQUIRED by JSON schema
  "chain_name": "example",            // REQUIRED by JSON schema
  "chain_type": "cosmos"              // REQUIRED by JSON schema
}
```

### ✅ Required (Node Validation)
**Note:** While `status` is not in the schema's required array, it is **enforced by node validation** (`validate_data.mjs`). PRs without this field will fail CI checks.

```json
{
  "status": "live"            // REQUIRED by node validation: "live", "upcoming", or "killed"
}
```

### ✅ Recommended (Practice)
While not strictly enforced, this property should always be provided:

```json
{
  "network_type": "mainnet"   // RECOMMENDED: "mainnet", "testnet", or "devnet"
}
```

### ⚠️ Conditionally Required

**IF `chain_type` is "cosmos":**
```json
{
  "chain_type": "cosmos",
  "bech32_prefix": "osmo"     // REQUIRED for cosmos chains
}
```

**IF `chain_type` is "cosmos" OR "eip155":**
```json
{
  "chain_type": "cosmos",
  "chain_id": "osmosis-1"     // REQUIRED for cosmos and eip155 chains
}
```

---

## Core Identification Properties

### 1. `$schema` (REQUIRED)

**Type:** `string`

**Pattern:** `^(\\.\\./)+chain\\.schema\\.json$`

**Purpose:** Points to the schema file for validation. Used by editors like VS Code to link the JSON file to the defining schema for real-time validation.

```json
"$schema": "../chain.schema.json"         // Mainnet
"$schema": "../../chain.schema.json"      // Testnet
"$schema": "../../../chain.schema.json"   // _non-cosmos/ (e.g., ethereumtestnet)
```

**Note:** When in a `/_non-cosmos/` or `/testnets/_non-cosmos/` directory, add an extra `../` level to reach the schema at the repository root.

---

### 2. `chain_name` (REQUIRED)

**Type:** `string`

**Pattern:** `[a-z0-9]+` (lowercase alphanumeric only, no hyphens/underscores)

**Purpose:** Unique identifier for the chain

**⚠️ Important:** `chain_name` **cannot be changed once set**. It becomes the permanent identifier in the registry. However, since users typically never see this value directly (they see `pretty_name` instead), this should not be a problem if a chain undergoes rebranding.

```json
"chain_name": "osmosis"      // ✅ Valid
"chain_name": "cosmoshub"    // ✅ Valid
"chain_name": "cosmos-hub"   // ❌ Invalid (no hyphens)
"chain_name": "Osmosis"      // ❌ Invalid (no uppercase)
```

---

### 3. `chain_type` (REQUIRED)

**Type:** `string` (enum)

**Options:**
- `cosmos` - Cosmos SDK chains
- `eip155` - Ethereum/EVM chains
- `bip122` - Bitcoin-based chains
- `polkadot`, `solana`, `algorand`, `arweave`, `ergo`, `fil`, `hedera`, `monero`, `reef`, `stacks`, `starknet`, `stellar`, `tezos`, `vechain`, `waves`, `xrpl`, `unknown`

```json
"chain_type": "cosmos"       // Most common for Cosmos chains
```

---

### 4. `chain_id` (Conditionally Required)

**Type:** `string`

**Purpose:** On-chain identifier

**Required for:** `cosmos` and `eip155` chains

```json
// Cosmos chains
"chain_id": "osmosis-1"      // Osmosis mainnet
"chain_id": "cosmoshub-4"    // Cosmos Hub
"chain_id": "osmo-test-5"    // Osmosis testnet

// EVM chains
"chain_id": "1"              // Ethereum mainnet
"chain_id": "137"            // Polygon
```

---

### 5. `pretty_name`

**Type:** `string`

**Purpose:** Human-readable display name

```json
"chain_name": "osmosis",
"pretty_name": "Osmosis"
```

**Rebranding Note:**
If a chain rebrands (changes its public-facing name/identity) but keeps the same `chain_id`, you can simply update:
- ✅ `pretty_name` - The new brand name
- ✅ Logo images - New branding assets
- ❌ **DO NOT** change `chain_name` - This remains permanent

**Example: Simple Rebrand (NOT a hard fork)**
```json
// Before rebrand:
{
  "chain_name": "juno",
  "chain_id": "juno-1",
  "pretty_name": "Juno"
}

// After rebrand:
{
  "chain_name": "juno",        // ← Stays the same
  "chain_id": "juno-1",        // ← Stays the same
  "pretty_name": "Juno Network" // ← Updated for new branding
}
```

**Rebrand vs Hard Fork:**
- **Rebrand:** `chain_id` stays same → Just update `pretty_name` and logos
- **Hard Fork:** `chain_id` changes → Follow full archival process (see Section 9)

---

### 6. `website` (Optional)

**Type:** `string` (URI format)

**Purpose:** Official website URL

**Best Practice:** Maintainers should be able to verify this by seeing a reference to the same website from official documentation or social media accounts (e.g., the project's Twitter/X page).

```json
"website": "https://osmosis.zone/"
```

---

## Network & Status Properties

**Note:** `status` is **enforced by node validation** (`validate_data.mjs`) and will cause CI checks to fail if missing. `network_type` is strongly recommended but not strictly enforced.

### 7. `status` (Required by Node Validation)

**Type:** `string` (enum)

**Options:** `"live"`, `"upcoming"`, `"killed"`

```json
"status": "live"      // Production network
"status": "upcoming"  // Not yet launched
"status": "killed"    // Deprecated/shut down
```

---

### 8. `network_type`

**Type:** `string` (enum)

**Options:** `"mainnet"`, `"testnet"`, `"devnet"`

```json
"network_type": "mainnet"
```

---

## Blockchain Configuration

### 9. `bech32_prefix` (Required for Cosmos)

**Type:** `string`

**Purpose:** Human-readable part of addresses

**Note on SLIP-0173:** Registration with [SLIP-0173](https://github.com/satoshilabs/slips/blob/master/slip-0173.md) is **recommended but no longer validated**. While it's best practice to register your prefix, the registry does not enforce this requirement. SLIP-0173 requires different prefixes for testnet and devnet, but Cosmos chains often use the same prefix across environments, which can make registration difficult.

```json
"bech32_prefix": "osmo"     // Osmosis addresses: osmo1...
"bech32_prefix": "cosmos"   // Cosmos Hub addresses: cosmos1...
```

---

### 10. `bech32_config` (Optional)

**Type:** `object`

**Purpose:** Override bech32_prefix for specific use cases

**Properties:** (all optional)
- `bech32PrefixAccAddr` - Account addresses (e.g., "cosmos")
- `bech32PrefixAccPub` - Account public keys (e.g., "cosmospub")
- `bech32PrefixValAddr` - Validator addresses (e.g., "cosmosvaloper")
- `bech32PrefixValPub` - Validator public keys (e.g., "cosmosvaloperpub")
- `bech32PrefixConsAddr` - Consensus addresses (e.g., "cosmosvalcons")
- `bech32PrefixConsPub` - Consensus public keys (e.g., "cosmosvalconspub")

```json
"bech32_config": {
  "bech32PrefixAccAddr": "cosmos",
  "bech32PrefixAccPub": "cosmospub",
  "bech32PrefixValAddr": "cosmosvaloper",
  "bech32PrefixValPub": "cosmosvaloperpub",
  "bech32PrefixConsAddr": "cosmosvalcons",
  "bech32PrefixConsPub": "cosmosvalconspub"
}
```

---

### 11. `daemon_name`

**Type:** `string`

**Purpose:** Name of the blockchain daemon/binary

```json
"daemon_name": "osmosisd"
"daemon_name": "gaiad"
```

---

### 12. `node_home`

**Type:** `string`

**Purpose:** Default home directory for node data

```json
"node_home": "$HOME/.osmosisd"
"node_home": "$HOME/.gaia"
```

---

### 13. `key_algos`

**Type:** `array` of strings (enum)

**Options:** `"secp256k1"`, `"ethsecp256k1"`, `"ed25519"`, `"sr25519"`, `"bn254"`

**Unique items only**

```json
"key_algos": ["secp256k1"]                    // Most common
"key_algos": ["secp256k1", "ethsecp256k1"]   // Multiple algos
```

---

### 14. `slip44` (Required for Live Cosmos Mainnets)

**Type:** `number`

**Purpose:** Coin type for HD wallet derivation path

**Requirement:**
- ✅ **Required** for `"chain_type": "cosmos"` + `"status": "live"` + `"network_type": "mainnet"`
- ⚠️ **Highly recommended** for other mainnets
- ❌ **Optional** for testnets and devnets

**Common values:**
- `118` - Standard Cosmos chains
- `60` - Ethereum-compatible chains
- `330` - Terra chains

```json
"slip44": 118   // Standard Cosmos
```

**Note:** The JSON schema doesn't enforce this, but the validation script will flag missing `slip44` on live cosmos mainnets as an error.

---

### 15. `alternative_slip44s` (Optional)

**Type:** `array` of numbers

**Purpose:** Alternative coin types supported

```json
"alternative_slip44s": [60, 330]
```

---

## Fees & Staking

### 16. `fees`

**Type:** `object`

**Required subproperty:** `fee_tokens` (array)

**Best Practice:** Provide fees information as it's essential for wallets and applications.

#### Fee Token Structure:

**Required:** `denom`

**Optional:** `fixed_min_gas_price`, `low_gas_price`, `average_gas_price`, `high_gas_price`, `gas_costs`

**⚠️ Important:** Gas prices must follow this ordering:
```
high_gas_price >= average_gas_price >= low_gas_price >= fixed_min_gas_price
```

```json
"fees": {
  "fee_tokens": [
    {
      "denom": "uosmo",
      "fixed_min_gas_price": 0.01,
      "low_gas_price": 0.01,
      "average_gas_price": 0.1,
      "high_gas_price": 0.16
    },
    {
      "denom": "ibc/1234ABCD...",
      // Gas prices are optional for all fee tokens
    }
  ]
}
```

#### Gas Costs (Optional):
```json
"gas_costs": {
  "cosmos_send": 100000,
  "ibc_transfer": 200000
}
```

---

### 17. `staking`

**Type:** `object`

**Required subproperty:** `staking_tokens` (array)

**Optional subproperty:** `lock_duration`

```json
"staking": {
  "staking_tokens": [
    {
      "denom": "uosmo"    // Required
    }
  ],
  "lock_duration": {
    "blocks": 403200,           // Optional: number of blocks
    "time": "1209600s"          // Optional: approximate time
  }
}
```

---

## Codebase Information

### 18. `codebase`

**Type:** `object`

**Properties:** (all optional)

```json
"codebase": {
  "git_repo": "https://github.com/osmosis-labs/osmosis",  // URI
  "recommended_version": "30.0.0",                        // Current version
  "compatible_versions": ["30.0.0", "30.0.1"],           // Array (typically same major version)
  "tag": "v30.0.0",                                       // Git tag (pattern: ^[A-Za-z0-9._/@-]+$)
  "language": { ... },     // See below
  "binaries": { ... },     // See below
  "sdk": { ... },          // See below
  "consensus": { ... },    // See below
  "cosmwasm": { ... },     // See below
  "ibc": { ... },          // See below
  "genesis": { ... }       // See below
}
```

---

#### 18a. `language` (Optional)

**Required:** `type` (enum: `"go"`, `"rust"`, `"solidity"`, `"other"`)

**Optional:** `version`, `repo`, `tag`

```json
"language": {
  "type": "go",
  "version": "1.23.4"
}
```

---

#### 18b. `binaries` (Optional)

**Supported platforms:** `linux/amd64`, `linux/arm64`, `darwin/amd64`, `darwin/arm64`, `windows/amd64`, `windows/arm64`

```json
"binaries": {
  "linux/amd64": "https://github.com/.../osmosisd-30.0.0-linux-amd64",
  "linux/arm64": "https://github.com/.../osmosisd-30.0.0-linux-arm64",
  "darwin/amd64": "https://github.com/.../osmosisd-30.0.0-darwin-amd64",
  "darwin/arm64": "https://github.com/.../osmosisd-30.0.0-darwin-arm64"
}
```

---

#### 18c. `sdk` (Optional)

**Required:** `type` (enum: `"cosmos"`, `"penumbra"`, `"other"`)

**Optional:** `version`, `repo`, `tag`

```json
"sdk": {
  "type": "cosmos",
  "version": "0.50.14",
  "repo": "https://github.com/osmosis-labs/cosmos-sdk",
  "tag": "v0.50.14-v30-osmo"
}
```

---

#### 18d. `consensus` (Optional)

**Required:** `type` (enum: `"tendermint"`, `"cometbft"`, `"sei-tendermint"`, `"cometbls"`)

**Optional:** `version`, `repo`, `tag`

```json
"consensus": {
  "type": "cometbft",
  "version": "0.38.17",
  "repo": "https://github.com/osmosis-labs/cometbft",
  "tag": "v0.38.17-v28-osmo-1"
}
```

---

#### 18e. `cosmwasm` (Optional)

**Properties:** `version`, `repo`, `tag`, `enabled` (boolean), `path`

```json
"cosmwasm": {
  "version": "0.53.3",
  "repo": "https://github.com/CosmWasm/wasmd",
  "tag": "v0.53.3",
  "enabled": true,
  "path": "$HOME/.osmosisd/data/wasm"  // Must match pattern: ^\\$HOME.*$
}
```

---

#### 18f. `ibc` (Optional)

**Required:** `type` (enum: `"go"`, `"rust"`, `"other"`)

**Optional:** `version`, `repo`, `tag`, `ics_enabled`

```json
"ibc": {
  "type": "go",
  "version": "8.7.0",
  "repo": "https://github.com/cosmos/ibc-go",
  "tag": "v8.7.0",
  "ics_enabled": ["ics20-1", "ics27-1"]  // Enum: "ics20-1", "ics27-1", "mauth"
}
```

---

#### 18g. `genesis` (Optional)

**Required:** `genesis_url` (URI)

**Optional:** `name`, `ics_ccv_url`

```json
"genesis": {
  "name": "v3",
  "genesis_url": "https://github.com/osmosis-labs/networks/raw/main/osmosis-1/genesis.json",
  "ics_ccv_url": "https://example.com/ccv-state.json"  // For consumer chains
}
```

---

## Network Connectivity

### 19. `peers`

**Type:** `object`

**Properties:** `seeds`, `persistent_peers` (both arrays)

#### Peer Object Structure:

**Required:** `id`, `address`

**Optional:** `provider`

```json
"peers": {
  "seeds": [
    {
      "id": "f515a8599b40f0e84dfad935ba414674ab11a668",
      "address": "osmosis.blockpane.com:26656",
      "provider": "blockpane"
    }
  ],
  "persistent_peers": [
    {
      "id": "4d9ac3510d9f5cfc975a28eb2a7b8da866f7bc47",
      "address": "37.187.38.191:26656",
      "provider": "stakelab"
    }
  ]
}
```

---

### 20. `apis`

**Type:** `object`

**Properties:** `rpc`, `rest`, `grpc`, `wss`, `grpc-web`, `evm-http-jsonrpc` (all arrays)

#### Endpoint Object Structure:

**Required:** `address`

**Optional:** `provider`, `archive` (boolean, default false)

```json
"apis": {
  "rpc": [
    {
      "address": "https://rpc.osmosis.zone/",
      "provider": "Osmosis Foundation",
      "archive": false
    }
  ],
  "rest": [
    {
      "address": "https://lcd.osmosis.zone/",
      "provider": "Osmosis Foundation"
    }
  ],
  "grpc": [
    {
      "address": "osmosis.lavenderfive.com:443",
      "provider": "Lavender.Five Nodes 🐝"
    }
  ],
  "wss": [],
  "grpc-web": [],
  "evm-http-jsonrpc": []
}
```

---

### 21. `explorers`

**Type:** `array` of explorer objects

**Properties:** `kind`, `url`, `tx_page`, `account_page`, `validator_page`, `proposal_page`, `block_page`

```json
"explorers": [
  {
    "kind": "mintscan",
    "url": "https://www.mintscan.io/osmosis",
    "tx_page": "https://www.mintscan.io/osmosis/transactions/${txHash}",
    "account_page": "https://www.mintscan.io/osmosis/accounts/${accountAddress}",
    "validator_page": "https://www.mintscan.io/osmosis/validators/${validatorAddress}",
    "proposal_page": "https://www.mintscan.io/osmosis/proposals/${proposalId}",
    "block_page": "https://www.mintscan.io/osmosis/blocks/${blockHeight}"
  }
]
```

**Template variables:**
- `${txHash}` - Transaction hash
- `${accountAddress}` - Account address
- `${validatorAddress}` - Validator address
- `${proposalId}` - Proposal ID
- `${blockHeight}` - Block height


---

## Images & Branding

**Best Practice:** Provide `logo_URIs` and `images` so your chain displays properly in wallets and applications.

### 22. `logo_URIs`

**Type:** `object`

**Properties:** `png`, `svg` (URI references)

**Pattern:** Must follow GitHub raw URL format

```json
"logo_URIs": {
  "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png",
  "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.svg"
}
```

**Pattern:**
```
^https://raw\\.githubusercontent\\.com/cosmos/chain-registry/master/(|testnets/|_non-cosmos/)[a-z0-9]+/images/.+\\.(png|svg)$
```

---

### 23. `images`

**Type:** `array` of image objects

**Must have:** At least one of `png` or `svg`

**Optional:** `image_sync`, `theme`

```json
"images": [
  {
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.svg",
    "theme": {
      "circle": true,
      "dark_mode": false,
      "monochrome": false
    }
  }
]
```

#### Using `image_sync` (for cross-chain references):
```json
"images": [
  {
    "image_sync": {
      "chain_name": "osmosis",
      "base_denom": "uosmo"
    },
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png"
  }
]
```

---

### 24. `description`

**Type:** `string`

**Min length:** 1

**Max length:** 3000 characters

```json
"description": "Osmosis (OSMO) is the premier DEX and cross-chain DeFi hub within the Cosmos ecosystem..."
```

---

### 25. `keywords` (Optional)

**Type:** `array` of strings

**Max items:** 20

```json
"keywords": ["dex", "defi", "amm"]
```

---

### 26. `extra_codecs` (Optional)

**Type:** `array` of strings (enum)

**Options:** `"ethermint"`, `"injective"`

**Unique items only**

```json
"extra_codecs": ["ethermint"]
```

---

### 27. `pre_fork_chain_name` (Optional)

**Type:** `string`

**Pattern:** `[a-z0-9]+`

**Purpose:** Reference to chain before a hard fork

```json
"pre_fork_chain_name": "terra"   // For Terra 2.0 referencing Terra Classic
```

---

## Chain Forks & Hard Forks - Archival Process

### When Chain ID Changes - Hard Fork Handling

**IMPORTANT:** When a chain upgrades or resets with a **different `chain_id`**, this is considered a **hard fork**. The previous chain must be **archived**, and the new chain gets its own directory.

**⚠️ Hard Fork vs Rebrand - Key Distinction:**

| Scenario | `chain_id` Changes? | Action Required |
|----------|---------------------|-----------------|
| **Hard Fork** | ✅ YES | Follow full archival process (this section) |
| **Rebrand** | ❌ NO | Just update `pretty_name` and logos (see Section 5) |

**Examples:**
- **Hard Fork:** `cosmoshub-4` → `cosmoshub-5` (chain_id changed) → Archive cosmoshub-4
- **Rebrand:** Chain changes name/logo but keeps `juno-1` → Just update `pretty_name`

---

### Overview of Hard Fork Process

When a chain forks (e.g., `cosmoshub-4` → `cosmoshub-5`):
1. **Archive the old chain** (cosmoshub-4) → Rename directory to `/cosmoshub4/`
2. **Create new chain** (cosmoshub-5) → Uses original directory `/cosmoshub/`
3. **Update all references** across chain.json, assetlist.json, IBC files, traces, images

---

### Step 1: Archive the Pre-Fork Chain

#### 1.1 Update `chain_name` and `status`

Add an identifying number to the chain_name. Choose either:
- **Incrementing counter** starting from 1: `cosmoshub` → `cosmoshub1`
- **Chain ID number**: `cosmoshub-4` → `cosmoshub4` (preferred if chain_id has number)

Also update the `status` field to `"killed"` to indicate the chain is no longer active.

**Example:**
```json
// OLD (before fork):
{
  "chain_name": "cosmoshub",
  "chain_id": "cosmoshub-4",
  "status": "live"
}

// ARCHIVED (after fork):
{
  "chain_name": "cosmoshub4",  // ← Number added
  "chain_id": "cosmoshub-4",   // ← Unchanged
  "status": "killed"           // ← Updated to "killed"
}
```

#### 1.2 Update ALL References to chain_name

When changing `chain_name`, update these locations:

**✅ 1. Chain metadata files:**
- `chain.json` → Update `chain_name` property
- `assetlist.json` → Update `chain_name` property
- `versions.json` → Update `chain_name` property (if exists)

**✅ 2. IBC connection files:**

**Filename change:**
```bash
# OLD filename:
_IBC/cosmoshub-osmosis.json

# NEW filename:
_IBC/cosmoshub4-osmosis.json
```

**Inside the file - Before Archive:**
```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "cosmoshub",  // ← OLD: uses original name
    "client_id": "07-tendermint-259",
    "connection_id": "connection-257"
  },
  "chain_2": {
    "chain_name": "osmosis",
    "client_id": "07-tendermint-1",
    "connection_id": "connection-0"
  },
  "channels": [{
    "chain_1": {
      "channel_id": "channel-141",
      "port_id": "transfer"
    },
    "chain_2": {
      "channel_id": "channel-0",
      "port_id": "transfer"
    },
    "ordering": "unordered",
    "version": "ics20-1"
  }]
}
```

**Inside the file - After Archive:**
```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "cosmoshub4",  // ← UPDATED: now points to archived chain
    "client_id": "07-tendermint-259",
    "connection_id": "connection-257"
  },
  "chain_2": {
    "chain_name": "osmosis",  // ← Unchanged (Osmosis wasn't archived)
    "client_id": "07-tendermint-1",
    "connection_id": "connection-0"
  },
  "channels": [{
    "chain_1": {
      "channel_id": "channel-141",  // ← All IDs stay the same
      "port_id": "transfer"
    },
    "chain_2": {
      "channel_id": "channel-0",
      "port_id": "transfer"
    },
    "ordering": "unordered",
    "version": "ics20-1"
  }]
}
```

**Key Points:**
- ✅ Only `chain_name` changes (from `cosmoshub` → `cosmoshub4`)
- ✅ All IBC identifiers stay the same (channel IDs, connection IDs, client IDs)
- ✅ The counterparty chain (`osmosis`) remains unchanged
- ✅ File must be renamed to match the new chain_name

**✅ 3. Asset traces on OTHER chains:**

Any asset that originated from the archived chain needs trace updates.

**Example:** ATOM on Osmosis that came from cosmoshub-4
```json
// In osmosis/assetlist.json:
{
  "base": "ibc/...",
  "name": "Cosmos Hub Atom",
  "traces": [{
    "type": "ibc",
    "counterparty": {
      "chain_name": "cosmoshub4",  // ← Updated from "cosmoshub"
      "base_denom": "uatom"
    }
  }]
}
```

**✅ 4. Image sync pointers:**
```json
// Update image_sync references:
{
  "image_sync": {
    "chain_name": "cosmoshub4",  // ← Updated
    "base_denom": "uatom"
  }
}
```

**✅ 5. Image URI paths:**

Update image paths in the archived chain's directory:
```json
// OLD:
"png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png"

// NEW:
"png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub4/images/atom.png"
```

**Exception:** Images moving to the post-fork chain keep original paths (see Step 2.3).

#### 1.3 Rename Directory

```bash
# Rename directory to match new chain_name:
mv cosmoshub/ cosmoshub4/
```

#### 1.4 Add Legacy Mintage Traces (When Needed)

### When to Use `legacy-mintage`:

**Use `legacy-mintage` when a team or chain issues a **replacement version** of the asset**, meaning the asset on the old pre-fork chain becomes **deprecated**.

### Real Examples:

**Example 1: Chain Restart with Replacement Token**
```json
// dungeon1/assetlist.json (archived chain)
{
  "base": "udgn",
  "name": "Dragon Coin",
  "symbol": "DGN",
  "description": "Deprecated Dragon Token...",  // ← Note "Deprecated"
  "traces": [{
    "type": "legacy-mintage",
    "counterparty": {
      "chain_name": "dungeon",    // ← Points to NEW chain
      "base_denom": "udgn"
    },
    "provider": "Dungeon Chain"
  }]
}
```
**Why:** Chain restarted with fresh genesis. Old DGN tokens are deprecated, new DGN tokens issued as replacement.

**Example 2: Token Migration to New Chain**
```json
// terra/assetlist.json (Terra Classic)
{
  "base": "cw20:terra1php5m8a6qd68z02t3zpw4jv2pj4vgw4wz0t8mz",
  "symbol": "WHALE",
  "traces": [{
    "type": "legacy-mintage",
    "counterparty": {
      "chain_name": "migaloo",
      "base_denom": "uwhale"
    },
    "provider": "Migaloo"
  }]
}
```
**Why:** WHALE token migrated from Terra Classic (CW20) to Migaloo (native token). Terra Classic version is deprecated, Migaloo version is the replacement.

### Purpose of `legacy-mintage`:

Warns applications and users that **this old token no longer retains its purpose**. Therefore, the functionality and value once tied to the asset can no longer be assumed.

---

### Step 2: Set Up the Post-Fork (New) Chain

#### 2.1 Use Original chain_name

The new chain takes the **original chain_name**:

```json
// New chain (cosmoshub-5):
{
  "chain_name": "cosmoshub",   // ← Takes original name
  "chain_id": "cosmoshub-5"    // ← New chain ID
}
```

#### 2.2 Add `pre_fork_chain_name` Property

Reference the archived chain:

```json
{
  "chain_name": "cosmoshub",
  "chain_id": "cosmoshub-5",
  "pre_fork_chain_name": "cosmoshub4"  // ← Points to archived chain
}
```

**Purpose:** Indicates that the pre-fork chain's state was bundled into genesis.

**When to use:**
- ✅ **State continuation:** Pre-fork state included in new genesis
- ❌ **Clean slate:** New chain starts fresh with no previous state
- ⚠️ **Testnet from mainnet:** Testnet uses mainnet state (not previous testnet)

#### 2.3 Use Original Directory

The new chain uses the **original directory name**:

```bash
/cosmoshub/          # ← New chain (cosmoshub-5) goes here
/cosmoshub4/         # ← Old chain (cosmoshub-4) archived here
```

#### 2.4 Image Inheritance

Assets continuing to the new chain can **keep original image URIs** because the new chain uses the original directory:

```json
// Both old and new ATOM use same path:
"png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png"

// cosmoshub4/ has its own copy (if needed)
// cosmoshub/ has the current version
```

---

### Complete Example: Cosmos Hub Fork

#### Before Fork (cosmoshub-4):
```
/cosmoshub/
├── chain.json          ("chain_name": "cosmoshub", "chain_id": "cosmoshub-4", "status": "live")
├── assetlist.json
└── images/atom.png

/_IBC/cosmoshub-osmosis.json
```

#### After Fork (cosmoshub-4 → cosmoshub-5):

**Archived Chain:**
```
/cosmoshub4/            ← Directory renamed
├── chain.json          ("chain_name": "cosmoshub4", "chain_id": "cosmoshub-4", "status": "killed")
├── assetlist.json      (chain_name updated, legacy-mintage traces if needed)
└── images/atom.png     (URI updated to cosmoshub4/...)

/_IBC/cosmoshub4-osmosis.json  ← Filename changed, chain_name inside updated
```

**Content of `_IBC/cosmoshub4-osmosis.json` (archived):**
```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "cosmoshub4",  // ← Updated to archived name
    "client_id": "07-tendermint-259",
    "connection_id": "connection-257"
  },
  "chain_2": {
    "chain_name": "osmosis",
    "client_id": "07-tendermint-1",
    "connection_id": "connection-0"
  },
  "channels": [{
    "chain_1": { "channel_id": "channel-141", "port_id": "transfer" },
    "chain_2": { "channel_id": "channel-0", "port_id": "transfer" },
    "ordering": "unordered",
    "version": "ics20-1"
  }]
}
```

**New Chain:**
```
/cosmoshub/             ← Original directory
├── chain.json          ("chain_name": "cosmoshub", "chain_id": "cosmoshub-5",
│                        "pre_fork_chain_name": "cosmoshub4")
├── assetlist.json
└── images/atom.png     (URI keeps cosmoshub/... path)

/_IBC/cosmoshub-osmosis.json  ← New file for new chain (if IBC continues)
```

**Content of `_IBC/cosmoshub-osmosis.json` (new chain):**
```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "cosmoshub",  // ← Back to original name for new chain
    "client_id": "07-tendermint-300",  // ← NEW client ID
    "connection_id": "connection-280"  // ← NEW connection ID
  },
  "chain_2": {
    "chain_name": "osmosis",
    "client_id": "07-tendermint-50",  // ← NEW client ID on Osmosis side
    "connection_id": "connection-45"  // ← NEW connection ID
  },
  "channels": [{
    "chain_1": { "channel_id": "channel-200", "port_id": "transfer" },  // ← NEW channel
    "chain_2": { "channel_id": "channel-150", "port_id": "transfer" },  // ← NEW channel
    "ordering": "unordered",
    "version": "ics20-1"
  }]
}
```

**Important Notes:**
- The archived IBC file keeps the old IDs (they still reference valid historical connections)
- The new chain needs NEW IBC connections established (new client IDs, connection IDs, channel IDs)
- Both files coexist in `_IBC/` directory with different filenames

---

### Quick Checklist: Hard Fork Process

**Archiving Pre-Fork Chain:**
- [ ] Update `chain_name` with number suffix
- [ ] Update `status` to `"killed"` in chain.json
- [ ] Update `chain_name` in chain.json, assetlist.json, versions.json
- [ ] Rename IBC files (e.g., `cosmoshub-osmosis.json` → `cosmoshub4-osmosis.json`)
- [ ] Update `chain_name` references in IBC files
- [ ] Update trace `counterparty.chain_name` on all external chains
- [ ] Update `image_sync` references
- [ ] Update image URI paths (if staying in archived directory)
- [ ] Rename directory (e.g., `/cosmoshub/` → `/cosmoshub4/`)
- [ ] Add `legacy-mintage` traces if asset has been replaced by new version (see Section 1.4)

**Creating Post-Fork Chain:**
- [ ] Create new directory with original chain_name (e.g., `/cosmoshub/`)
- [ ] Set `chain_name` to original name
- [ ] Set `chain_id` to new value
- [ ] Add `pre_fork_chain_name` pointing to archived chain (if state continuation)
- [ ] Create new IBC files if needed
- [ ] Images can use original URIs (now in new directory)

---

### Common Fork Scenarios

#### Scenario 1: State Continuation (Most Common)
```json
// cosmoshub-5 genesis includes cosmoshub-4 state
{
  "chain_name": "cosmoshub",
  "chain_id": "cosmoshub-5",
  "pre_fork_chain_name": "cosmoshub4"  // ✅ Include this
}
```

#### Scenario 2: Clean Slate
```json
// New chain, fresh start, no previous state
{
  "chain_name": "newchain",
  "chain_id": "newchain-1"
  // ❌ No pre_fork_chain_name (nothing to reference)
}
```

#### Scenario 3: Testnet from Mainnet State
```json
// Testnet uses mainnet state, not previous testnet
{
  "chain_name": "osmosistestnet",
  "chain_id": "osmo-test-6",
  "pre_fork_chain_name": "osmosis"  // ← Points to mainnet, not osmo-test-5
}
```

---

### Important Notes

1. **Hard Fork Definition:** Any change to `chain_id` is a hard fork requiring archival
2. **Numbering:** Use chain_id number if available (`cosmoshub-4` → `cosmoshub4`)
3. **Original Name:** Post-fork chain always gets the original `chain_name`
4. **Legacy Mintage:** Mark replaced assets so users know they don't have same value
5. **IBC Files:** Must update both filenames AND content
6. **Comprehensive Update:** Missing any reference update will cause validation failures

---

## Validation Rules

### Pattern Validations

1. **chain_name:** `[a-z0-9]+` (lowercase alphanumeric only)
2. **version:** `^v?\\d+(\\.\\d+){0,2}$` (e.g., "v1.0.0" or "1.0.0")
3. **tag:** `^[A-Za-z0-9._/@-]+$` (Git tags)
4. **cosmwasm path:** `^\\$HOME.*$` (Must start with $HOME)
5. **image URLs:** Must match GitHub raw URL pattern

### Conditional Requirements

```javascript
// IF chain_type = "cosmos" THEN bech32_prefix IS REQUIRED
if (chain_type === "cosmos") {
  required.push("bech32_prefix");
}

// IF chain_type = "cosmos" OR "eip155" THEN chain_id IS REQUIRED
if (chain_type === "cosmos" || chain_type === "eip155") {
  required.push("chain_id");
}
```

### Nested Object Requirements

- `fees.fee_tokens[].denom` - REQUIRED if fees object exists
- `staking.staking_tokens[].denom` - REQUIRED if staking object exists
- `codebase.genesis.genesis_url` - REQUIRED if genesis object exists
- `codebase.sdk.type` - REQUIRED if sdk object exists
- `codebase.consensus.type` - REQUIRED if consensus object exists
- `codebase.ibc.type` - REQUIRED if ibc object exists
- `codebase.language.type` - REQUIRED if language object exists
- `peers.seeds[].id` - REQUIRED for each seed
- `peers.seeds[].address` - REQUIRED for each seed
- `peers.persistent_peers[].id` - REQUIRED for each persistent peer
- `peers.persistent_peers[].address` - REQUIRED for each persistent peer
- `apis.*.address` - REQUIRED for each endpoint
- `images[]` - Must have at least one of `png` or `svg`

---

## Common Patterns

### Minimal Valid chain.json (Non-Cosmos)
```json
{
  "$schema": "../../chain.schema.json",
  "chain_name": "bitcoin",
  "chain_type": "bip122",
  "status": "live"
}
```

### Minimal Valid chain.json (Cosmos)
```json
{
  "$schema": "../chain.schema.json",
  "chain_name": "examplechain",
  "chain_type": "cosmos",
  "chain_id": "example-1",
  "bech32_prefix": "example",
  "status": "live"
}
```

### Typical Mainnet chain.json
```json
{
  "$schema": "../chain.schema.json",
  "chain_name": "examplechain",
  "chain_type": "cosmos",
  "chain_id": "example-1",
  "website": "https://example.com",
  "pretty_name": "Example Chain",
  "status": "live",
  "network_type": "mainnet",
  "bech32_prefix": "example",
  "daemon_name": "exampled",
  "node_home": "$HOME/.exampled",
  "key_algos": ["secp256k1"],
  "slip44": 118,
  "fees": {
    "fee_tokens": [
      {
        "denom": "uexample",
        "fixed_min_gas_price": 0.01,
        "low_gas_price": 0.01,
        "average_gas_price": 0.025,
        "high_gas_price": 0.03
      }
    ]
  },
  "staking": {
    "staking_tokens": [
      {
        "denom": "uexample"
      }
    ]
  },
  "codebase": {
    "git_repo": "https://github.com/example/example",
    "recommended_version": "v1.0.0",
    "compatible_versions": ["v1.0.0"],
    "consensus": {
      "type": "cometbft",
      "version": "0.38.11"
    },
    "sdk": {
      "type": "cosmos",
      "version": "0.50.9"
    },
    "ibc": {
      "type": "go",
      "version": "8.5.1"
    },
    "genesis": {
      "genesis_url": "https://example.com/genesis.json"
    }
  },
  "logo_URIs": {
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/examplechain/images/example.png"
  },
  "peers": {
    "seeds": [
      {
        "id": "abc123...",
        "address": "seed.example.com:26656",
        "provider": "Example Foundation"
      }
    ]
  },
  "apis": {
    "rpc": [
      {
        "address": "https://rpc.example.com",
        "provider": "Example Foundation"
      }
    ],
    "rest": [
      {
        "address": "https://api.example.com",
        "provider": "Example Foundation"
      }
    ]
  },
  "explorers": [
    {
      "kind": "mintscan",
      "url": "https://www.mintscan.io/examplechain",
      "tx_page": "https://www.mintscan.io/examplechain/transactions/${txHash}"
    }
  ]
}
```

---

## Common Mistakes

### 1. ❌ Using uppercase or hyphens in chain_name
```json
"chain_name": "Example-Chain"   // WRONG
"chain_name": "examplechain"    // CORRECT
```

### 2. ❌ Missing required fields for Cosmos chains
```json
{
  "chain_name": "example",
  "chain_type": "cosmos"
  // Missing: chain_id, bech32_prefix
}
```

### 3. ❌ Missing slip44 for live cosmos mainnets
```json
{
  "chain_type": "cosmos",
  "status": "live",
  "network_type": "mainnet"
  // ❌ ERROR: Missing "slip44": 118
  // Validation script will flag this
}
```

### 4. ❌ Wrong image URL format
```json
"png": "https://example.com/logo.png"  // WRONG - must be GitHub raw URL
"png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/examplechain/images/example.png"  // CORRECT
```

### 5. ❌ Invalid version format
```json
"version": "version-1.0.0"    // WRONG
"version": "v1.0.0"           // CORRECT
"version": "1.0.0"            // ALSO CORRECT
```

### 6. ❌ Missing required nested properties
```json
"fees": {
  "fee_tokens": [
    {
      // Missing "denom" - REQUIRED
      "low_gas_price": 0.01
    }
  ]
}
```

---

## Schema Location

**Mainnet:** `/chain.schema.json` (root level)
**Reference:** `"$schema": "../chain.schema.json"`

**Testnet:** `/chain.schema.json` (root level)
**Reference:** `"$schema": "../../chain.schema.json"`

---

## Additional Resources

- **Schema file:** `chain.schema.json` (lines 1-742)
- **Real examples:**
  - [Osmosis chain.json](https://github.com/cosmos/chain-registry/blob/master/osmosis/chain.json)
  - [Cosmos Hub chain.json](https://github.com/cosmos/chain-registry/blob/master/cosmoshub/chain.json)
- **SLIP-0044:** https://github.com/satoshilabs/slips/blob/master/slip-0044.md (HD wallet coin types)
- **SLIP-0173:** https://github.com/satoshilabs/slips/blob/master/slip-0173.md (Bech32 prefix registry)
- **CAIP-2 Namespaces:** https://github.com/ChainAgnostic/namespaces

---

**Last Updated:** 2025-11-19
