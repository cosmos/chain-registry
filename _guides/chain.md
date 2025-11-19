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
