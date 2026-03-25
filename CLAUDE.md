# CLAUDE.md

## Project Overview

This is the burnt-labs fork of the Cosmos chain-registry, containing XION chain configurations, asset lists, and IBC connection data.

## Repository Structure

```
xion/              # XION chain registry entry
  chain.json       # Chain configuration and endpoints
  assetlist.json   # Token/asset definitions
  images/          # Chain and asset images
  versions.json    # Version history
_IBC/              # IBC connection data between chains
_template/         # Templates for new chain entries
_scripts/          # Validation and utility scripts
```

## Working with Chain Registry

Chain registry entries follow the Cosmos chain registry standard. Key files:

- `chain.json` - Chain metadata, RPC/REST endpoints, explorer links
- `assetlist.json` - Native and IBC token definitions
- `versions.json` - Software version history

## Validation

```bash
# Run validation scripts
./_scripts/validate.sh
```

## Contributing

- XION-specific changes go in the `xion/` directory
- IBC connections with XION go in `_IBC/`
- Follow the schema in `_template/` for new entries
- Default working branch is `xion/main`
