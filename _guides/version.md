# versions.json Guide

Version history for chain upgrades. Optional but recommended for mainnets.

> [!NOTE]
> `chain.json::codebase` is the source of truth for current version. `versions.json` is historical record.

## Version Entry

```jsonc
{
  "$schema": "../versions.schema.json",
  "chain_name": "yourchain",               // Must match directory, [a-z0-9]+ only
  "versions": [{
    "name": "v16",                         // Required: upgrade name
    "tag": "v16.0.0",                      // Git tag
    "height": 20440500,                    // Upgrade block height (0 for genesis)
    "proposal": 914,                       // Governance proposal number
    "recommended_version": "v16.0.0",
    "compatible_versions": ["v16.0.0", "v16.0.1"],
    "previous_version_name": "v15",
    "next_version_name": "v17",            // Empty string for latest

    "sdk": { "type": "cosmos", "version": "v0.47.13", "tag": "v0.47.13-ics-lsm" },
    "consensus": { "type": "cometbft", "version": "v0.38.11" },
    "ibc": { "type": "go", "version": "v8.7.0", "ics_enabled": ["ics20-1"] },
    "cosmwasm": { "version": "v0.53.0", "enabled": true, "path": "$HOME/.chain/data/wasm" },
    "language": { "type": "go", "version": "1.22.11" },

    "binaries": {
      "linux/amd64": "https://github.com/.../v16.0.0/binary-linux-amd64?checksum=sha256:abc123",
      "linux/arm64": "https://...",
      "darwin/amd64": "https://...",
      "darwin/arm64": "https://..."
    }
  }]
}
```

> [!TIP]
> Only `name` is required per version entry. Component objects (sdk, consensus, etc.) require `type` field if present.

## Component Types

| Component | Valid Types |
|-----------|-------------|
| `sdk.type` | `cosmos`, `penumbra`, `other` |
| `consensus.type` | `cometbft`, `tendermint`, `sei-tendermint`, `cometbls` |
| `ibc.type` | `go`, `rust`, `other` |
| `language.type` | `go`, `rust`, `solidity`, `other` |

## Version Format

All version strings: `v1.0.0`, `1.0.0`, `v16`, `0.50.11`

For complex build suffixes, use `tag`: `"tag": "v0.47.5-v22-osmo-3"`

## compatible_versions

Same major version only:
- Patch (v16.0.0 → v16.0.1): compatible
- Minor (v16.0.0 → v16.1.0): usually compatible
- Major (v15 → v16): NOT compatible

## Common Mistakes

```jsonc
{
  "$schema": "versions.schema.json",       // Wrong: missing ../
  "chain_name": "cosmos-hub",              // Wrong: must be cosmoshub
  "versions": [{
    // Missing "name" (required)
    "sdk": { "version": "v0.50.11" },      // Wrong: missing "type"
    "cosmwasm": { "path": "~/.chain/wasm" } // Wrong: must start with $HOME
  }]
}
```

## Reference

- Schema: `versions.schema.json`
- [Semantic Versioning](https://semver.org/)
