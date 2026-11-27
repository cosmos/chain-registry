# Finding RPC endpoints for historical queries

An endpoint listed in `chain.json` is a discovery starting point, not a guarantee
of archive access. The registry's reachability checks do not establish historical
retention or transaction-index coverage. Start with the chain's `apis.rpc` list,
then check the particular data and height your application needs.

## Different kinds of historical data

| Data needed | Read-only RPC check | What success establishes |
| --- | --- | --- |
| A block and its transactions | `/block?height=H` | The block is available at H. |
| Execution results and events | `/block_results?height=H` | The node retains block results at H. Event fields vary by CometBFT version. |
| A transaction by hash | `/tx?hash=0xHASH&prove=false` | That transaction is retrievable from the node's transaction index. |
| Transactions matching indexed events | `/tx_search?query=...` | The query can find those indexed transactions. Not every event is indexed. |

Historical application state is a separate capability. Verify it using the
chain's relevant application query at the desired height; a successful block or
transaction lookup does not establish state-query availability.

`/status` reports the chain ID, synchronization status and block-store bounds.
In particular, `sync_info.earliest_block_height` is not the earliest indexed
transaction height or a guarantee of historical application state. A value of
zero must not be treated as proof of a complete archive.

## Discover candidates and check a height

The examples require `curl` and `jq`. From a checkout of this repository, list
candidate RPC providers for a chain (Osmosis is used here):

```sh
jq -r '.apis.rpc[] | [.provider, .address] | @tsv' osmosis/chain.json
```

Choose an endpoint, supply a height you need, and confirm the chain ID returned
by `/status` matches `chain.json`. Respect the provider's access policy and rate
limits. These examples make individual requests, not a scan of every provider.

```sh
RPC_URL='https://rpc.example.org' # Replace with a candidate RPC endpoint.
HEIGHT=37000000                  # Replace with the historical height you need.
RPC_URL="${RPC_URL%/}"

curl --fail --silent --show-error --max-time 20 "$RPC_URL/status" | jq .

curl --fail --silent --show-error --max-time 20 --get "$RPC_URL/block" \
  --data-urlencode "height=$HEIGHT" | jq .

curl --fail --silent --show-error --max-time 20 --get "$RPC_URL/block_results" \
  --data-urlencode "height=$HEIGHT" | jq .
```

Inspect the JSON-RPC `error` field as well as the HTTP status: a server can return
HTTP 200 with an RPC error. If `curl --fail` reports an HTTP error, repeat the
request without `--fail` to inspect any error body. A timeout, authentication error or rate limit says
nothing conclusive about retention. A successful response at one height does not
establish coverage of every earlier height.

## Check transaction indexing independently

Use a transaction hash known to have been included at your target height. Obtain
it from a trusted record or compute it from transaction bytes in the block; do
not use the block hash as a transaction hash. Set `TX_HASH` to the hex transaction
hash without a `0x` prefix:

```sh
TX_HASH='REPLACE_WITH_KNOWN_TRANSACTION_HASH'

curl --fail --silent --show-error --max-time 20 --get "$RPC_URL/tx" \
  --data-urlencode "hash=0x$TX_HASH" \
  --data-urlencode 'prove=false' | jq .

curl --fail --silent --show-error --max-time 20 --get "$RPC_URL/tx_search" \
  --data-urlencode "query=\"tx.height=$HEIGHT\"" \
  --data-urlencode 'per_page="1"' \
  --data-urlencode 'prove=false' | jq .
```

A nonempty search result demonstrates indexed data for that query and height.
An empty result is inconclusive: the block might contain no transactions, or the
query might not match retained/indexed data. An explicit indexing-disabled error
means the endpoint cannot serve this lookup. A missing known transaction is a
reason to investigate retention with the provider, not proof that the transaction
never occurred.

For IBC recovery, verify the particular event attributes you need (for example,
source port/channel and packet sequence) against a known transaction. A working
height query alone does not prove that those event attributes are searchable.
Requesting transaction proofs can additionally require retained block data; the
examples use `prove=false` to check indexing separately.

## Record and confirm the result

Record the endpoint/provider, chain ID, UTC check time, tested height, known
transaction hash or event query, response/error and any access requirements.
Separate observations about blocks, block results, transaction indexes and
application state. Avoid publishing credentials in an issue or PR.

If the listed endpoints do not provide the data, ask the chain community or RPC
operators for the specific capability and height. Confirm their retention and
indexing policy before relying on an endpoint for ongoing archival work. Do not
remove an otherwise healthy endpoint just because it does not serve archives.

This guide does not introduce new registry fields or certify archive providers.
Schema changes and retention metadata should be discussed with the Chain Registry
Working Group before being added.

## References

- [Archive discovery discussion (issue #7647)](https://github.com/cosmos/chain-registry/issues/7647)
- [CometBFT v0.38 status implementation](https://github.com/cometbft/cometbft/blob/v0.38.17/rpc/core/status.go)
- [CometBFT v0.38 transaction lookup and search implementation](https://github.com/cometbft/cometbft/blob/v0.38.17/rpc/core/tx.go)
