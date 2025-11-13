# IBC Connection Guide for Contributors

## Overview

This guide explains how to add or update IBC (Inter-Blockchain Communication) connections in the Cosmos Chain Registry. IBC connections enable token transfers and other cross-chain interactions between Cosmos chains.

### When to Use This Guide
- Adding a new IBC channel between two chains
- Updating existing IBC connection information (see [Section 8: Replacing Channel IDs When Liquidity Exists](#8--replacing-channel-ids-when-liquidity-exists))
- Adding multi-hop IBC routes

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [File Structure and Naming](#file-structure-and-naming)
3. [Required Fields](#required-fields)
4. [How to Find IBC Information](#how-to-find-ibc-information)
5. [Step-by-Step: Adding a New IBC Connection](#step-by-step-adding-a-new-ibc-connection)
6. [Channel Types and Patterns](#channel-types-and-patterns)
7. [Validation Checklist](#validation-checklist)
8. [Common Mistakes](#common-mistakes)
9. [Examples](#examples)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Minimum Requirements

To add an IBC connection, you need:
1. **Channel IDs** - One for each chain
2. **Connection IDs** - One for each chain
3. **Client IDs** - One for each chain
4. **Chain IDs** - The chain identifier for each chain
5. **Proof** - On-chain evidence that the channel exists

### Basic File Structure

```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "cosmoshub",
    "client_id": "07-tendermint-259",
    "connection_id": "connection-257",
    "chain_id": "cosmoshub-4"
  },
  "chain_2": {
    "chain_name": "osmosis",
    "client_id": "07-tendermint-1",
    "connection_id": "connection-1",
    "chain_id": "osmosis-1"
  },
  "channels": [
    {
      "chain_1": {
        "channel_id": "channel-141",
        "port_id": "transfer"
      },
      "chain_2": {
        "channel_id": "channel-0",
        "port_id": "transfer"
      },
      "ordering": "unordered",
      "version": "ics20-1",
      "tags": {
        "status": "ACTIVE",
        "preferred": true
      }
    }
  ]
}
```

---

## File Structure and Naming

### File Location

**Mainnet connections:**
```
_IBC/{chain1}-{chain2}.json
```

**Testnet connections:**
```
testnets/_IBC/{chain1}-{chain2}.json
```

### Naming Rules

#### 1. Alphabetical Order (CRITICAL)

Chain names **MUST** be in alphabetical order:

✅ **Correct:**
```
_IBC/cosmoshub-osmosis.json
_IBC/axelar-noble.json
_IBC/juno-neutron.json
```

❌ **Wrong:**
```
_IBC/osmosis-cosmoshub.json  ❌ (reversed)
_IBC/noble-axelar.json       ❌ (reversed)
```

**How to check:**
```bash
# Chain 1 should come before Chain 2 alphabetically
echo "cosmoshub" | sort -c  # a comes before o
```

#### 2. Match Directory Names

Chain names in the filename must match the actual directory names:

✅ **Correct:**
```
_IBC/cosmoshub-osmosis.json
# When directories are:
/cosmoshub/
/osmosis/
```

❌ **Wrong:**
```
_IBC/cosmos-osmosis.json  ❌ (directory is "cosmoshub" not "cosmos")
```

#### 3. Lowercase Only

All filenames must be lowercase with hyphens:

✅ **Correct:**
```
_IBC/cosmoshub-osmosis.json
_IBC/terra2-osmosis.json
```

❌ **Wrong:**
```
_IBC/CosmosHub-Osmosis.json  ❌ (uppercase)
_IBC/terra_2-osmosis.json    ❌ (underscore)
```

---

### Schema Reference

**For mainnet IBC files:**
```json
{
  "$schema": "../ibc_data.schema.json"
}
```

**For testnet IBC files:**
```json
{
  "$schema": "../../ibc_data.schema.json"
}
```

**Note:** Testnet has extra `../` because it's nested in `/testnets/_IBC/`

---

## Required Fields

### Top-Level Structure

```json
{
  "$schema": "../ibc_data.schema.json",   // REQUIRED
  "chain_1": { ... },                      // REQUIRED
  "chain_2": { ... },                      // REQUIRED
  "channels": [ ... ]                      // REQUIRED (min 1 channel)
}
```

---

### Chain Properties

Each `chain_1` and `chain_2` object requires:

```json
{
  "chain_name": "cosmoshub",        // REQUIRED - Must match directory name
  "client_id": "07-tendermint-259", // REQUIRED - IBC client identifier
  "connection_id": "connection-257", // REQUIRED - IBC connection identifier
  "chain_id": "cosmoshub-4"         // REQUIRED
}
```

---

### Channel Properties

Each channel in the `channels` array requires:

```json
{
  "chain_1": {
    "channel_id": "channel-141",  // REQUIRED - Channel on chain_1
    "port_id": "transfer"         // REQUIRED - Usually "transfer"
  },
  "chain_2": {
    "channel_id": "channel-0",    // REQUIRED - Channel on chain_2
    "port_id": "transfer"         // REQUIRED - Usually "transfer"
  },
  "ordering": "unordered",        // REQUIRED - Usually "unordered"
  "version": "ics20-1",           // REQUIRED - IBC version
  "tags": {                       // OPTIONAL but recommended
    "status": "ACTIVE",           // "ACTIVE", "PENDING", "INACTIVE", or "CLOSED"
    "preferred": true             // If this is the main channel
  }
}
```

---

## How to Find IBC Information

### Method 1: Using Mintscan (Easiest)

**Step 1:** Go to Mintscan for one of the chains
```
https://www.mintscan.io/{chain}/relayers
```

**Example:** For Cosmos Hub ↔ Osmosis:
```
https://www.mintscan.io/cosmos/relayers
```

**Step 2:** Find the connection to the other chain

You'll see a list showing:
- Counterparty chain
- Channel ID
- Status

**Step 3:** Click on the channel for full details

This shows:
- Channel ID on both chains
- Connection ID on both chains
- Client ID on both chains
- Port IDs
- Status

---

### Method 2: Using REST API

#### Query Channel Information

**Endpoint:**
```
{rest_api}/ibc/core/channel/v1/channels/{channel_id}/ports/{port_id}
```

**Example:**
```bash
curl "https://cosmos-rest.publicnode.com/ibc/core/channel/v1/channels/channel-141/ports/transfer"
```

**Response:**
```json
{
  "channel": {
    "state": "STATE_OPEN",
    "ordering": "ORDER_UNORDERED",
    "counterparty": {
      "port_id": "transfer",
      "channel_id": "channel-0"  // ← Counterparty channel!
    },
    "connection_hops": [
      "connection-257"  // ← Connection ID!
    ],
    "version": "ics20-1"
  }
}
```

#### Query Connection Information

**Endpoint:**
```
{rest_api}/ibc/core/connection/v1/connections/{connection_id}
```

**Example:**
```bash
curl "https://cosmos-rest.publicnode.com/ibc/core/connection/v1/connections/connection-257"
```

**Response:**
```json
{
  "connection": {
    "client_id": "07-tendermint-259",  // ← Client ID!
    "state": "STATE_OPEN",
    "counterparty": {
      "client_id": "07-tendermint-1",       // ← Counterparty client!
      "connection_id": "connection-1",      // ← Counterparty connection!
      "prefix": {
        "key_prefix": "aWJj"
      }
    }
  }
}
```

---

### Method 3: Using Block Explorer

Many block explorers show IBC information:

**Popular explorers:**
- Mintscan: https://www.mintscan.io/
- Ping.pub: https://ping.pub/
- ATOMScan: https://atomscan.com/

**Steps:**
1. Navigate to the "IBC" or "Relayers" section
2. Find the connection to your target chain
3. Click for full details

---

### Method 4: Using Hermes CLI (Advanced)

If you're running a relayer:

```bash
# Query channels
hermes query channels --chain {chain_id}

# Query channel details
hermes query channel end --chain {chain_id} --port transfer --channel {channel_id}

# Query connection
hermes query connection end --chain {chain_id} --connection {connection_id}
```

---

## Step-by-Step: Adding a New IBC Connection

### Example: Adding Cosmos Hub ↔ Neutron Connection

**Step 1: Gather Information**

Query Cosmos Hub's channel to Neutron:
```bash
curl "https://cosmos-rest.publicnode.com/ibc/core/channel/v1/channels/channel-569/ports/transfer"
```

Result:
- Cosmos Hub channel: `channel-569`
- Neutron channel: `channel-1` (from counterparty)
- Connection: `connection-809` (from connection_hops)

Query the connection:
```bash
curl "https://cosmos-rest.publicnode.com/ibc/core/connection/v1/connections/connection-809"
```

Result:
- Cosmos Hub client: `07-tendermint-1116`
- Neutron client: `07-tendermint-0`
- Neutron connection: `connection-0`

---

**Step 2: Create the File**

Filename (alphabetical): `cosmoshub-neutron.json`

Location: `_IBC/cosmoshub-neutron.json`

---

**Step 3: Fill in the Template**

```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "cosmoshub",
    "client_id": "07-tendermint-1116",
    "connection_id": "connection-809",
    "chain_id": "cosmoshub-4"
  },
  "chain_2": {
    "chain_name": "neutron",
    "client_id": "07-tendermint-0",
    "connection_id": "connection-0",
    "chain_id": "neutron-1"
  },
  "channels": [
    {
      "chain_1": {
        "channel_id": "channel-569",
        "port_id": "transfer"
      },
      "chain_2": {
        "channel_id": "channel-1",
        "port_id": "transfer"
      },
      "ordering": "unordered",
      "version": "ics20-1",
      "tags": {
        "status": "ACTIVE",
        "preferred": true
      }
    }
  ]
}
```

---

**Step 4: Verify Chain IDs**

Check that chain IDs match the chains' `chain.json` files:

```bash
# Check Cosmos Hub
cat cosmoshub/chain.json | jq '.chain_id'
# Should output: "cosmoshub-4"

# Check Neutron
cat neutron/chain.json | jq '.chain_id'
# Should output: "neutron-1"
```

---

**Step 5: Validate Locally (Optional but Recommended)**

```bash
# Install validator
npm install -g @chain-registry/cli

# Run validation
chain-registry validate --registryDir . --logLevel error
```

---

**Step 6: Provide Proof in PR Description**

When submitting your PR, include proof that the channel exists:

**Example PR description:**
```markdown
## Adding IBC connection: Cosmos Hub ↔ Neutron

### Channel Details
- Cosmos Hub: channel-569
- Neutron: channel-1
- Status: Live

### Proof
Mintscan: https://www.mintscan.io/cosmos/relayers/channel-569

Or REST query:
```bash
curl "https://cosmos-rest.publicnode.com/ibc/core/channel/v1/channels/channel-569/ports/transfer"
```

Returns STATE_OPEN with counterparty channel-1

---

## Channel Types and Patterns

This section covers the different types of IBC channels you may encounter and their configuration patterns. Each channel type serves a specific purpose and has unique requirements for port IDs, versions, and ordering.

**Common Channel Types:**
- **ICS20** - Fungible token transfers (most common)
- **ICS721** - NFT transfers
- **ICS27** - Interchain Accounts (ICA)
- **CW20-ICS20** - CosmWasm CW20 tokens over IBC

---

### 1. Standard ICS20 Token Transfer

**Most common type** - Used for fungible token transfers

```json
{
  "chain_1": {
    "channel_id": "channel-141",
    "port_id": "transfer"
  },
  "chain_2": {
    "channel_id": "channel-0",
    "port_id": "transfer"
  },
  "ordering": "unordered",
  "version": "ics20-1",
  "tags": {
    "status": "ACTIVE",
    "preferred": true
  }
}
```

**Key characteristics:**
- Port: `transfer`
- Version: `ics20-1`
- Ordering: `unordered`

---

### 2. ICS721 NFT Transfer

**For NFT transfers** between chains

```json
{
  "chain_1": {
    "channel_id": "channel-207",
    "port_id": "transfer"
  },
  "chain_2": {
    "channel_id": "channel-75",
    "port_id": "transfer"
  },
  "ordering": "unordered",
  "version": "ics721-1",
  "tags": {
    "status": "ACTIVE",
    "preferred": true
  }
}
```

**Key difference:**
- Version: `ics721-1` (instead of `ics20-1`)

---

### 3. IBC-Enabled CW20 (Interchain Token Transfer)

**For CosmWasm CW20 tokens** over IBC

```json
{
  "chain_1": {
    "channel_id": "channel-169",
    "port_id": "transfer"
  },
  "chain_2": {
    "channel_id": "channel-42",
    "port_id": "wasm.juno1v4887y83d6g28puzvt8cl0f3cdhd3y6y9mpysnsp3k8krdm7l6jqgm0rkn"
  },
  "ordering": "unordered",
  "version": "ics20-1",
  "tags": {
    "status": "ACTIVE"
  }
}
```

**Key differences:**
- Port on one side: `wasm.{contract_address}`
- Still uses version `ics20-1`

---

### 4. Interchain Accounts (ICA)

**For account control** across chains

```json
{
  "chain_1": {
    "channel_id": "channel-411",
    "port_id": "icacontroller-1"
  },
  "chain_2": {
    "channel_id": "channel-326",
    "port_id": "icahost"
  },
  "ordering": "ordered",
  "version": "ics27-1",
  "tags": {
    "status": "ACTIVE",
    "preferred": true
  }
}
```

**Key differences:**
- Ports: `icacontroller-{n}` and `icahost`
- Ordering: `ordered` (not unordered!)
- Version: `ics27-1`

---

### 5. Multiple Channels Between Same Chains

**Chains can have multiple IBC channels** - e.g., legacy + new, or different purposes

```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "cosmoshub",
    "client_id": "07-tendermint-259",
    "connection_id": "connection-257",
    "chain_id": "cosmoshub-4"
  },
  "chain_2": {
    "chain_name": "osmosis",
    "client_id": "07-tendermint-1",
    "connection_id": "connection-1",
    "chain_id": "osmosis-1"
  },
  "channels": [
    {
      "chain_1": {
        "channel_id": "channel-141",
        "port_id": "transfer"
      },
      "chain_2": {
        "channel_id": "channel-0",
        "port_id": "transfer"
      },
      "ordering": "unordered",
      "version": "ics20-1",
      "tags": {
        "status": "ACTIVE",
        "preferred": true  // ← Main channel
      }
    },
    {
      "chain_1": {
        "channel_id": "channel-411",
        "port_id": "icacontroller-1"
      },
      "chain_2": {
        "channel_id": "channel-326",
        "port_id": "icahost"
      },
      "ordering": "ordered",
      "version": "ics27-1",
      "tags": {
        "status": "ACTIVE",
        "preferred": true  // ← ICA channel (different port pair from transfer)
      }
    }
  ]
}
```

**Important:**
- Only **ONE channel per PORT PAIR** can have `"preferred": true`
- Multiple channels with `"preferred": true` are allowed if they use different port pairs
- Example: `transfer/transfer` channel can be preferred AND `icacontroller-*/icahost` channel can also be preferred
- The validation only applies to channels with the SAME port pair

---

## Validation Checklist

Before submitting your PR, verify:

### File Structure
- [ ] Filename follows pattern: `{chain1}-{chain2}.json`
- [ ] Chain names are in **alphabetical order**
- [ ] Chain names match directory names exactly
- [ ] File is in correct location (`_IBC/` or `testnets/_IBC/`)
- [ ] `$schema` path is correct

### Chain Data
- [ ] Both `chain_1` and `chain_2` are defined
- [ ] All required fields present: `chain_name`, `client_id`, `connection_id`, `chain_id`
- [ ] `chain_id` values match the chains' `chain.json` files
- [ ] Chain names match actual directory names

### Channel Data
- [ ] At least one channel defined in `channels` array
- [ ] All required fields present: `channel_id`, `port_id` (both chains)
- [ ] `ordering` is either `"ordered"` or `"unordered"`
- [ ] `version` is appropriate (usually `"ics20-1"`)
- [ ] If multiple channels: only one has `"preferred": true`

### On-Chain Verification
- [ ] Channel exists on both chains (query via REST API)
- [ ] Channel state is `STATE_OPEN`
- [ ] Counterparty information matches
- [ ] Connection exists and matches channel
- [ ] Client IDs match connection data

### Proof
- [ ] PR description includes proof (Mintscan link or REST query)
- [ ] Proof shows channel is ACTIVE
- [ ] Counterparty details are visible

---

## Common Mistakes

### 1. ❌ Wrong Alphabetical Order

**Wrong:**
```json
// File: osmosis-cosmoshub.json
{
  "chain_1": {
    "chain_name": "osmosis"
  },
  "chain_2": {
    "chain_name": "cosmoshub"
  }
}
```

**Correct:**
```json
// File: cosmoshub-osmosis.json
{
  "chain_1": {
    "chain_name": "cosmoshub"  // 'c' comes before 'o'
  },
  "chain_2": {
    "chain_name": "osmosis"
  }
}
```

---

### 2. ❌ Mismatched Channel IDs

**Wrong:**
```json
{
  "chain_1": {
    "channel_id": "channel-141"
  },
  "chain_2": {
    "channel_id": "channel-999"  // ❌ Doesn't exist or wrong channel
  }
}
```

**How to avoid:**
- Always query BOTH chains to verify channel IDs
- Check that each channel's counterparty matches

---

### 3. ❌ Wrong Schema Path

**Wrong (mainnet file):**
```json
{
  "$schema": "../../ibc_data.schema.json"  // ❌ Too many ../
}
```

**Correct:**
```json
{
  "$schema": "../ibc_data.schema.json"  // ✅ One level up
}
```

**Wrong (testnet file):**
```json
{
  "$schema": "../ibc_data.schema.json"  // ❌ Not enough ../
}
```

**Correct:**
```json
{
  "$schema": "../../ibc_data.schema.json"  // ✅ Two levels up
}
```

---

### 4. ❌ Missing chain_id Field

**Wrong:**
```json
{
  "chain_1": {
    "chain_name": "cosmoshub",
    "client_id": "07-tendermint-259",
    "connection_id": "connection-257"
    // ❌ Missing chain_id!
  }
}
```

**Correct:**
```json
{
  "chain_1": {
    "chain_name": "cosmoshub",
    "client_id": "07-tendermint-259",
    "connection_id": "connection-257",
    "chain_id": "cosmoshub-4"  // ✅ Required
  }
}
```

---

### 5. ❌ Wrong Port ID for CW20

**Wrong:**
```json
{
  "chain_2": {
    "channel_id": "channel-42",
    "port_id": "transfer"  // ❌ Should be wasm port for CW20
  }
}
```

**Correct:**
```json
{
  "chain_2": {
    "channel_id": "channel-42",
    "port_id": "wasm.juno1v4887y83d6g28puzvt8cl0f3cdhd3y6y9mpysnsp3k8krdm7l6jqgm0rkn"
  }
}
```

---

### 6. ❌ Multiple "preferred" Channels for Same Port Pair

**Wrong:** Two transfer/transfer channels both with `preferred: true`
```json
{
  "channels": [
    {
      "chain_1": { "channel_id": "channel-141", "port_id": "transfer" },
      "chain_2": { "channel_id": "channel-0", "port_id": "transfer" },
      "tags": { "preferred": true }  // ❌ Can't have two preferred transfer channels!
    },
    {
      "chain_1": { "channel_id": "channel-186", "port_id": "transfer" },
      "chain_2": { "channel_id": "channel-12", "port_id": "transfer" },
      "tags": { "preferred": true }  // ❌ Only ONE transfer/transfer can be preferred
    }
  ]
}
```

**Correct:** Only ONE transfer/transfer channel has `preferred: true`, but ICA channel can also be preferred
```json
{
  "channels": [
    {
      "chain_1": { "channel_id": "channel-141", "port_id": "transfer" },
      "chain_2": { "channel_id": "channel-0", "port_id": "transfer" },
      "tags": { "preferred": true }  // ✅ Preferred transfer channel
    },
    {
      "chain_1": { "channel_id": "channel-411", "port_id": "icacontroller-1" },
      "chain_2": { "channel_id": "channel-326", "port_id": "icahost" },
      "tags": { "preferred": true }  // ✅ ICA channel (different port pair from transfer)
    }
  ]
}
```

---

### 7. ❌ Wrong Ordering for ICA

**Wrong:**
```json
{
  "chain_1": { "port_id": "icacontroller-1" },
  "chain_2": { "port_id": "icahost" },
  "ordering": "unordered",  // ❌ ICA must be ordered!
  "version": "ics27-1"
}
```

**Correct:**
```json
{
  "chain_1": { "port_id": "icacontroller-1" },
  "chain_2": { "port_id": "icahost" },
  "ordering": "ordered",  // ✅ ICA requires ordered
  "version": "ics27-1"
}
```

---

### 8. ❌ Replacing Channel IDs When Liquidity Exists

**CRITICAL RULE:** Once a channel has established liquidity (tokens in pools, user balances), you **CANNOT** replace or change the channel IDs without governance approval from both chains.

**Why?** Changing channel IDs creates a different IBC denom hash, breaking:
- Existing liquidity pools
- User balances
- Integration endpoints
- DEX configurations

#### ❌ Wrong: Directly Replacing Channel IDs

```json
// PR trying to "update" arkeo-osmosis.json
{
  "chain_1": {
    "chain_name": "arkeo",
    "client_id": "07-tendermint-12",      // ❌ Changed from 07-tendermint-1
    "connection_id": "connection-13",      // ❌ Changed from connection-2
    "channel_id": "channel-9"              // ❌ Changed from channel-1
  },
  "chain_2": {
    "chain_name": "osmosis",
    "client_id": "07-tendermint-3604",     // ❌ Changed from 07-tendermint-3489
    "connection_id": "connection-10951",   // ❌ Changed from connection-10730
    "channel_id": "channel-107016"         // ❌ Changed from channel-103074
  }
}
```

**Result:** PR will be **REJECTED** - existing ARKEO liquidity on Osmosis would be broken.

#### ✅ Correct: Recover Expired Client via Governance

**When clients expire, use governance to recover them while keeping same channel IDs:**

1. Submit governance proposal on Chain A using `MsgRecoverClient`
2. Submit governance proposal on Chain B using `MsgRecoverClient`
3. **Keep the same channel IDs** - only client/connection IDs may change if recovered
4. Example: [Osmosis Proposal #973](https://www.mintscan.io/osmosis/proposals/973)

#### When Channel Replacement IS Allowed:

- ✅ **New channels** (no existing liquidity)
  - Channel is relatively new (less than 1 week old)
  - Channel was never used for transfers
- ✅ **Both chains' governance explicitly approves** the replacement
- ✅ **Can prove no counterparty liquidity**
  - The submitter can prove that the total value of assets remaining on counterparty chains (having been transferred via the old channels) is very low
  - Threshold: "testing amount" (~$100 USD or less)
  - Must provide evidence (block explorer links, queries, etc.)

#### When Channel Replacement is NOT Allowed:

- ❌ Channels with established liquidity
- ❌ Channels actively used in DEXs
- ❌ Channels with user balances
- ❌ Without governance approval from both chains

#### ⚠️ Important: If Assets Are Already Registered

**If the old channel already has assets registered in the chain-registry:**
- ❌ **DO NOT** replace/delete the channel
- ✅ **DO** deprecate it:
  - Set old channel to `"preferred": false`
  - Set old channel to `"status": "INACTIVE"`
  - Add new channel with `"preferred": true`
  - Keep BOTH channels in the registry

**Why?**
- Applications may still reference the old IBC hashes
- Users may still hold assets from the old channel
- Breaking these references causes user issues

---

### 9. Multiple Transfer Channels Between Same Chain Pair

**GENERAL RULE:** Each chain pair should have only ONE **preferred** transfer/transfer channel.

**Exception:** In rare cases, additional transfer/transfer channels may be allowed if there is a strong technical justification (e.g., smart contract upgrades with immutable constraints).

If multiple transfer/transfer channels exist between a chain pair, then:
- Only ONE can have `"preferred": true`
- Others must have `"preferred": false` and should typically be `"status": "INACTIVE"`

#### Requirements for Multiple Transfer Channels:

1. **Provide detailed technical justification** in your PR description
2. **Expect reviewer scrutiny** - this is an exceptional case that requires approval
3. **Use `"preferred"` tag** to mark which channel is canonical:

```json
{
  "channels": [
    {
      "chain_1": { "channel_id": "channel-186", "port_id": "transfer" },
      "chain_2": { "channel_id": "channel-12", "port_id": "transfer" },
      "ordering": "unordered",
      "version": "ics20-1",
      "tags": {
        "preferred": false,  // Legacy channel
        "status": "ACTIVE"
      }
    },
    {
      "chain_1": { "channel_id": "channel-1549", "port_id": "transfer" },
      "chain_2": { "channel_id": "channel-97", "port_id": "transfer" },
      "ordering": "unordered",
      "version": "ics20-1",
      "tags": {
        "preferred": true,   // Canonical channel
        "status": "ACTIVE"
      }
    }
  ]
}
```

**Important:** Only ONE channel can have `"preferred": true"`. This tells applications which channel to use by default.

---

## Examples

### Example 1: Simple ICS20 Transfer

**Cosmos Hub ↔ Osmosis**

```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "cosmoshub",
    "client_id": "07-tendermint-259",
    "connection_id": "connection-257",
    "chain_id": "cosmoshub-4"
  },
  "chain_2": {
    "chain_name": "osmosis",
    "client_id": "07-tendermint-1",
    "connection_id": "connection-1",
    "chain_id": "osmosis-1"
  },
  "channels": [
    {
      "chain_1": {
        "channel_id": "channel-141",
        "port_id": "transfer"
      },
      "chain_2": {
        "channel_id": "channel-0",
        "port_id": "transfer"
      },
      "ordering": "unordered",
      "version": "ics20-1",
      "tags": {
        "status": "ACTIVE",
        "preferred": true
      }
    }
  ]
}
```

---

### Example 2: Testnet Connection

**Cosmos Hub Testnet ↔ Osmosis Testnet**

```json
{
  "$schema": "../../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "cosmoshubtestnet",
    "client_id": "07-tendermint-2",
    "connection_id": "connection-2",
    "chain_id": "theta-testnet-001"
  },
  "chain_2": {
    "chain_name": "osmosistestnet",
    "client_id": "07-tendermint-1",
    "connection_id": "connection-1",
    "chain_id": "osmo-test-5"
  },
  "channels": [
    {
      "chain_1": {
        "channel_id": "channel-3",
        "port_id": "transfer"
      },
      "chain_2": {
        "channel_id": "channel-2",
        "port_id": "transfer"
      },
      "ordering": "unordered",
      "version": "ics20-1",
      "tags": {
        "status": "ACTIVE",
        "preferred": true
      }
    }
  ]
}
```

**Note:** Schema path has `../../` (two levels up from `testnets/_IBC/`)

---

### Example 3: CW20 over IBC

**Juno ↔ Osmosis (with CW20 port)**

```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "juno",
    "client_id": "07-tendermint-0",
    "connection_id": "connection-0",
    "chain_id": "juno-1"
  },
  "chain_2": {
    "chain_name": "osmosis",
    "client_id": "07-tendermint-1457",
    "connection_id": "connection-1142",
    "chain_id": "osmosis-1"
  },
  "channels": [
    {
      "chain_1": {
        "channel_id": "channel-42",
        "port_id": "wasm.juno1v4887y83d6g28puzvt8cl0f3cdhd3y6y9mpysnsp3k8krdm7l6jqgm0rkn"
      },
      "chain_2": {
        "channel_id": "channel-169",
        "port_id": "transfer"
      },
      "ordering": "unordered",
      "version": "ics20-1",
      "tags": {
        "status": "ACTIVE"
      }
    }
  ]
}
```

**Note:** Port on Juno side is `wasm.{contract_address}`

---

### Example 4: Multiple Channels

**Cosmos Hub ↔ Osmosis (Transfer + ICA)**

```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "cosmoshub",
    "client_id": "07-tendermint-259",
    "connection_id": "connection-257",
    "chain_id": "cosmoshub-4"
  },
  "chain_2": {
    "chain_name": "osmosis",
    "client_id": "07-tendermint-1",
    "connection_id": "connection-1",
    "chain_id": "osmosis-1"
  },
  "channels": [
    {
      "chain_1": {
        "channel_id": "channel-141",
        "port_id": "transfer"
      },
      "chain_2": {
        "channel_id": "channel-0",
        "port_id": "transfer"
      },
      "ordering": "unordered",
      "version": "ics20-1",
      "tags": {
        "status": "ACTIVE",
        "preferred": true
      }
    },
    {
      "chain_1": {
        "channel_id": "channel-411",
        "port_id": "icacontroller-cosmoshub1"
      },
      "chain_2": {
        "channel_id": "channel-326",
        "port_id": "icahost"
      },
      "ordering": "ordered",
      "version": "ics27-1",
      "tags": {
        "status": "ACTIVE",
        "preferred": true  // ICA channel (different port pair)
      }
    }
  ]
}
```

---

## Troubleshooting

### CI Validation Fails

**Error: "Chain names must be in alphabetical order"**

**Solution:** Rename your file so chain names are alphabetical:
```bash
# Wrong
osmosis-cosmoshub.json

# Correct
cosmoshub-osmosis.json
```

---

**Error: "chain_id field is required"**

**Solution:** Add `chain_id` to both chain objects:
```json
{
  "chain_1": {
    "chain_name": "cosmoshub",
    "client_id": "...",
    "connection_id": "...",
    "chain_id": "cosmoshub-4"  // ← Add this
  }
}
```

Find the correct `chain_id` in the chain's `chain.json` file.

---

**Error: "Channel validation failed"**

**Solution:** Verify the channel exists on-chain:
```bash
curl "{rest_api}/ibc/core/channel/v1/channels/{channel_id}/ports/transfer"
```

Make sure:
- Channel state is `STATE_OPEN`
- Counterparty channel ID matches
- Port IDs are correct

---

### Channel Query Returns 404

**Problem:** REST API returns 404 when querying channel

**Possible causes:**
1. Channel doesn't exist (wrong channel ID)
2. REST endpoint is down or incorrect
3. Using wrong port (try `transfer` if unsure)

**Solution:**
```bash
# Try different REST endpoints from chain.json
curl "{alternative_rest_api}/ibc/core/channel/v1/channels/{channel_id}/ports/transfer"

# Check Mintscan instead
https://www.mintscan.io/{chain}/relayers/channel-{id}
```

---

### Can't Find Channel ID

**Problem:** Don't know the channel ID for your connection

**Solution:**

**Method 1 - Mintscan:**
1. Go to https://www.mintscan.io/{chain}/relayers
2. Find your target chain in the list
3. Click to see channel details

**Method 2 - List all channels:**
```bash
curl "{rest_api}/ibc/core/channel/v1/channels"
```

This returns ALL channels on the chain. Look for the one connecting to your target chain.

---

### Channel Exists But CI Still Fails

**Problem:** You've verified the channel on-chain, but validation still fails

**Possible causes:**
1. `chain_id` doesn't match `chain.json`
2. Schema path is wrong
3. Alphabetical order is wrong
4. Missing required fields

**Solution:**

Run local validation to see detailed errors:
```bash
npm install -g @chain-registry/cli
chain-registry validate --registryDir . --logLevel error
```

This will show exactly what's wrong.

---

## Best Practices

### 1. Always Verify On-Chain

Don't trust channel IDs from:
- Other people's claims
- Old documentation
- Memory

Always query the chain directly or use Mintscan.

---

### 2. Include Proof in PR

Make reviewer's job easier by providing proof:

```markdown
## Proof

Mintscan: https://www.mintscan.io/cosmos/relayers/channel-141

Or query:
```bash
curl "https://cosmos-rest.publicnode.com/ibc/core/channel/v1/channels/channel-141/ports/transfer"
```
```

---

### 3. Check Both Sides

Query BOTH chains to verify:
- Chain 1's channel points to Chain 2's channel
- Chain 2's channel points back to Chain 1's channel
- Connection IDs match
- Client IDs match

---

### 4. Use Descriptive PR Titles

Your PR title should clearly describe what chains are involved and what action is being taken.

**✅ Good Examples:**
- `Add IBC connection: Cosmos Hub ↔ Neutron`
- `Update Osmosis-Juno IBC channel`

**❌ Bad Examples:**
- `Add files`
- `Update`
- `New channel`

---

### 5. Test Locally First

Before submitting PR:
```bash
# Validate
chain-registry validate --registryDir . --logLevel error

# Check JSON formatting
cat _IBC/cosmoshub-osmosis.json | jq '.'
```

---

## Quick Reference

### Channel Types

| Type | Port | Version | Ordering | Use Case |
|------|------|---------|----------|----------|
| **ICS20** | `transfer` | `ics20-1` | `unordered` | Token transfers |
| **ICS721** | `transfer` | `ics721-1` | `unordered` | NFT transfers |
| **ICA** | `icacontroller-{n}` / `icahost` | `ics27-1` | `ordered` | Account control |
| **CW20-ICS20** | `wasm.{contract}` / `transfer` | `ics20-1` | `unordered` | CW20 tokens over IBC |

---

### Status Values

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Channel is active and operational |
| `PENDING` | Channel exists but not yet active |
| `INACTIVE` | Channel has expired or frozen clients (or other client-blocking states) |
| `CLOSED` | Channel has actual CLOSED state on-chain |

---

### REST API Endpoints

```bash
# Query channel
{rest}/ibc/core/channel/v1/channels/{channel_id}/ports/{port_id}

# Query connection
{rest}/ibc/core/connection/v1/connections/{connection_id}

# Query client
{rest}/ibc/core/client/v1/client_states/{client_id}

# List all channels
{rest}/ibc/core/channel/v1/channels
```

---

## Additional Resources

### Official Documentation
- **IBC Specification:** https://github.com/cosmos/ibc
- **Chain Registry:** https://github.com/cosmos/chain-registry
- **IBC Protocol:** https://ibc.cosmos.network/

### Tools
- **Mintscan:** https://www.mintscan.io/
- **Map of Zones:** https://mapofzones.com/
- **Chain Registry CLI:** https://www.npmjs.com/package/@chain-registry/cli

---

**Last Updated:** 2025-11-13

---
