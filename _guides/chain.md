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
