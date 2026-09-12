# Do-Chain Chain Registry Submission Notes

This folder is a draft payload for a Cosmos chain-registry PR:

- `chain.json`
- `assetlist.json`
- `images/dochain.svg`

## Facts Already Checked

- Public RPC status responded on `https://www.do-chain.com/rpc/status`.
- Public LCD node info responded on `https://www.do-chain.com/lcd/cosmos/base/tendermint/v1beta1/node_info`.
- Live app version from LCD: `1.0.2-v25`.
- Live CometBFT version from RPC node info: `0.38.19`.
- Live IBC transfer params are enabled: `send_enabled: true`, `receive_enabled: true`.
- Open ICS-20 channels were found on live LCD.
- Genesis URL: `https://www.do-chain.com/genesis.json`.
- Genesis SHA-256: `a5503d4f02da6b80dadc4b302354d92355b2b2de21c03c5d603e2348c36d6b28`.

## Before Opening The PR

1. Fork `https://github.com/cosmos/chain-registry`.
2. Copy this folder to `chain-registry/dochain`.
3. Confirm whether `slip44: 888` is formally acceptable for upstream registry review.
4. Confirm whether the Do-Chain account public key prefixes are exactly `dopub`, `dovaloperpub`, and `dovalconspub`.
5. Add a dedicated DODx logo if you want DODx routed/listed independently by wallets and SkipGo.
6. Consider adding explorers and snapshots if you want richer wallet support.
7. Run the upstream validation workflow from the chain-registry repo.

## Open IBC Channels Observed On 2026-09-12

| Do-Chain channel | Connection | Counterparty chain | Counterparty channel | Port |
| --- | --- | --- | --- | --- |
| `channel-0` | `connection-0` | `columbus-5` | `channel-138` | `transfer` |
| `channel-1` | `connection-0` | `columbus-5` | `channel-139` | `transfer` to Terra wasm port |
| `channel-2` | `connection-1` | `osmosis-1` | `channel-110565` | `transfer` |
| `channel-3` | `connection-3` | `injective-1` | `channel-467` | `transfer` |
| `channel-4` | `connection-4` | `columbus-5` | `channel-140` | `transfer` |
| `channel-5` | `connection-4` | `columbus-5` | `channel-141` | `transfer` to Terra wasm port |
| `channel-9` | `connection-5` | `cosmoshub-4` | `channel-1923` | `transfer` |
| `channel-10` | `connection-6` | `dungeon-1` | `channel-5319` | `transfer` |

Do-Chain also has wasm-port channels `channel-6`, `channel-7`, and `channel-8`; those are not ordinary `transfer` port channels and should not be presented as canonical asset routes without relayer/operator confirmation.
