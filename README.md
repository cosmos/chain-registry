# Chain Registry

This repo contains a `chain.json` and `assetlist.json` for a number of cosmos-sdk based chains.  A `chain.json` contains data that makes it easy to start running or interacting with a node.

Schema files containing the recommended metadata structure can be found in the `*.schema.json` files located in the root directory. Schemas are still undergoing revision as user needs are surfaced. Optional fields may be added beyond what is contained in the schema files.

Once schemas have matured and client needs are better understood Chain Registry data is intended to migrate to an on-chain representation hosted on the Cosmos Hub, i.e. the Cosmos Chain Name Service. If you are interested in this effort please join the discussion [here](https://github.com/cosmos/chain-registry/issues/291)!

## Web Endpoints
- https://registry.ping.pub (Update every 24H)

## APIs
- https://github.com/cmwaters/skychart
- https://github.com/empowerchain/cosmos-chain-directory

## Web Interfaces
- https://cosmos.directory
- https://chain-registry.netlify.com

## Contributing

We accept pull requests to add data to an existing assetlist.json or chain.json (especially to add peer data or public rpc endpoint) or to add a new chain.

# chain.json

## Sample

A sample `chain.json` includes the following information.

```json
{
    "$schema": "../chain.schema.json",
    "chain_name": "osmosis",
    "status": "live",
    "network_type": "mainnet",
    "pretty_name": "Osmosis",
    "chain_id": "osmosis-1",
    "bech32_prefix": "osmo",
    "daemon_name": "osmosisd",
    "node_home": "$HOME/.osmosisd",
    "genesis": {
        "genesis_url": "https://github.com/osmosis-labs/networks/raw/main/osmosis-1/genesis.json"
    },
    "key_algos": [
        "secp256k1"
    ],
    "slip44": 118,
    "fees": {
        "fee_tokens": [
            {
                "denom": "uosmo",
                "fixed_min_gas_price": 0
            }
        ]
    },
    "codebase": {
        "git_repo": "https://github.com/osmosis-labs/osmosis",
        "recommended_version": "v4.1.0",
        "compatible_versions": [
            "v4.0.0",
            "v4.1.0"
        ],
        "binaries": {
            "linux/amd64": "https://github.com/osmosis-labs/osmosis/releases/download/v4.0.0/osmosisd-4.0.0-linux-amd64",
            "linux/arm64": "https://github.com/osmosis-labs/osmosis/releases/download/v4.0.0/osmosisd-4.0.0-linux-arm64",
            "darwin/amd64": "https://github.com/osmosis-labs/osmosis/releases/download/v4.0.0/osmosisd-4.0.0-darwin-amd64",
            "windows/amd64": "https://github.com/osmosis-labs/osmosis/releases/download/v4.0.0/osmosisd-4.0.0-windows-amd64.exe"
        }
    },
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
            {
                "id": "785bc83577e3980545bac051de8f57a9fd82695f",
                "address": "194.233.164.146:26656",
                "provider": "forbole"
            },
            {
                "id": "778fdedf6effe996f039f22901a3360bc838b52e",
                "address": "161.97.187.189:36657",
                "provider": "kalpatech"
            },
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
    "logo_URIs": {
        "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmosis-chain-logo.png",
        "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmosis-chain-logo.svg"
    }
}
```

# Assetlists

Asset Lists are inspired by the [Token Lists](https://tokenlists.org/) project on Ethereum which helps discoverability of ERC20 tokens by providing a mapping between erc20 contract addresses and their associated metadata.

Asset lists are a similar mechanism to allow frontends and other UIs to fetch metadata associated with Cosmos SDK denoms, especially for assets sent over IBC.

This standard is a work in progress.  You'll notice that the format of `assets` in the assetlist.json structure is a strict superset json representation of the [`banktypes.DenomMetadata`](https://docs.cosmos.network/master/architecture/adr-024-coin-metadata.html) from the Cosmos SDK.  This is purposefully done so that this standard may eventually be migrated into a Cosmos SDK module in the future, so it can be easily maintained on chain instead of on Github.

The assetlist JSON Schema can be found [here](/assetlist.schema.json).

An example assetlist json contains the following structure:

```
{
    "chain_name": "steak-chain-1",
    "assets": [
        {
            "description": "The native token of Steak Chain",
            "denom_units": [
                {
                    "denom": "usteak",
                    "exponent": 0,
                    "aliases": []
                },
                {
                    "denom": "steak",
                    "exponent": 6,
                    "aliases": []
                }
            ],
            "base": "usteak",
            "display": "steak",
            "symbol": "STK",
            "logo_URIs": {
                "png": "https://github.com/linkto/image.png",
                "svg": "https://stake.com/linkto/steak.svg"
            }
        },
        {
            "description": "Foocoin is the native token of the Foochain",
            "denom_units": [
                {
                    "denom": "ibc/6ED71011FFBD0D137AFDB6AC574E9E100F61BA3DD44A8C05ECCE7E59D40A7B3E",
                    "exponent": 0,
                    "aliases": ["ufoocoin"]
                },
                {
                    "denom": "foocoin",
                    "exponent": 6,
                    "aliases": []
                }
            ],
            "base": "ibc/6ED71011FFBD0D137AFDB6AC574E9E100F61BA3DD44A8C05ECCE7E59D40A7B3E",
            "display": "foocoin",
            "symbol": "FOO",
            "ibc": {
                "source_channel": "channel-35",
                "dst_channel": "channel-1",
                "source_denom": "ufoocoin"
            },
            "logo_URIs": {
                "png": "ipfs://QmXfzKRvjZz3u5JRgC4v5mGVbm9ahrUiB4DgzHBsnWbTMM",
                "svg": ""
            }
        }
    ]
}
```

## IBC Data

The metadata contained in these files represents a path abstraction between two IBC-connected networks. This information is particularly useful when relaying packets and acknowledgments across chains.

This schema also allows us to provide helpful info to describe open channels.

Note: when creating these files, please ensure the the chains in both the file name and the references of `chain-1` and `chain-2` in the json file are in alphabetical order. Ex: `Achain-Zchain.json`. The chain names used must match name of the chain's directory here in the chain-registry.

An example ibc metadata file contains the following structure:

```json
{
    "$schema": "../ibc_data.schema.json",
    "chain-1": {
      "chain-name": "juno",
      "client-id": "07-tendermint-0",
      "connection-id": "connection-0"
    },
    "chain-2": {
      "chain-name": "osmosis",
      "client-id": "07-tendermint-1457",
      "connection-id": "connection-1142"
    },
    "channels": [
      {
        "chain-1": {
          "channel-id": "channel-0",
          "port-id": "transfer"
        },
        "chain-2": {
          "channel-id": "channel-42",
          "port-id": "transfer"
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
