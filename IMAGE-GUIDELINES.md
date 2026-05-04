# 📸 Image Guidelines for Cosmos Chain Registry

Complete guide for adding, managing, and optimizing images in the chain registry.

---

## Table of Contents

1. [Quick Rules](#quick-rules)
2. [Image Requirements](#image-requirements)
3. [When to Upload New Images](#when-to-upload-new-images)
4. [When to Use image_sync](#when-to-use-image_sync)
5. [File Naming Convention](#file-naming-convention)
6. [Directory Structure](#directory-structure)
7. [Testing Images](#testing-images)
8. [Common Image Mistakes](#common-image-mistakes)
9. [Examples](#examples)
10. [Quick Reference](#quick-reference)

---

## Quick Rules

**Core Requirements:**
- ✅ Images must be **square** (width = height)
- ✅ Images must be **< 250 KB** (file size)
- ✅ Use **descriptive, lowercase filenames** (atom.png, osmo.svg, cosmos_chain.png)
- ✅ Use **PNG** or **SVG** (preferred when available)
- ✅ Add images **only where asset originates**, use `image_sync` for cross-chain tokens
- ✅ Use `traces` to point to origin

---

## Image Requirements

All images are automatically validated through CI checks. Here are the specific requirements:

### 1. Image URI Existence
Image URIs must correspond to actual files uploaded to the repository.

### 2. File Size: <250 kB
Images must not exceed 250 KB of storage space (applies to both PNG and SVG).

**Check file size:**
```bash
ls -lh image.png
# ✅ 48K, 120K, 200K - GOOD
# ❌ 300K, 512K - TOO LARGE
```

### 3. Aspect Ratio: Must Be Square
Images must be square - width must equal height (±1px tolerance).

```bash
# Check dimensions
identify image.png

# ✅ 256x256, 512x512, 1024x1024 - SQUARE
# ❌ 512x256, 1920x1080 - NOT SQUARE
```

### 4. PNG Authenticity
PNGs must be authentic PNG images, not other formats (JPG, GIF, WebP) renamed with `.png` extension.

### 5. SVG Complexity: <1000 Shapes
SVGs must have fewer than 1000 shapes. More than that indicates a poor-quality conversion from a raster image.

### 6. SVG Authenticity: True Vector Graphics
SVGs must be primarily made of vector components (shapes, paths, masks). Some raster-embedded content is allowed if sufficient vector components exist, but pure raster images wrapped as SVG are rejected.

---

## Supported Formats

**PNG and SVG only:**
- ✅ **PNG** - Supports transparency, widely compatible
- ✅ **SVG** - Preferred when scalable vector graphics are available (smaller file size, infinitely scalable)

**Not Supported:**
- ❌ **JPG/JPEG** - Not allowed (no transparency support)
- ❌ **GIF** - Not supported
- ❌ **WebP** - Not supported

### Format Priority

**Preferred approach:**
- **SVG only** when available (smaller, scalable)
- **PNG** when no SVG is available
- **Both PNG and SVG** when both are available

```json
// Both formats available
"logo_URIs": {
        "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png",
        "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.svg"
      },
"images": [
  {
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png",
    "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.svg"
  }
]
```

**Note on logo_URIs vs images[]:**
- `logo_URIs`: Legacy field for backward compatibility
- `images[]`: Current standard, more flexible (supports `image_sync`, multiple formats, theme variants)

---

## File Naming Convention

Use **lowercase, descriptive names** that:
- Correspond to the chain or asset
- Are short and memorable

### ✅ GOOD Examples:
```bash
atom.png              # Token symbol (short, clear)
osmo.svg              # Token symbol
cosmoshub.png         # Chain name
cosmos_chain.png      # Chain logo
ion.png               # Specific token name
usdc.png              # Common token name
```

### ❌ BAD Examples:
```bash
chain.png             # Too generic (name collision risk)
ATOM.PNG              # Uppercase (filesystem inconsistencies)
token-1.png           # Not descriptive
image123.png          # Not meaningful
my logo final.png     # Spaces not recommended
```

### Why Lowercase?

Some filesystems are case-sensitive (Linux), others aren't (macOS, Windows). Using lowercase consistently avoids verification issues across different environments.

---

## Directory Structure

### Where Images Go

Images belong **only in the chain directory where the asset originates**.

```
chain-registry/
├── cosmoshub/
│   └── images/
│       ├── atom.png              ← Native token (ORIGIN)
│       ├── atom.svg
│       └── cosmoshub-chain.png   ← Chain logo
├── osmosis/
│   └── images/
│       ├── osmo.png              ← Native token (ORIGIN)
│       ├── osmo.svg
│       └── ion.png               ← Other native tokens
├── noble/
│   └── images/
│       └── (NO usdc.png - USDC origin is Ethereum)
├── _non-cosmos/
│   └── ethereum/
│       └── images/
│           └── usdc.png          ← USDC origin (Circle on Ethereum)
└── testnets/
    └── osmosistestnet/
        └── images/
            └── (NO osmo.png - reference mainnet using image_sync)
```

**Key Principle:** Add images **only where asset originates**. For testnet versions, wrapped tokens, IBC transfers, use `image_sync` to reference the source.

---

## When to Upload New Images

### ✅ Upload New Images When:

1. **Adding a brand new chain**
   - Chain logo
   - Native token logo

2. **Adding a new native token**
   - Token didn't exist before in the registry
   - First appearance, originates on this chain

3. **Origin asset definition**
   - This is the original/source version (not a testnet copy, IBC transfer, or wrapped variant)

### ❌ DO NOT Upload Images When:

- Adding IBC-transferred tokens (ATOM on Osmosis)
- Adding testnet versions of mainnet tokens
- Adding wrapped/bridged tokens (axlUSDC, wBTC) - unless the wrapped version has its own distinct branding
- Token originates elsewhere

**Use `image_sync` instead!** (See next section)

---

## When to Use image_sync

### What is `image_sync`?

- Automatically inherits images from the referenced chain or asset
- Avoids duplicate image files to reduce repository size
- Keeps images in sync with source (if source updates, downstream inherits)

### How to Use image_sync

#### Step 1: Find the SOURCE Chain (Not Origin!)

**Important Distinction:**
- **Origin:** Where the token was first created
- **Source:** Where you should reference the image from

**Example: USDC on Noble Testnet**
- **Origin:** Ethereum (Circle's original USDC)
- **Source:** Noble (mainnet) ← Reference this!
- **Why:** If Noble's USDC image diverges from Ethereum (e.g., adds chain markers), Noble Testnet stays in sync with Noble mainnet

**Common Sources:**
- Testnet token → Reference mainnet version
- IBC token → Reference the chain it came from
- Wrapped token → Reference the immediate source (not ultimate origin)

```bash
# Find the source chain's base denom
cat noble/assetlist.json | jq '.assets[] | select(.symbol=="USDC") | .base'
# Output: "uusdc"
```

#### Step 2: Add traces Field

**Note:** `image_sync` technically works without `traces`, but `traces` is **required by validation rules** to maintain data consistency.

```json
{
  "traces": [
    {
      "type": "ibc",
      "counterparty": {
        "chain_name": "noble",
        "base_denom": "uusdc",
        "channel_id": "channel-0"
      },
      "chain": {
        "channel_id": "channel-123",
        "path": "transfer/channel-123/uusdc"
      }
    }
  ]
}
```

#### Step 3: Add image_sync to images

```json
{
  "images": [
    {
      "image_sync": {
        "chain_name": "noble",
        "base_denom": "uusdc"
      },
      "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/usdc.png",
      "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/usdc.svg"
    }
  ]
}
```
---

## Testing Images

### Test Locally Before Committing

```bash
# 1. Check dimensions (must be square)
identify mychain/images/token.png
# Expected: PNG image data, 1024 x 1024

# 2. Check file size (must be < 250 KB)
ls -lh mychain/images/token.png
# Expected: 48K, 120K, 200K (not 300K+)

# 3. Verify image loads
open mychain/images/token.png  # macOS
xdg-open mychain/images/token.png  # Linux
```

### Test in PR

Once you create a PR:
1. CI automatically checks image dimensions
2. CI checks file sizes
3. Fix any errors before maintainer review

---

## Common Image Mistakes

### ❌ Mistake 1: Non-Square Images

**Error:**
```
Asset PNG at terratestnet, usdc isn't square! Width: 1920, Height: 1080
```

**Problem:** Image dimensions are 1920x1080 (not square)

**Solution:** Make your image square (width = height) before uploading.

---

### ❌ Mistake 2: Oversized Images

**Error:**
```
Image file size exceeds 250KB limit: 512KB
```

**Problem:** Image is 512 KB (too large)

**Solution:** Optimize or reduce the image file size to under 250 KB before uploading.

---

### ❌ Mistake 3: Uploading Duplicates

**Problem:** Uploading `osmo.png` to `osmosistestnet/images/` when it already exists in `osmosis/images/`

**Solution:**
```bash
# 1. Delete the duplicate file
rm osmosistestnet/images/osmo.png

# 2. Use image_sync instead
# Add to assetlist.json:
{
  "traces": [
    {
      "type": "test-mintage",
      "counterparty": {
        "chain_name": "osmosis",
        "base_denom": "uosmo"
      }
    }
  ],
  "images": [
    {
      "image_sync": {
        "chain_name": "osmosis",
        "base_denom": "uosmo"
      }
    }
  ]
}
```

---

### ❌ Mistake 4: Missing Image References in chain.json

**Problem:** Uploaded `mychain.png` but forgot to reference it in `chain.json`

**Solution:** Add image references to chain.json or assetlist.json

```json
// chain.json (for chain logos)
{
  "chain_name": "mychain",
  "logo_URIs": {
    "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/mychain/images/mychain.png"
  }
}
```

**Note:** Image URIs go in `chain.json` for chain logos, or `assetlist.json` for asset/token logos.

---

### ❌ Mistake 5: Wrong Image URLs

**Problem:** Hardcoded personal GitHub username in URL

```json
❌ "png": "https://raw.githubusercontent.com/myusername/chain-registry/master/..."
✅ "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/..."
```

**Solution:** Always use `cosmos/chain-registry` in image URLs (not your fork)

---

### ❌ Mistake 6: Using image_sync Without traces

**Problem:**
```json
{
  "images": [
    {
      "image_sync": {
        "chain_name": "noble",
        "base_denom": "uusdc"
      }
    }
  ]
  // ❌ Missing traces field!
}
```

**Solution:** Always add `traces` when using `image_sync` (required by validation)

```json
{
  "traces": [
    {
      "type": "ibc",
      "counterparty": {
        "chain_name": "noble",
        "base_denom": "uusdc"
      }
    }
  ],
  "images": [
    {
      "image_sync": {
        "chain_name": "noble",
        "base_denom": "uusdc"
      }
    }
  ]
}
```

---

### ❌ Mistake 7: Generic Filenames

**Problem:**
```bash
❌ chain.png     # Too generic - name collision risk
```

**Solution:**
```bash
✅ mychain.png   # Specific to your chain
✅ cosmos_chain.png  # Descriptive, avoids collision
```

---

### ❌ Mistake 8: Uppercase Filenames

**Problem:**
```bash
❌ ATOM.PNG      # Causes filesystem inconsistencies
```

**Solution:**
```bash
✅ atom.png      # Lowercase (consistent across all filesystems)
```

---

## Examples

### Example 1: Native Token (New Upload)

**Scenario:** Adding a brand new chain with native token

**Files:**
```
mychain/
├── chain.json
├── assetlist.json
└── images/
    ├── mytoken.png  ← 512x512, 45 KB
    └── mytoken.svg  ← 12 KB
```

**assetlist.json:**
```json
{
  "$schema": "../assetlist.schema.json",
  "chain_name": "mychain",
  "assets": [
    {
      "description": "The native token of My Chain",
      "denom_units": [
        {
          "denom": "umytoken",
          "exponent": 0
        },
        {
          "denom": "mytoken",
          "exponent": 6
        }
      ],
      "base": "umytoken",
      "name": "My Token",
      "display": "mytoken",
      "symbol": "MYTOKEN",
      "logo_URIs": {
        "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/mychain/images/mytoken.png",
        "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/mychain/images/mytoken.svg"
      },
      "images": [
        {
          "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/mychain/images/mytoken.png",
          "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/mychain/images/mytoken.svg"
        }
      ]
    }
  ]
}
```

---

### Example 2: IBC Token (image_sync)

**Scenario:** Adding ATOM to Osmosis (ATOM originated from Cosmos Hub)

**Files:**
```
osmosis/
├── assetlist.json  ← Add ATOM here
└── images/
    └── (NO atom.png needed - using image_sync)
```

**osmosis/assetlist.json:**
```json
{
  "assets": [
    {
      "description": "The native staking token of the Cosmos Hub",
      "denom_units": [
        {
          "denom": "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          "exponent": 0
        },
        {
          "denom": "atom",
          "exponent": 6
        }
      ],
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
            "channel_id": "channel-0"
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
  ]
}
```

**Notice:** No `osmosis/images/atom.png` uploaded - using image_sync to reference `cosmoshub/images/atom.png`

---

### Example 3: Testnet Token (image_sync)

**Scenario:** Adding testnet OSMO (references mainnet Osmosis)

**Files:**
```
testnets/osmosistestnet/
├── assetlist.json  ← Add testnet OSMO
└── images/
    └── (NO osmo.png needed - using image_sync)
```

**testnets/osmosistestnet/assetlist.json:**
```json
{
  "assets": [
    {
      "description": "Osmosis testnet token",
      "denom_units": [
        {
          "denom": "uosmo",
          "exponent": 0
        },
        {
          "denom": "osmo",
          "exponent": 6
        }
      ],
      "base": "uosmo",
      "name": "Osmosis Testnet",
      "display": "osmo",
      "symbol": "OSMO",
      "traces": [
        {
          "type": "test-mintage",
          "counterparty": {
            "chain_name": "osmosis",
            "base_denom": "uosmo"
          }
        }
      ],
      "images": [
        {
          "image_sync": {
            "chain_name": "osmosis",
            "base_denom": "uosmo"
          },
          "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png",
          "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.svg"
        }
      ]
    }
  ]
}
```
---

## Quick Reference

### Image Requirements Checklist

Use this checklist when adding images:

- [ ] **Square dimensions** (width = height)
- [ ] **File size < 250 KB**
- [ ] **PNG or SVG format** (PNG for transparency, SVG preferred when available)
- [ ] **Descriptive lowercase filename** (atom.png, osmo.svg, cosmos_chain.png)
- [ ] **No generic names** (avoid chain.png, token.png)
- [ ] **Upload only at origin** (not for IBC, testnet, or wrapped tokens)
- [ ] **Used `image_sync`** if cross-chain/testnet token
- [ ] **Added `traces`** if using image_sync
- [ ] **Correct GitHub URL** (cosmos/chain-registry, not your fork)
- [ ] **Referenced in chain.json or assetlist.json** (depending on whether it is a chain logo or asset logo)

---

## Common Questions

**Q: Can I use JPG instead of PNG?**
A: **No.** JPG is not allowed. PNG is required.

**Q: How do I know if I should use image_sync?**
A: If the token originated from another chain (IBC transfer, testnet version, wrapped token), use `image_sync`. Only upload new images for assets that **originate** on the chain you're adding them to.

**Q: Do I need both PNG and SVG?**
A: Prefer SVG when available (smaller, scalable).Providing both is fine but not required.

**Q: My PR failed CI with "Image isn't square". What do I do?**
A: Fix the image dimensions to be square (width = height), then push the changes.

**Q: What's the difference between logo_URIs and images[]?**
A: `logo_URIs` is a legacy field for backward compatibility. `images[]` is the current standard and supports more features like `image_sync`, multiple formats, and theme variants.

**Q: Should image names be lowercase?**
A: Yes, lowercase is strongly recommended to avoid filesystem inconsistencies across different operating systems (Linux is case-sensitive, macOS/Windows are not).

**Q: Can I add logotypes or brand kit?**
A: No. We only want **token logos** (square) and **chain logos** (square). No full logotypes, wordmarks, or brand kit dumps.

---

**Last Updated:** October 2025
