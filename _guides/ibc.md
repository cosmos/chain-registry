# IBC Connection Guide

IBC connection files enable token transfers between Cosmos chains.

## File Location

**Mainnet:** `_IBC/{chain1}-{chain2}.json`
**Testnet:** `testnets/_IBC/{chain1}-{chain2}.json`

> [!IMPORTANT]
> Chain names must be **alphabetical**: `cosmoshub-osmosis.json` not `osmosis-cosmoshub.json`

## IBC Connection

```jsonc
{
  "$schema": "../ibc_data.schema.json",    // "../../" for testnets
  "chain_1": {
    "chain_name": "cosmoshub",             // Must match directory name, alphabetically first
    "client_id": "07-tendermint-259",
    "connection_id": "connection-257",
    "chain_id": "cosmoshub-4"              // Must match chain.json
  },
  "chain_2": {
    "chain_name": "osmosis",               // Alphabetically second
    "client_id": "07-tendermint-1",
    "connection_id": "connection-1",
    "chain_id": "osmosis-1"
  },
  "channels": [{
    "chain_1": { "channel_id": "channel-141", "port_id": "transfer" },
    "chain_2": { "channel_id": "channel-0", "port_id": "transfer" },
    "ordering": "unordered",
    "version": "ics20-1",
    "tags": { "status": "ACTIVE", "preferred": true }
  }]
}
```

> [!TIP]
> Copy and replace values. All fields shown are required. Verify channel exists on-chain before submitting.

## Channel Types

| Type | Port | Version | Ordering |
|------|------|---------|----------|
| ICS20 (tokens) | `transfer` | `ics20-1` | `unordered` |
| ICS721 (NFTs) | `transfer` | `ics721-1` | `unordered` |
| ICA | `icacontroller-*` / `icahost` | `ics27-1` | `ordered` |
| CW20-ICS20 | `wasm.{contract}` / `transfer` | `ics20-1` | `unordered` |

## Multiple Channels

Only ONE channel per port pair can have `"preferred": true`. Different port pairs (e.g., transfer + ICA) can each have a preferred channel.

## Finding IBC Info

**Mintscan:** `https://www.mintscan.io/{chain}/relayers`

**REST API:**
```bash
curl "{rest}/ibc/core/channel/v1/channels/{channel_id}/ports/transfer"
curl "{rest}/ibc/core/connection/v1/connections/{connection_id}"
```

## Channel Replacement

> [!WARNING]
> Never replace channel IDs with established liquidity. Changing channels creates different IBC denom hashes, breaking pools and balances.

| Situation | Allowed? |
|-----------|----------|
| New channel (<1 week, unused) | Yes |
| Both chains' governance approves | Yes |
| Provably <$100 counterparty value | Yes |
| Channel with liquidity/pools/balances | No |

If old channel has registered assets, set `"preferred": false, "status": "INACTIVE"` and add new channel.

## Status Values

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Operational |
| `PENDING` | Exists but not active |
| `INACTIVE` | Expired/frozen clients |
| `CLOSED` | On-chain CLOSED state |

## Common Mistakes

```jsonc
{
  // File: osmosis-cosmoshub.json     // Wrong: reversed alphabetically
  "chain_1": { "chain_name": "osmosis" },
  "$schema": "ibc_data.schema.json",  // Wrong: missing ../
  "chain_1": { "chain_name": "cosmos-hub" },  // Wrong: must match directory (cosmoshub)
  "channels": [{
    "chain_1": { "port_id": "icacontroller-1" },
    "ordering": "unordered"           // Wrong: ICA must be "ordered"
  }]
}
```

## Reference

- Schema: `ibc_data.schema.json`
- [Mintscan](https://www.mintscan.io/) for channel verification
