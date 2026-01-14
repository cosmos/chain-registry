# chain.json Guide

Core metadata file for a blockchain in the Cosmos Chain Registry.

## Cosmos Chain

```jsonc
{
  "$schema": "../chain.schema.json",       // "../../" for testnets
  "chain_name": "yourchain",               // Lowercase alphanumeric only, immutable once set
  "chain_type": "cosmos",                  // cosmos|eip155|bip122|polkadot|solana|etc
  "chain_id": "yourchain-1",
  "status": "live",                        // live|upcoming|killed
  "network_type": "mainnet",               // mainnet|testnet|devnet
  "pretty_name": "Your Chain",
  "website": "https://yourchain.com",
  "bech32_prefix": "your",                 // Address prefix: your1...
  "slip44": 118,                           // HD wallet coin type (118=Cosmos, 60=ETH)
  "daemon_name": "yourchaind",
  "node_home": "$HOME/.yourchaind",
  "key_algos": ["secp256k1"],

  "fees": {
    "fee_tokens": [{
      "denom": "utoken",
      "fixed_min_gas_price": 0.01,         // Must be: fixed <= low <= avg <= high
      "low_gas_price": 0.01,
      "average_gas_price": 0.025,
      "high_gas_price": 0.03
    }]
  },

  "staking": {
    "staking_tokens": [{ "denom": "utoken" }],
    "lock_duration": { "time": "1209600s" }
  },

  "codebase": {
    "git_repo": "https://github.com/yourorg/yourchain",
    "recommended_version": "v1.0.0",
    "compatible_versions": ["v1.0.0"],
    "tag": "v1.0.0",
    "language": { "type": "go", "version": "1.22" },
    "sdk": { "type": "cosmos", "version": "0.50.9" },
    "consensus": { "type": "cometbft", "version": "0.38.11" },
    "ibc": { "type": "go", "version": "8.5.1", "ics_enabled": ["ics20-1", "ics27-1"] },
    "cosmwasm": { "version": "0.53.0", "enabled": true, "path": "$HOME/.yourchaind/data/wasm" },
    "genesis": { "genesis_url": "https://yourchain.com/genesis.json" }
  },

  "peers": {
    "seeds": [{ "id": "abc123...", "address": "seed.yourchain.com:26656", "provider": "Your Foundation" }],
    "persistent_peers": []
  },

  "apis": {
    "rpc": [{ "address": "https://rpc.yourchain.com", "provider": "Your Foundation" }],
    "rest": [{ "address": "https://api.yourchain.com", "provider": "Your Foundation" }],
    "grpc": [{ "address": "grpc.yourchain.com:443", "provider": "Your Foundation" }]
  },

  "explorers": [{
    "kind": "mintscan",
    "url": "https://www.mintscan.io/yourchain",
    "tx_page": "https://www.mintscan.io/yourchain/transactions/${txHash}",
    "account_page": "https://www.mintscan.io/yourchain/accounts/${accountAddress}"
  }],

  "logo_URIs": {
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/yourchain/images/token.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/yourchain/images/token.svg"
  },
  "images": [{
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/yourchain/images/token.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/yourchain/images/token.svg"
  }],

  "description": "Chain description (max 3000 chars)",
  "keywords": ["defi", "staking"]
}
```

> [!TIP]
> Copy and replace placeholder values. Required: `$schema`, `chain_name`, `chain_type`, `status`. For cosmos chains, also required: `chain_id`, `bech32_prefix`. For live cosmos mainnets: `slip44`.

## Non-Cosmos Chain

```json
{
  "$schema": "../../chain.schema.json",
  "chain_name": "bitcoin",
  "chain_type": "bip122",
  "status": "live"
}
```

## Rebrand vs Hard Fork

| Scenario | chain_id changes? | Action |
|----------|-------------------|--------|
| Rebrand | No | Update `pretty_name` and logos only |
| Hard Fork | Yes | Full archival process (below) |

---

## Hard Fork Archival

When `chain_id` changes, the old chain must be archived.

### Step 1: Archive Pre-Fork Chain

1. **Update chain metadata:**
   ```jsonc
   // cosmoshub4/chain.json (archived):
   { "chain_name": "cosmoshub4", "chain_id": "cosmoshub-4", "status": "killed" }
   ```

2. **Rename IBC files and update `chain_name` inside:**
   ```
   _IBC/cosmoshub-osmosis.json → _IBC/cosmoshub4-osmosis.json
   ```

3. **Update asset traces on other chains** to reference archived chain name.

4. **Update image paths** to new directory name.

5. **Rename directory:** `mv cosmoshub/ cosmoshub4/`

6. **Add `legacy-mintage` traces** if tokens are replaced:
   ```jsonc
   "traces": [{
     "type": "legacy-mintage",
     "counterparty": { "chain_name": "newchain", "base_denom": "utoken" },
     "provider": "Project Name"
   }]
   ```

### Step 2: Create Post-Fork Chain

```jsonc
{
  "chain_name": "cosmoshub",           // Takes original name
  "chain_id": "cosmoshub-5",           // New chain ID
  "pre_fork_chain_name": "cosmoshub4"  // If state was bundled into genesis
}
```

> [!IMPORTANT]
> Update all references: chain.json, assetlist.json, versions.json, IBC files, traces, and image_sync on external chains.

---

## Common Mistakes

```jsonc
{
  "chain_name": "Example-Chain",       // No uppercase or hyphens
  "chain_type": "cosmos",              // Missing chain_id and bech32_prefix
  "slip44": null,                      // Required for live cosmos mainnets
  "codebase": {
    "sdk": { "version": "0.50.9" }     // Missing required "type" field
  },
  "logo_URIs": {
    "png": "https://example.com/logo.png"  // Must be GitHub raw URL from this repo
  }
}
```

## Reference

- Schema: `chain.schema.json`
- Examples: [osmosis/chain.json](https://github.com/cosmos/chain-registry/blob/master/osmosis/chain.json), [cosmoshub/chain.json](https://github.com/cosmos/chain-registry/blob/master/cosmoshub/chain.json)
