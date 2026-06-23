# Chain Registry

This repo contains a `chain.json`, `assetlist.json`, and `versions.json` for a number of cosmos-sdk based chains (and `assetlist.json` for non-cosmos chains).  A `chain.json` contains data that makes it easy to start running or interacting with a node.

Schema files containing the recommended metadata structure can be found in the `*.schema.json` files located in the root directory. Schemas are still undergoing revision as user needs are surfaced. Optional fields may be added beyond what is contained in the schema files.

We invite stakeholders to join the [Cosmos Chain Registry Working Group](https://t.me/+OkM0SDZ-M0liNDdh) on Telegram to discuss major structure changes, ask questions, and develop tooling.

Once schemas have matured and client needs are better understood Chain Registry data is intended to migrate to an on-chain representation hosted on the Cosmos Hub, i.e. the Cosmos Chain Name Service. If you are interested in this effort please join the discussion [here](https://github.com/cosmos/chain-registry/issues/291)!

## Npm Modules
- https://www.npmjs.com/package/chain-registry

## Rust Crates
- https://crates.io/crates/chain-registry

## Web Endpoints
- https://registry.ping.pub (Update every 24H)
- https://atomscan.com/directory (Update every 24H)
- https://cosmoschains.thesilverfox.pro (Updated every 24H)

## APIs
- https://github.com/cmwaters/skychart
- https://github.com/empowerchain/cosmos-chain-directory
- https://github.com/effofxprime/Cosmregistry-API

## Web Interfaces
- https://cosmos.directory
- https://atomscan.com/directory

## Tooling
- https://github.com/gaia/chain-registry-query/

## Contributing

Please give Pull Requests a title that somewhat describes the change more precisely than the default title given to a Commit. PRs titled 'Update chain.json' difficult to navigate when searching through the backlog of Pull Requests. Some recommended details would be: the affected Chain Name, API types, or Provider to give some more detail; e.g., "Add Cosmos Hub APIs for Acme Validator".

### Endpoints reachability

The endpoints added here are being tested via CI daily at 00:00 UTC. It is expected that your endpoints return an HTTP 200 in the following paths:
- rest: `/cosmos/base/tendermint/v1beta1/syncing`
- rpc: `/status`
- grpc: not tested
Endpoints that consistently fail to respond successfully may be removed without warning.

Providers ready to be tested daily should be whitelisted here: `.github/workflows/tests/apis.py`

# chain.json

## Sample

A sample `chain.json` includes the following information.

```json
{
  "$schema": "../chain.schema.json",
  "chain_name": "osmosis",
  "status": "live",
  "website": "https://osmosis.zone/",
  "network_type": "mainnet",
  "chain_type": "cosmos",
  "pretty_name": "Osmosis",
  "chain_id": "osmosis-1",
  "bech32_prefix": "osmo",
  "daemon_name": "osmosisd",
  "node_home": "$HOME/.osmosisd",
  "key_algos": [
    "secp256k1"
  ],
  "slip44": 118,
  "fees": {
    "fee_tokens": [
      {
        "denom": "uosmo",
        "fixed_min_gas_price": 0,
        "low_gas_price": 0,
        "average_gas_price": 0.025,
        "high_gas_price": 0.04
      }
    ]
  },
  "staking": {
    "staking_tokens": [
      {
        "denom": "uosmo"
      }
    ],
    "lock_duration": {
      "time": "1209600s"
    }
  },
  "codebase": {
    "git_repo": "https://github.com/osmosis-labs/osmosis",
    "genesis": {
      "name": "v3",
      "genesis_url": "https://github.com/osmosis-labs/networks/raw/main/osmosis-1/genesis.json"
    },
    "recommended_version": "v25.0.0"
  },
  "images": [
    {
      "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmosis-chain-logo.svg",
      "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmosis-chain-logo.png",
      "theme": {
        "circle": true
      }
    }
  ],
  "peers": {
    "seeds": [
      {
        "id": "83adaa38d1c15450056050fd4c9763fcc7e02e2c",
        "address": "ec2-44-234-84-104.us-west-2.compute.amazonaws.com:26656",
        "provider": "notional"
      },
      ...
      {
        //another peer
      }
    ],
    "persistent_peers": [
      {
        "id": "8f67a2fcdd7ade970b1983bf1697111d35dfdd6f",
        "address": "52.79.199.137:26656",
        "provider": "cosmostation"
      },
      ...
      {
        //another peer
      }
    ]
  },
  "apis": {
    "rpc": [
      {
        "address": "https://osmosis.validator.network/",
        "provider": "validatornetwork"
      },
      ...
      {
        //another rpc
      }
    ],
    "rest": [
      {
        "address": "https://lcd-osmosis.blockapsis.com",
        "provider": "chainapsis"
      },
      ...
      {
        //another rest
      }
    ]
  },
  "explorers": [
    {
      "kind": "mintscan",
      "url": "https://www.mintscan.io/osmosis",
      "tx_page": "https://www.mintscan.io/osmosis/txs/${txHash}",
      "account_page": "https://www.mintscan.io/osmosis/account/${accountAddress}"
    },
    ...
    {
      //another explorer
    }
  ],
  "keywords": [
    "dex"
  ]
}
```

### Guidelines for Properties

#### Bech32 Prefix
Although it is not a requirement that bech32 prefixes be unique, it is highly recommended for each chain to have its bech32 prefix registered at the Satoshi Labs Registry (see [SLIP-0173 : Registered human-readable parts for BIP-0173](https://github.com/satoshilabs/slips/blob/master/slip-0173.md)), or consider picking an uncliamed prefix if the chosen prefix has already be registered to another project.

#### Images
Images must meet specific requirements to be accepted into the chain registry:
- **Square dimensions** (width must equal height)
- **File size < 250 KB**
- **PNG or SVG format only**
- **lowercase filenames**

For complete image requirements, best practices, and examples, see **[IMAGE-GUIDELINES.md](./IMAGE-GUIDELINES.md)**.

# Assetlists

Asset Lists are inspired by the [Token Lists](https://tokenlists.org/) project on Ethereum which helps discoverability of ERC20 tokens by providing a mapping between erc20 contract addresses and their associated metadata.

Asset lists are a similar mechanism to allow frontends and other UIs to fetch metadata associated with Cosmos SDK denoms, especially for assets sent over IBC.

This standard is a work in progress.  You'll notice that the format of `assets` in the assetlist.json structure is a strict superset json representation of the [`banktypes.DenomMetadata`](https://docs.cosmos.network/main/build/architecture/adr-024-coin-metadata) from the Cosmos SDK.  This is purposefully done so that this standard may eventually be migrated into a Cosmos SDK module in the future, so it can be easily maintained on chain instead of on Github.

The assetlist JSON Schema can be found [here](/assetlist.schema.json).

An example assetlist json contains the following structure:

```json
{
  "$schema": "../assetlist.schema.json",
  "chain_name": "osmosis",
  "assets": [
    {
      "description": "The native token of Osmosis",
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
      "type_asset": "sdk.coin",
      "base": "uosmo",
      "name": "Osmosis",
      "display": "osmo",
      "symbol": "OSMO",
      "images": [
        {
          "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png",
          "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.svg",
          "theme": {
            "circle": false
          }
        }
      ],
      "coingecko_id": "osmosis",
      "keywords": [
        "dex",
        "staking"
      ],
      "socials": {
        "website": "https://osmosis.zone",
        "x": "https://x.com/osmosis"
      }
    },
    ..
    {
      "description": "The native staking and governance token of the Cosmos Hub.",
      "denom_units": [
        {
          "denom": "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          "exponent": 0,
          "aliases": [
            "uatom"
          ]
        },
        {
          "denom": "atom",
          "exponent": 6
        }
      ],
      "type_asset": "ics20",
      "base": "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
      "name": "Cosmos Hub",
      "display": "atom",
      "symbol": "ATOM",
      "traces": [
        {
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
      ]
    }
  ]
}
```

## IBC Data

The metadata contained in these files represents a path abstraction between two IBC-connected networks. This information is particularly useful when relaying packets and acknowledgments across chains.

This schema also allows us to provide helpful info to describe open channels.

Note: when creating these files, please ensure the chains in both the file name and the references of `chain-1` and `chain-2` in the json file are in alphabetical order. Ex: `Achain-Zchain.json`. The chain names used must match name of the chain's directory here in the chain-registry.

An example ibc metadata file contains the following structure:

```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_1": {
    "chain_name": "juno",
    "client_id": "07-tendermint-0",
    "connection_id": "connection-0"
  },
  "chain_2": {
    "chain_name": "osmosis",
    "client_id": "07-tendermint-1457",
    "connection_id": "connection-1142"
  },
  "channels": [
    {
      "chain_1": {
        "channel_id": "channel-0",
        "port_id": "transfer"
      },
      "chain_2": {
        "channel_id": "channel-42",
        "port_id": "transfer"
      },
      "ordering": "unordered",
      "version": "ics20-1",
      "tags": {
        "status": "live",
        "preferred": true,
        "dex": "osmosis"
      }
    }
  ]
}
```


## Versions

The versions.json is an optional record of version history for a chain. Through automation (sync_versions), version data will periodically be copid from the chain.json::codebase object into the versions.json file.

An example versions file uses the following structure:

```json
{
  "$schema": "../ibc_data.schema.json",
  "chain_name": "osmosis",
  "versions": [
    {
      "name": "v3",
      "tag": "v3.1.0",
      "height": 0,
      "next_version_name": "v4"
    },
    ...//entire version history, an object for each major version
    {
      "name": "v25",
      "tag": "v25.0.0",
      "proposal": 782,
      "height": 15753500,
      "recommended_version": "v25.0.0",
      "compatible_versions": [
        "v25.0.0"
      ],
      "binaries": {
        "linux/amd64": "https://github.com/osmosis-labs/osmosis/releases/download/v25.0.0/osmosisd-25.0.0-linux-amd64",
        "linux/arm64": "https://github.com/osmosis-labs/osmosis/releases/download/v25.0.0/osmosisd-25.0.0-linux-arm64"
      },
      "previous_version_name": "v24",
      "next_version_name": "v26",
      "consensus": {
        "type": "cometbft",
        "version": "0.37.4",
        "repo": "https::github.com/osmosis-labs/cometbft",
        "tag": "v0.37.4-v25-osmo-2"
      },
      "cosmwasm": {
        "version": "0.45.0",
        "repo": "https://github.com/osmosis-labs/wasmd",
        "tag": "v0.45.0-osmo",
        "enabled": true
      },
      "sdk": {
        "type": "cosmos",
        "version": "0.47.5",
        "repo": "https://github.com/osmosis-labs/cosmos-sdk",
        "tag": "v0.47.5-v25-osmo-1"
      },
      "ibc": {
        "type": "go",
        "version": "7.4.0",
        "ics_enabled": [
          "ics20-1"
        ]
      },
      "language": {
        "type": "go",
        "version": "1.21.4"
      }
    }
  ]
}
```
---

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons Licence" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
