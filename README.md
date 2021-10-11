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
    "genesis": "https://github.com/osmosis-labs/networks/raw/main/osmosis-1/genesis.json",
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
        "recommended_version": "v4.0.0",
        "binaries": {
            "linux/amd64": "https://github.com/osmosis-labs/osmosis/releases/download/v4.0.0/osmosisd-4.0.0-linux-amd64",
            "linux/arm64": "https://github.com/osmosis-labs/osmosis/releases/download/v4.0.0/osmosisd-4.0.0-linux-arm64",
            "darwin/amd64": "https://github.com/osmosis-labs/osmosis/releases/download/v4.0.0/osmosisd-4.0.0-darwin-amd64",
            "windows/arm64": "https://github.com/osmosis-labs/osmosis/releases/download/v4.0.0/osmosisd-4.0.0-windows-amd64.exe"
        }
    },
    "peers": {
        "seeds": [
            {
                "id": "8f67a2fcdd7ade970b1983bf1697111d35dfdd6f",
                "address": "52.79.199.137:26656",
                "provider": "cosmostation"
            },
            {
                "id": "00c328a33578466c711874ec5ee7ada75951f99a",
                "address": "35.82.201.64:26656",
                "provider": "cosmostation"
            },
            {
                "id": "cfb6f2d686014135d4a6034aa6645abd0020cac6",
                "address": "52.79.88.57:26656",
                "provider": "cosmostation"
            }
        ],
        "persistent_peers": []
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
