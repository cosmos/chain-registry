# tm-networks

This repo contains a `chain.json` for a number of tendermint based chains.  A `chain.json` contains data that makes it easy to start running or interacting with a node.

## Contributing

We accept pull requests to add data to an existing chain.json (especially to add peer data or public rpc endpoint) or to add a new chain.

## Sample

A sample `chain.json` includes the following information.

```json
{
    "status": "active|upcoming|killed",
    "network_type": "mainnet|testnet",
    "chain_name": "Chain Name",
    "chain_id": "chainid-1",
    "bech32_prefix": "cosmos",
    "daemon_name": "gaiad",
    "node_home": "$HOME/.gaia",
    "genesis": {
        "genesis_url": "http://linktochaingenesis.com/genesis.json",
        "genesis_zipped": false
    },
    "codebase": {
        "git_repo": "https://github.com/chain/chain/",
        "git_version": "v1.0.1",
        "binaries": {
            "linux/amd64": "https://linktobinany.com/binary.tar.gz"
        }
    },
    "peers": {
        "seeds": [
            "0000000000000000000000000000000000000000@1.1.1.1:26656"
        ],
        "persistent_peers": [
            "0000000000000000000000000000000000000000@2.2.2.2:26656"
        ]
    },
    "apis": {
        "rpc_addrs": [
            "http://rpc.chain.com:26657"
        ],
        "grpc_addrs": [
            "http://rest.chain.com:9090"
        ],
        "rest_addrs": [
            "http://rest.chain.com:1317"
        ]
    }
}
```