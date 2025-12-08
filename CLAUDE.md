# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

The Cosmos Chain Registry is a centralized repository containing metadata for Cosmos SDK-based and other blockchain networks. Each chain has a directory containing:
- `chain.json` - Core chain metadata (RPC endpoints, chain ID, fees, etc.)
- `assetlist.json` - Token/asset metadata for native and IBC tokens
- `versions.json` - Optional version history
- `images/` - Chain and token logos (PNG/SVG)

## Key Commands

### Validation and Testing
```bash
# Install validation CLI (required for testing)
npm install -g @chain-registry/cli@1.47.0

# Validate entire registry
chain-registry validate --registryDir . --logLevel error

# Lint JSON files
npm install
npx eslint ./
```

### Common Development Tasks
```bash
# Check if chain directory exists before creating
ls <chain-name>/

# Validate single chain structure
ls <chain-name>/chain.json <chain-name>/assetlist.json

# Check image dimensions and file size
identify <chain-name>/images/<image>.png
ls -lh <chain-name>/images/<image>.png
```

## Repository Structure

### Directory Organization
- **Root level** - Mainnet chains (e.g., `/osmosis/`, `/cosmoshub/`)
- `/testnets/` - Testnet chains
- `/_IBC/` - IBC connection metadata between chains
- `/_non-cosmos/` - Non-Cosmos chains (Bitcoin, Ethereum, etc.)
- `/_template/` - Template files for new chains
- `/_guides/` - Documentation for each JSON type
- `/_scripts/` - Utility scripts

### Chain Directory Structure
```
chainname/
├── chain.json         # Required: Core chain metadata
├── assetlist.json     # Required: Token/asset definitions
├── versions.json      # Optional: Version history
└── images/            # Required: Logos and images
    ├── chainname.png
    ├── chainname.svg
    ├── token1.png
    └── token1.svg
```

### Special Files
- `chain.schema.json` - JSON schema for chain.json validation
- `assetlist.schema.json` - JSON schema for assetlist.json
- `ibc_data.schema.json` - JSON schema for IBC connection files
- `versions.schema.json` - JSON schema for versions.json

## Architecture & Key Concepts

### Chain Naming Convention
- `chain_name` must be lowercase alphanumeric only (no hyphens, underscores, or spaces)
- Pattern: `[a-z0-9]+`
- `chain_name` is permanent and cannot be changed once set
- Use `pretty_name` for human-readable display names

### IBC Connection Files
- Located in `/_IBC/` directory
- Filename format: `chain1-chain2.json` (alphabetically ordered)
- Contains client IDs, connection IDs, and channel mappings
- Both chain names in filename and file content must match actual chain directory names

### Hard Fork Handling
When a chain changes its `chain_id` (hard fork):
1. Archive the old chain:
   - Rename directory (e.g., `cosmoshub/` → `cosmoshub4/`)
   - Update `chain_name` in all JSON files to match new directory name
   - Set `status` to `"killed"`
   - Rename and update IBC files (e.g., `cosmoshub-osmosis.json` → `cosmoshub4-osmosis.json`)
   - Update all references in other chains' assetlists (traces, image_sync)
2. Create new chain in original directory with `pre_fork_chain_name` pointing to archived chain

### Image Management
**Critical Requirements:**
- Square dimensions (width = height)
- File size < 250 KB
- PNG or SVG format only
- Lowercase filenames

**Image Sync Pattern:**
- Upload images ONLY in the chain where the asset originates
- Use `image_sync` in other chains to reference the origin
- This prevents duplicate images and keeps them synchronized

Example:
```json
// In osmosis/assetlist.json for ATOM from Cosmos Hub:
"images": [{
  "image_sync": {
    "chain_name": "cosmoshub",
    "base_denom": "uatom"
  },
  "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png"
}]
```

### Asset Traces
When an asset is transferred via IBC, use traces to show the path:
```json
"traces": [{
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
}]
```

### Required Fields by Context

**Always Required:**
- `$schema`, `chain_name`, `chain_type`

**Required by Node Validation (CI fails without):**
- `status` (must be "live", "upcoming", or "killed")

**Required for Cosmos chains:**
- `chain_id`, `bech32_prefix`

**Required for live Cosmos mainnets:**
- `slip44` (validation script enforces this)

**Strongly Recommended:**
- `network_type`, `fees`, `logo_URIs`, `images`, `apis`, `peers`

## Common Workflows

### Adding a New Chain
1. Copy template from `/_template/`
2. Create new directory with lowercase chain name
3. Edit `chain.json` with chain-specific data
4. Edit `assetlist.json` with native token data
5. Add square images (< 250 KB) to `images/` subdirectory
6. Update all GitHub raw URLs to point to the new chain directory
7. Run validation: `chain-registry validate --registryDir . --logLevel error`

### Adding IBC Connection
1. Create file in `/_IBC/` with format: `chain1-chain2.json` (alphabetically ordered)
2. Use `ibc_data.schema.json` as reference
3. Include client_id, connection_id for both chains
4. Add channel mappings with channel_id and port_id for both sides

### Adding API Endpoints
Endpoints are tested daily at 00:00 UTC via CI. They must return HTTP 200 at:
- REST: `/cosmos/base/tendermint/v1beta1/syncing`
- RPC: `/status`
- gRPC: not tested

Consistently failing endpoints may be removed without warning.

To opt-in to daily testing, whitelist provider in: `.github/workflows/tests/apis.py`

### Updating Chain Metadata
1. Edit relevant JSON file(s) in chain directory
2. Maintain alphabetical ordering in arrays where applicable
3. Ensure image URLs match actual file paths
4. Run linter: `npx eslint ./`
5. Run validation before submitting PR

## Git Workflow

### PR Title Guidelines
Use descriptive PR titles beyond "Update chain.json". Include:
- Affected chain name
- Type of change (e.g., "Add RPC endpoints", "Update genesis URL")
- Provider name (for API additions)

Examples:
- "Add Cosmos Hub APIs for Acme Validator"
- "Update Osmosis genesis URL and recommended version"
- "Add Juno RPC/REST endpoints for NodeStake"

### Commits
Follow standard commit conventions. The repository uses GitHub Actions for CI/CD validation.

## Schema Validation Rules

### Pattern Validations
- `chain_name`: `[a-z0-9]+`
- `bech32_prefix`: Typically lowercase, no strict pattern in schema
- `version`: `^v?\d+(\.\d+){0,2}$` (e.g., "v1.0.0" or "1.0.0")
- `tag`: `^[A-Za-z0-9._/@-]+$`
- Image URLs: Must follow GitHub raw URL pattern with correct directory

### Conditional Requirements
```javascript
// Cosmos chains require:
if (chain_type === "cosmos") {
  required: ["bech32_prefix"]
}

// Cosmos OR EVM chains require:
if (chain_type === "cosmos" || chain_type === "eip155") {
  required: ["chain_id"]
}

// Live Cosmos mainnets require (validation script):
if (chain_type === "cosmos" && status === "live" && network_type === "mainnet") {
  required: ["slip44"]
}
```

### Gas Price Ordering
When specifying gas prices, they must follow this ordering:
```
high_gas_price >= average_gas_price >= low_gas_price >= fixed_min_gas_price
```

## CI/CD Workflows

The repository uses GitHub Actions for automated validation:

1. **validate.yml** - Schema validation using `@chain-registry/cli`
2. **lint.yml** - JSON linting with ESLint
3. **test_endpoints.yml** - Daily endpoint availability checks
4. **validate_data.yml** - Additional data validation rules
5. **validate_ibcdatajson.yml** - IBC connection validation
6. **sync_images.yml** - Automated image synchronization
7. **sync_versions.yml** - Automated version history updates
8. **check_coingecko_data.yml** - CoinGecko integration validation
9. **check-broken-links.yml** - Link validation

All PRs must pass these checks before merging.

## Reference Documentation

Key schema files (read these for complete validation rules):
- `/chain.schema.json` - Complete chain.json schema (lines 1-742)
- `/assetlist.schema.json` - Asset list schema
- `/ibc_data.schema.json` - IBC connection schema
- `/_guides/chain.md` - Comprehensive chain.json guide (1520 lines)
- `/_guides/assetlist.md` - Asset list guide
- `/_guides/ibc.md` - IBC connection guide
- `/IMAGE-GUIDELINES.md` - Complete image requirements and validation rules

## Common Mistakes to Avoid

1. Using uppercase or special characters in `chain_name`
2. Missing required fields for Cosmos chains (`chain_id`, `bech32_prefix`)
3. Missing `slip44` for live Cosmos mainnets
4. Using non-GitHub-raw URLs for images
5. Non-square images or images > 250 KB
6. Uploading duplicate images instead of using `image_sync`
7. Forgetting to update IBC filenames when archiving chains
8. Not updating `status` to "killed" when archiving
9. Using wrong `$schema` path (testnets need `../../`, non-cosmos needs `../../../`)
10. Not maintaining alphabetical order in IBC filenames (chain1-chain2, not chain2-chain1)

---

## NOTE: Quy tắc làm việc với user (Tiếng Việt)

**QUAN TRỌNG - Đọc kỹ trước khi thực hiện bất kỳ task nào:**

### Ngôn ngữ sử dụng
- ✅ **Luôn dùng tiếng Việt** trong conversation với user
- ✅ **Luôn dùng tiếng Việt** trong phần note/explanation
- ✅ **Chỉ dùng tiếng Anh** trong code và comment code

### Nguyên tắc thực thi task
- ⚠️ **CHỈ thực hiện task/step mà user yêu cầu cụ thể** - không tự ý làm thêm
- ⚠️ Nếu user yêu cầu "step 1" trong 4 steps → **chỉ làm step 1, dừng lại** và chờ instruction tiếp theo
- ⚠️ **KHÔNG assumption** về việc user muốn tiếp tục các steps khác
- ⚠️ **KHÔNG tự động** làm tiếp các bước kế tiếp nếu không được yêu cầu rõ ràng

### Ví dụ
```
User: "Làm step 1: tạo file chain.json"
→ CHỈ tạo file chain.json, DỪNG LẠI, chờ instruction tiếp

KHÔNG được:
→ Tạo luôn assetlist.json
→ Tạo luôn thư mục images/
→ Đề xuất "có muốn tôi làm step 2 không?"
```

### Khi hoàn thành task
- ✅ Thông báo đã hoàn thành bằng tiếng Việt
- ✅ Hỏi user có cần gì thêm không
- ❌ KHÔNG tự động làm tiếp bước khác
