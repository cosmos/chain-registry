# chain-registry

This repo contains a `chain.json` for a number of cosmos-sdk based chains.  A `chain.json` contains data that makes it easy to start running or interacting with a node.

## Contributing

We accept pull requests to add data to an existing chain.json (especially to add peer data or public rpc endpoint) or to add a new chain.

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
                "address": "https://rpc-osmosis.keplr.app",
                "provider": "chainapsis"
            }
        ],
        "rest": [
            {
                "address": "https://lcd-osmosis.keplr.app",
                "provider": "chainapsis"
            }
        ]
    },
    "explorers": [
        {
            "kind": "mintscan",
            "url": "https://www.mintscan.io/osmosis",
            "tx_page": "https://www.mintscan.io/osmosis/txs/${txHash}"
        }
    ]
}
```
