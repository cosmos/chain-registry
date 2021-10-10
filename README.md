# tm-networks

This repo contains a `chain.json` for a number of tendermint based chains.  A `chain.json` contains data that makes it easy to start running or interacting with a node.

## Contributing

We accept pull requests to add data to an existing chain.json (especially to add peer data or public rpc endpoint) or to add a new chain.

## Sample

A sample `chain.json` includes the following information.

```json
{
    "$schema": "../chain.schema.json",
    "chain_name": "foocoin",
    "status": "live",
    "network_type": "mainnet",
    "pretty_name": "Foocoin",
    "chain_id": "foocoin-1",
    "bech32_prefix": "foo",
    "daemon_name": "food",
    "node_home": "$HOME/.food",
    "genesis": "https://github.com/foochain-labs/networks/raw/main/foocoin-1/genesis.json",
    "codebase": {
        "git_repo": "https://github.com/foochain-labs/foocoin",
        "version": "v1.0.2",
        "binaries": {
            "linux/amd64": "https://github.com/foochain-labs/foocoin/releases/download/v1.0.2/osmosisd-1.0.2-linux-amd64"
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
                "provider": "figment"
            }
        ]
    },
    "apis": {
        "rpc": [
            {
                "address": "https://foocoin.figment.network/",
                "provider": "figment"
            }
        ],
        "rest": [
            {
                "address": "https://lcd.foo.network/",
                "provider": "foofoundation"
            }
        ]
    }
}
```