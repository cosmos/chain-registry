# Comprehensive chain.json Guide

## Overview
`chain.json` is the core metadata file that contains information about a blockchain in the Cosmos Chain Registry. This guide documents all properties, validation rules, and best practices based on the schema and real-world examples.

---

## Table of Contents
1. [Required Properties](#required-properties)
2. **Property Categories:**
   - [Core Identification Properties](#core-identification-properties)
   - [Network & Status Properties](#network--status-properties)
   - [Blockchain Configuration](#blockchain-configuration)
   - [Fees & Staking](#fees--staking)
   - [Codebase Information](#codebase-information)
   - [Network Connectivity](#network-connectivity)
   - [Images & Branding](#images--branding)
3. [Quick Reference Table](#quick-reference-table)
4. [Chain Forks & Hard Forks - Archival Process](#chain-forks--hard-forks---archival-process)
5. [Validation Rules](#validation-rules)
6. [Common Patterns](#common-patterns)
7. [Common Mistakes](#common-mistakes)
8. [Schema Location](#schema-location)
9. [Additional Resources](#additional-resources)

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
