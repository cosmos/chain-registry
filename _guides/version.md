## 📋 Overview

`versions.json` is a **metadata file** that tracks the version history of a Cosmos SDK-based blockchain, documenting all upgrades, their configurations, and software dependencies over time.

**Location:** `{chain-name}/versions.json`

**Schema:** `../versions.schema.json`

**Optional:** Yes (but recommended for mainnet chains with upgrades)

### Relationship with chain.json

While `versions.json` provides a comprehensive history of all versions, **`chain.json`'s `codebase` section is the authoritative source for the chain's current version**. Key points:

- `versions.json` is a **nice-to-have** historical record
- `chain.json::codebase` is the **source of truth** for current version data
- Automated workflows may synchronize the two files if there's a mismatch
- Some tools and applications may only read `chain.json` for current version information

---

## 📏 Version Format Standards

**All version fields** in this registry follow [Semantic Versioning](https://semver.org/) (semver) standards:

**Format:** `major.minor.patch` with an optional `v` prefix

**Examples:**
- `v0.47.13` or `0.47.13` ← Full semver
- `v16.0.0` or `16.0.0` ← Major.minor.patch
- `v1.22` or `1.22` ← Major.minor only

This applies to ALL version-related fields:
- `recommended_version`
- `compatible_versions` array
- Component versions (`sdk.version`, `ibc.version`, `consensus.version`, etc.)

**Reference:** [https://semver.org/](https://semver.org/)

---

## Table of Contents

1. [Required Fields](#-required-fields)
2. [Version Object Structure](#-version-object-structure)
3. [Version Object Fields (Detailed)](#-version-object-fields-detailed)
   - [name (Required)](#1-name--required)
   - [tag](#2-tag)
   - [height](#3-height)
   - [proposal](#4-proposal)
   - [recommended_version](#5-recommended_version)
   - [compatible_versions](#6-compatible_versions)
   - [previous_version_name](#7-previous_version_name)
   - [next_version_name](#8-next_version_name)
4. [Component Specifications](#-component-specifications)
   - [sdk - Cosmos SDK Version](#9-sdk---cosmos-sdk-version)
   - [consensus - Consensus Engine](#10-consensus---consensus-engine)
   - [ibc - IBC Version](#11-ibc---ibc-version)
   - [cosmwasm - CosmWasm Support](#12-cosmwasm---cosmwasm-support)
   - [language - Programming Language](#13-language---programming-language)
   - [binaries - Downloadable Binaries](#14-binaries---downloadable-binaries)
5. [Complete Examples](#-complete-example)
   - [Minimal Version Entry](#minimal-version-entry)
   - [Typical Version Entry](#typical-version-entry)
   - [Complete Version Entry (All Fields)](#complete-version-entry-all-fields)
6. [Review Checklist for versions.json PRs](#-review-checklist-for-versionsjson-prs)
7. [Common Mistakes](#-common-mistakes)

---

## 🔑 Required Fields

### Top-Level Structure

```json
{
  "$schema": "../versions.schema.json",
  "chain_name": "osmosis",
  "versions": [ /* array of version objects */ ]
}
```

| Field | Type | Required | Pattern | Description |
|-------|------|----------|---------|-------------|
| `$schema` | string | Yes | `^(\\.\\./)+versions\\.schema\\.json$` | Path to schema file |
| `chain_name` | string | Yes | `[a-z0-9]+` | Lowercase alphanumeric only |
| `versions` | array | Yes | - | Array of version objects |

---

## 📦 Version Object Structure

Each item in the `versions` array represents a single upgrade/version of the chain.

### Required Fields (Per Version)

```json
{
  "name": "v16",
  "tag": "v16.0.0",
  "height": 20440500,
  "recommended_version": "v16.0.0",
  "compatible_versions": ["v16.0.0"],
  "proposal": 914,
  "previous_version_name": "v15",
  "next_version_name": "v17"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **`name`** | string | ✅ **YES** | Official upgrade name (e.g., "v16", "Vega", "Genesis") |

All other fields are **optional** but highly recommended.

---

## 📝 Version Object Fields (Detailed)

### 1. `name` ⭐ **REQUIRED**

**Type:** `string`

**Description:** Official upgrade name

**Examples:**
```json
"name": "v16"           // Numeric version
"name": "Vega"          // Named upgrade (Cosmos Hub style)
"name": "genesis"       // First version
"name": "v28.0.1+"      // Patch version range
```

**Best Practices:**
- Use official governance proposal name
- Be consistent across upgrades
- Use lowercase for numeric versions

---

### 2. `tag`

**Type:** `string`

**Pattern:** `^[A-Za-z0-9._/@-]+$`

**Description:** Git tag for the upgrade

**Examples:**
```json
"tag": "v16.0.0"                    // Simple version tag
"tag": "v0.45.16-ics-lsm"          // Custom build tag
"tag": "0.31.0-osmo-v16"           // Fork with suffix
```

**Best Practices:**
- Must match actual GitHub release tag
- Include `v` prefix if used in repo

---

### 3. `height`

**Type:** `number`

**Description:** Block height where upgrade activates

**Examples:**
```json
"height": 20440500      // Cosmos Hub v16
"height": 0             // Genesis block
"height": 33187000      // Osmosis v29
```

**Notes:**
- `0` for genesis version
- Must be exact block height from governance proposal

---

### 4. `proposal`

**Type:** `number`

**Description:** Governance proposal number

**Examples:**
```json
"proposal": 914         // Cosmos Hub proposal #914
"proposal": 837         // Osmosis proposal #837
```

**When to Include:**
- All governance-approved upgrades
- Mainnet upgrades with on-chain voting

---

### 5. `recommended_version`

**Type:** `string`

**Description:** Recommended software version to run

**Examples:**
```json
"recommended_version": "v16.0.0"
"recommended_version": "v9.1.1"
"recommended_version": "28.0.4"    // Can omit 'v' prefix
```

**Best Practices:**
- Usually matches the latest patch version
- Update when security patches released

---

### 6. `compatible_versions`

**Type:** `array` of `string`

**Description:** All versions compatible with this upgrade

**What does "compatible" mean?**

Version compatibility refers to software versions that can successfully run on the blockchain at this upgrade height without breaking consensus. Following [Semantic Versioning](https://semver.org/) principles, compatibility typically aligns with **major version numbers**:

- **Same major version** = Compatible (e.g., `v16.0.0`, `v16.0.1`, `v16.1.0` are all compatible)
- **Different major version** = Incompatible (e.g., `v15.x.x` incompatible with `v16.x.x`)

In practice, this means:
- **Patch versions** (v16.0.0 → v16.0.1) fix bugs, always compatible
- **Minor versions** (v16.0.0 → v16.1.0) add features, usually compatible within same major
- **Major versions** (v15.x.x → v16.x.x) breaking changes, NOT compatible

**Examples:**
```json
// Minimal (only recommended)
"compatible_versions": ["v16.0.0"]

// With patches (all v13.0.x compatible)
"compatible_versions": [
  "v13.0.1",
  "v13.0.2"
]

// Wide range with minor versions (Osmosis style - all v25.x.x compatible)
"compatible_versions": [
  "25.0.0",
  "25.0.1",
  "25.0.2",
  "25.0.3",
  "25.1.0",  // Minor bump, still compatible
  "25.1.1",
  "25.1.2",
  "25.1.3",
  "25.2.0",  // Another minor bump, still compatible
  "25.2.1"
]
```

**Best Practices:**
- List all patch versions that work for this upgrade
- Include minor version updates if they maintain consensus compatibility
- Order chronologically (oldest to newest)
- Update when new patches/minors are released
- Never mix major versions (e.g., don't list v15.x.x and v16.x.x together)

---

### 7. `previous_version_name`

**Type:** `string`

**Description:** Name of the previous version (for linking)

```json
"previous_version_name": "v15"
```

**Notes:**
- Should match another version's `name` field
- Creates version chain: v15 → v16 → v17

---

### 8. `next_version_name`

**Type:** `string`

**Description:** Name of the following version

```json
"next_version_name": "v17"
"next_version_name": ""      // Latest version (empty string)
```

**Notes:**
- Empty string for current latest version
- Update previous version when adding new

---

## 🔧 Component Specifications

### 9. `sdk` - Cosmos SDK Version

**Type:** `object`

**Required:** `type`

```json
"sdk": {
  "type": "cosmos",                           // Required: "cosmos", "penumbra", or "other"
  "version": "v0.47.13",                      // Optional: Simple version (v1.0.0 format)
  "tag": "v0.47.13-ics-lsm",                 // Optional: Detailed tag
  "repo": "https://github.com/cosmos/cosmos-sdk"  // Optional: Custom fork
}
```

**Version Pattern:** `^v?\\d+(\\.\\d+){0,2}$` (e.g., `v1`, `v1.0`, `v1.0.0`)

**Tag Pattern:** `^v?\\d+(\\.\\d+){0,2}(-[\\w\\.\\-]+)?$` (allows suffixes)

**Examples:**
```json
// Standard SDK
"sdk": {
  "type": "cosmos",
  "version": "v0.50.11"
}

// Custom fork
"sdk": {
  "type": "cosmos",
  "version": "v0.47.5",
  "repo": "https://github.com/osmosis-labs/cosmos-sdk",
  "tag": "v0.47.5-v22-osmo-3"
}

// Other SDK type
"sdk": {
  "type": "penumbra",
  "version": "v0.52.0"
}
```

---

### 10. `consensus` - Consensus Engine

**Type:** `object`

**Required:** `type`

```json
"consensus": {
  "type": "cometbft",                         // Required
  "version": "v0.38.17",                      // Optional
  "repo": "https://github.com/cometbft/cometbft",  // Optional
  "tag": "v0.38.17-v28-osmo-1"               // Optional
}
```

**Valid Types:**
- `"tendermint"` - Legacy (pre-v0.37)
- `"cometbft"` - Current (v0.37+)
- `"sei-tendermint"` - Sei fork
- `"cometbls"` - BLS variant

**Examples:**
```json
// Standard CometBFT
"consensus": {
  "type": "cometbft",
  "version": "v0.38.11"
}

// Custom fork (Osmosis)
"consensus": {
  "type": "cometbft",
  "version": "v0.38.11",
  "repo": "https://github.com/osmosis-labs/cometbft",
  "tag": "v0.38.11-v26-osmo-1"
}

// Legacy Tendermint
"consensus": {
  "type": "tendermint",
  "version": "v0.34.29"
}
```

---

### 11. `ibc` - IBC Version

**Type:** `object`

**Required:** `type`

```json
"ibc": {
  "type": "go",                               // Required: "go", "rust", or "other"
  "version": "v8.7.0",                        // Optional
  "repo": "https://github.com/cosmos/ibc-go", // Optional
  "tag": "v8.7.0",                            // Optional
  "ics_enabled": ["ics20-1", "ics27-1"]      // Optional: Enabled ICS standards
}
```

**ICS Standards:**
- `"ics20-1"` - Token transfer
- `"ics27-1"` - Interchain accounts
- `"mauth"` - Multi-chain authentication

**Examples:**
```json
// Basic IBC
"ibc": {
  "type": "go",
  "version": "v8.7.0"
}

// With ICS apps enabled
"ibc": {
  "type": "go",
  "version": "v7.4.0",
  "ics_enabled": ["ics20-1"]
}

// Rust implementation
"ibc": {
  "type": "rust",
  "version": "v0.48.0"
}
```

---

### 12. `cosmwasm` - CosmWasm Support

**Type:** `object`

**No required fields** (but must have at least 1 property)

```json
"cosmwasm": {
  "version": "v0.53.2",                       // Optional
  "repo": "https://github.com/CosmWasm/wasmd", // Optional
  "tag": "v0.53.2",                            // Optional
  "enabled": true,                             // Optional: boolean
  "path": "$HOME/.chain/data/wasm"            // Optional: wasm data directory
}
```

**Path Pattern:** Must start with `$HOME` (e.g., `$HOME/.juno/data/wasm`)

**Examples:**
```json
// CosmWasm enabled
"cosmwasm": {
  "version": "v0.53.2",
  "repo": "https://github.com/CosmWasm/wasmd",
  "tag": "v0.53.2",
  "enabled": true
}

// With custom path
"cosmwasm": {
  "version": "0.45.0",
  "enabled": true,
  "path": "$HOME/.juno/data/wasm"
}

// Disabled
"cosmwasm": {
  "enabled": false
}
```

---

### 13. `language` - Programming Language

**Type:** `object`

**Required:** `type`

```json
"language": {
  "type": "go",                                // Required: "go", "rust", "solidity", "other"
  "version": "1.22.11",                        // Optional
  "repo": "https://github.com/golang/go",      // Optional
  "tag": "go1.22.11"                           // Optional
}
```

**Examples:**
```json
// Go language
"language": {
  "type": "go",
  "version": "1.22.11"
}

// Rust language
"language": {
  "type": "rust",
  "version": "1.70"
}
```

---

### 14. `binaries` - Downloadable Binaries

**Type:** `object`

**No required fields** (but must have at least 1 platform)

```json
"binaries": {
  "linux/amd64": "https://github.com/cosmos/gaia/releases/download/v16.0.0/gaiad-v16.0.0-linux-amd64",
  "linux/arm64": "https://github.com/cosmos/gaia/releases/download/v16.0.0/gaiad-v16.0.0-linux-arm64",
  "darwin/amd64": "https://github.com/cosmos/gaia/releases/download/v16.0.0/gaiad-v16.0.0-darwin-amd64",
  "darwin/arm64": "https://github.com/cosmos/gaia/releases/download/v16.0.0/gaiad-v16.0.0-darwin-arm64",
  "windows/amd64": "https://github.com/cosmos/gaia/releases/download/v16.0.0/gaiad-v16.0.0-windows-amd64.exe",
  "windows/arm64": "https://github.com/cosmos/gaia/releases/download/v16.0.0/gaiad-v16.0.0-windows-arm64.exe"
}
```

**Valid Platforms:**
- `linux/amd64` ← Most common
- `linux/arm64`
- `darwin/amd64` (macOS Intel)
- `darwin/arm64` (macOS Apple Silicon)
- `windows/amd64`
- `windows/arm64`

**With Checksums:**
```json
"binaries": {
  "linux/amd64": "https://github.com/osmosis-labs/osmosis/releases/download/v29.0.0/osmosisd-29.0.0-linux-amd64?checksum=6999331507e5119228456a64f733eb1d945f5392ffcfd4673bdad25886b19a7e",
  "linux/arm64": "https://github.com/osmosis-labs/osmosis/releases/download/v29.0.0/osmosisd-29.0.0-linux-arm64?checksum=079d836d1bf009aab09149eb79d3c187980c5116b8319e09c66a8cae7fa0704c"
}
```

**Best Practices:**
- Always include checksums for security
- Use `sha256` checksums
- Provide at least `linux/amd64`
- Include ARM builds when available

---

## 📚 Complete Example

### Minimal Version Entry

```json
{
  "name": "v16"
}
```

### Typical Version Entry

```json
{
  "name": "v16",
  "tag": "v16.0.0",
  "height": 20440500,
  "proposal": 914,
  "recommended_version": "v16.0.0",
  "compatible_versions": ["v16.0.0"],
  "previous_version_name": "v15",
  "next_version_name": "v17",
  "consensus": {
    "type": "cometbft",
    "version": "v0.37.5"
  },
  "sdk": {
    "type": "cosmos",
    "version": "v0.47.13",
    "tag": "v0.47.13-ics-lsm"
  },
  "ibc": {
    "type": "go",
    "version": "v7.4.0"
  },
  "binaries": {
    "linux/amd64": "https://github.com/cosmos/gaia/releases/download/v16.0.0/gaiad-v16.0.0-linux-amd64",
    "linux/arm64": "https://github.com/cosmos/gaia/releases/download/v16.0.0/gaiad-v16.0.0-linux-arm64"
  }
}
```

### Complete Version Entry (All Fields)

```json
{
  "name": "v18",
  "tag": "v18.1.0",
  "height": 21330500,
  "proposal": 937,
  "recommended_version": "v18.1.0",
  "compatible_versions": ["v18.1.0"],
  "previous_version_name": "v17",
  "next_version_name": "v19",
  "consensus": {
    "type": "cometbft",
    "version": "v0.37.6",
    "repo": "https://github.com/cometbft/cometbft",
    "tag": "v0.37.6"
  },
  "sdk": {
    "type": "cosmos",
    "version": "v0.47.16",
    "repo": "https://github.com/cosmos/cosmos-sdk",
    "tag": "v0.47.16-ics-lsm"
  },
  "cosmwasm": {
    "version": "v0.45.0",
    "repo": "https://github.com/informalsystems/wasmd",
    "tag": "v0.45.0-lsm",
    "enabled": true
  },
  "ibc": {
    "type": "go",
    "version": "v7.6.0",
    "repo": "https://github.com/cosmos/ibc-go",
    "tag": "v7.6.0",
    "ics_enabled": ["ics20-1"]
  },
  "language": {
    "type": "go",
    "version": "1.22.4"
  },
  "binaries": {
    "linux/amd64": "https://github.com/cosmos/gaia/releases/download/v18.1.0/gaiad-v18.1.0-linux-amd64",
    "linux/arm64": "https://github.com/cosmos/gaia/releases/download/v18.1.0/gaiad-v18.1.0-linux-arm64",
    "darwin/amd64": "https://github.com/cosmos/gaia/releases/download/v18.1.0/gaiad-v18.1.0-darwin-amd64",
    "darwin/arm64": "https://github.com/cosmos/gaia/releases/download/v18.1.0/gaiad-v18.1.0-darwin-arm64"
  }
}
```

---

## 🎯 Review Checklist for versions.json PRs

### Basic Validation
- [ ] `$schema` points to `../versions.schema.json`
- [ ] `chain_name` matches directory name
- [ ] `chain_name` is lowercase alphanumeric only
- [ ] Each version has required `name` field
- [ ] JSON is valid and properly formatted

### Version Entry Validation
- [ ] `name` matches official upgrade name
- [ ] `tag` matches GitHub release tag
- [ ] `height` matches governance proposal
- [ ] `proposal` number is correct (if applicable)
- [ ] `recommended_version` is latest patch version
- [ ] `compatible_versions` includes all working versions
- [ ] Version chain is correct (`previous_version_name` → `next_version_name`)

### Component Validation
- [ ] `sdk.type` is one of: `cosmos`, `penumbra`, `other`
- [ ] `consensus.type` is one of: `cometbft`, `tendermint`, `sei-tendermint`, `cometbls`
- [ ] `ibc.type` is one of: `go`, `rust`, `other`
- [ ] `language.type` is one of: `go`, `rust`, `solidity`, `other`
- [ ] Version strings follow patterns: `v1.0.0` or `1.0.0`
- [ ] Binary URLs are accessible (test 1-2 platforms)
- [ ] Checksums included in binary URLs (if available)

### Cross-Reference Validation
- [ ] If updating existing version, compare with `chain.json` `codebase` section
- [ ] Verify GitHub release exists for `tag`
- [ ] Check governance proposal details match (if mainnet)
- [ ] Confirm upgrade height from blockchain explorer

---

## 🚨 Common Mistakes

### 1. Wrong Schema Path
```json
❌ "$schema": "versions.schema.json"
✅ "$schema": "../versions.schema.json"
```

### 2. Chain Name Doesn't Match Directory
```
Directory: cosmoshub/
❌ "chain_name": "cosmos-hub"
❌ "chain_name": "CosmosHub"
✅ "chain_name": "cosmoshub"
```

### 3. Invalid Version Format
```json
❌ "version": "v0.47.5-custom-build-123"  // Too complex for version field
✅ "version": "v0.47.5"                    // Use version field
✅ "tag": "v0.47.5-custom-build-123"      // Use tag for complex versions
```

### 4. Missing Required Type
```json
❌ "sdk": {
  "version": "v0.50.11"
  // Missing type!
}

✅ "sdk": {
  "type": "cosmos",
  "version": "v0.50.11"
}
```

### 5. Broken Version Chain
```json
// Version v15
"next_version_name": "v17"   // ❌ Skips v16

// Version v16
"previous_version_name": "v14"   // ❌ Doesn't match v15
```

### 6. Incorrect Platform Format
```json
❌ "binaries": {
  "linux-amd64": "...",      // Wrong separator
  "linux_amd64": "...",      // Wrong separator
}

✅ "binaries": {
  "linux/amd64": "...",      // Correct: slash separator
}
```

### 7. CosmWasm Path Format
```json
❌ "path": "~/.chain/data/wasm"           // Must use $HOME
❌ "path": "/home/user/.chain/data/wasm"  // Must use $HOME

✅ "path": "$HOME/.chain/data/wasm"
```

---

**Last Updated:** 2025-11-5
