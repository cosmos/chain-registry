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
- https://proxy.atomscan.com/directory/ (Update every 24H)
- https://cosmoschains.thesilverfox.pro (Updated every 24H)

## APIs
- https://github.com/cmwaters/skychart
- https://github.com/empowerchain/cosmos-chain-directory
- https://github.com/effofxprime/Cosmregistry-API

## Web Interfaces
- https://cosmos.directory
- https://chain-registry.netlify.com
- https://atomscan.com/directory

## Tooling
- https://github.com/gaia/chain-registry-query/

## Contributing

We accept pull requests to add data to an existing assetlist.json or chain.json (especially to add peer data or public rpc endpoint) or to add a new chain or asset.

Please give Pull Requests a title that somewhat describes the change more precisely than the default title given to a Commit. PRs titled 'Update chain.json' are insufficient, and would be difficult to navigate when searching through the backlog of Pull Requests. Some recommended details would be: the affected Chain Name, API types, or Provider to give some more detail; e.g., "Add Cosmos Hub APIs for Acme Validator".

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
    "recommended_version": "v12.2.0",
    "compatible_versions": [
      "v12.1.0"
      "v12.2.0"
    ],
    "cosmos_sdk_version": "0.46",
    "consensus": {
      "type": "tendermint",
      "version": "0.34"
    },
    "cosmwasm_version": "0.28",
    "cosmwasm_enabled": true,
    "ibc_go_version": "3.0.0",
    "ics_enabled": [
      "ics20-1"
    ],
    "genesis": {
      "name": "v3",
      "genesis_url": "https://github.com/osmosis-labs/networks/raw/main/osmosis-1/genesis.json"
    },
    "versions": [
      {
        "name": "v3",
        "tag": "v3.1.0",
        "height": 0,
        "next_version_name": "v4"
      },
      ...//version history can alternatively go into 'versions.json'
      {
        "name": "v12",
        "tag": "v12.1.0",
        "height": 6246000,
        "proposal": 335,
        "recommended_version": "v12.2.0",
        "compatible_versions": [
          "v12.1.0"
          "v12.2.0"
        ],
        "cosmos_sdk_version": "0.46",
        "consensus": {
          "type": "tendermint",
          "version": "0.34"
        },
        "cosmwasm_version": "0.28",
        "cosmwasm_enabled": true,
        "ibc_go_version": "3.0.0",
        "ics_enabled": [
          "ics20-1"
        ],
        "next_version_name": "v13"
      }
    ]
  },
  "images": [
    {
      "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmosis-chain-logo.png",
      "theme": {
        "primary_color_hex": "#231D4B"
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
      {
        "id": "f515a8599b40f0e84dfad935ba414674ab11a668",
        "address": "osmosis.blockpane.com:26656",
        "provider": "blockpane"
      }
    ],
    "persistent_peers": [
      {
        "id": "8f67a2fcdd7ade970b1983bf1697111d35dfdd6f",
        "address": "52.79.199.137:26656",
        "provider": "cosmostation"
      },
      {
        "id": "8d9967d5f865c68f6fe2630c0f725b0363554e77",
        "address": "134.255.252.173:26656",
        "provider": "divecrypto"
      },
      ...
      ...
      {
        "id": "64d36f3a186a113c02db0cf7c588c7c85d946b5b",
        "address": "209.97.132.170:26656",
        "provider": "solidstake"
      },
      {
        "id": "4d9ac3510d9f5cfc975a28eb2a7b8da866f7bc47",
        "address": "37.187.38.191:26656",
        "provider": "stakelab"
      }
    ]
  },
  "apis": {
    "rpc": [
      {
        "address": "https://osmosis.validator.network/",
        "provider": "validatornetwork"
      },
      {
        "address": "https://rpc-osmosis.blockapsis.com",
        "provider": "chainapsis"
      }
    ],
    "rest": [
      {
        "address": "https://lcd-osmosis.blockapsis.com",
        "provider": "chainapsis"
      }
    ],
    "grpc": [
      {
        "address": "osmosis.strange.love:9090",
        "provider": "strangelove"
      }
    ]
  },
  "explorers": [
    {
      "kind": "mintscan",
      "url": "https://www.mintscan.io/osmosis",
      "tx_page": "https://www.mintscan.io/osmosis/txs/${txHash}",
      "account_page": "https://www.mintscan.io/osmosis/account/${accountAddress}"
    }
  ],
  "keywords": [
    "dex"
  ]
}
```

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
      "base": "uosmo",
      "name": "Osmosis",
      "display": "osmo",
      "symbol": "OSMO",
      "images": [
        {
          "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png",
          "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.svg",
          "theme": {
            "primary_color_hex": "#5c09a0"
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
        "twitter": "https://twitter.com/osmosiszone"
      }
    },
    {
      "denom_units": [
        {
          "denom": "uion",
          "exponent": 0
        },
        {
          "denom": "ion",
          "exponent": 6
        }
      ],
      "base": "uion",
      "name": "Ion",
      "display": "ion",
      "symbol": "ION",
      "images": [
        {
          "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/ion.png",
          "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/ion.svg",
          "theme": {
            "primary_color_hex": "#3f97fc"
          }
        }
      ],
      "coingecko_id": "ion",
      "keywords": [
        "memecoin",
        "defi"
      ],
      "socials": {
        "website": "https://ion.wtf",
        "twitter": "https://twitter.com/_IONDAO"
      }
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

---

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons Licence" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
