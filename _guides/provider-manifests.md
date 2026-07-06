# Provider Manifests

*Status: prototype. Opt-in convenience for multi-chain infrastructure providers. The classic manual-PR flow is unchanged and remains the default.*

## What this is

If you operate public infrastructure (RPC/REST/gRPC endpoints, seeds, peers, snapshots) across many chains, you can publish **one JSON manifest on your own domain** instead of opening a registry PR for every change. A scheduled workflow fetches allowlisted manifests, validates them, health-checks every entry, and opens an `[AUTO]` PR with the resulting diff.

**Nothing merges automatically.** Every sync PR is merged by a registry maintainer, exactly like a manual PR.

## What a manifest can and cannot contain

**Can (your operational data, per `chain_id`):**

| Block | Contents |
|---|---|
| `apis` | `rpc`, `rest`, `grpc`, `wss`, `grpc-web`, `evm-http-jsonrpc` endpoints you run |
| `peers` | `seeds`, `persistent_peers` (node `id` must be 40-char hex) |
| `snapshots` | `url`, `latest_url`, `type`, `db_backend`, `compression`, `frequency`, `checksum_available` |

**Cannot (rejected at schema level):** explorers (deferred from v1 — the registry explorer object carries no provider-attribution field yet), chain identity, `fees`, `staking`, `slip44`, assets, images, IBC data, codebase/versions, new chains — and **any other provider's entries**. Your manifest may not even contain a `provider` field on entries: the bot stamps your allowlisted name on everything it injects, so you can only ever write in your own lane.

## Semantics you must understand before opting in

1. **Your manifest is the source of truth for your lane — per listed chain.** If an endpoint disappears from your manifest while its chain is still listed, the next sync PR **removes it** (a feature: dead endpoints finally get cleaned up). Omitting an entire chain from your manifest leaves that chain's existing entries untouched — nothing is mass-deleted just because your first manifest covers only some of your chains.
2. **Entries failing health checks are held back — never destructively.** At sync time, RPCs must report your claimed `chain_id` and `catching_up: false`; REST must answer LCD queries; snapshot `latest_url` must exist. A failing entry is not **added** that run; if it is already in the registry and still in your manifest, it is **kept** (a transient blip never removes an entry — removal happens only when you delete it from your manifest). Every added/updated/removed/retained/held-back entry is itemized in the sync PR body and the run's report artifact.
3. **Your allowlisted name is canonical.** It is stamped verbatim on every entry — pick the exact capitalization you want once.
4. **Suspension is immediate.** Maintainers can freeze ingestion of your manifest at any time by flipping `status: suspended` in the allowlist.

## How to onboard

1. **Author your manifest** following [`provider-manifest.schema.json`](../provider-manifest.schema.json):

```jsonc
// https://<your-domain>/.well-known/cosmos-registry.json
{
  "manifest_version": "1.0.0",
  "provider": { "name": "Example Infra", "website": "https://example.com" },
  "chains": [
    {
      "chain_id": "cosmoshub-4",
      "apis": {
        "rpc":  [{ "address": "https://cosmos-rpc.example.com" }],
        "rest": [{ "address": "https://cosmos-api.example.com" }]
      },
      "peers": {
        "seeds": [{ "id": "ade4d8bc8cbe014af6ebdf3cb7b1e9ad36f412c0", "address": "seeds.example.com:26656" }]
      },
      "snapshots": [{
        "url": "https://example.com/snapshots/cosmos",
        "latest_url": "https://snapshots.example.com/cosmos/latest.tar.lz4",
        "type": "pruned",
        "db_backend": "pebbledb",
        "compression": "lz4",
        "frequency": "daily",
        "checksum_available": true
      }]
    }
  ]
}
```

2. **Validate locally:**

```bash
npx ajv-cli validate --spec=draft7 -c ajv-formats \
  -s provider-manifest.schema.json -d your-manifest.json
```

3. **Host it over HTTPS on a domain you control.** The recommended path is `/.well-known/cosmos-registry.json`, but any stable HTTPS URL on your domain works. Keep it under 512 KB; the bot does not follow redirects off your domain.

4. **Open one onboarding PR** adding yourself to [`_providers/provider-allowlist.json`](../_providers/provider-allowlist.json):

```json
{
  "name": "Example Infra",
  "manifest_url": "https://example.com/.well-known/cosmos-registry.json",
  "status": "active",
  "added_by_pr": 1234
}
```

The reviewing maintainer will verify the domain is genuinely yours (existing PR track record, website, on-chain identity, or other evidence).

5. **Done.** The sync workflow fetches your manifest on schedule and opens `[AUTO]` PRs when your data changes. You maintain one file on your side; maintainers keep the merge.

## Trust model (short version)

- **Allowlist is curated** — this is not open enrollment; providers are onboarded on existing track record.
- **Provider-scoped writes** — a manifest can only add/update/remove entries carrying its own provider name; the curated core of the registry is not expressible in the manifest format.
- **Independent CI check** — every sync PR is re-verified by CI to touch only `apis`/`peers`/`snapshots` entries belonging to that provider.
- **Maintainer merge gate** — the bot cannot approve or merge its own PRs.
- **Signature-ready** — the manifest format reserves a `signature` block (and the allowlist a `public_key` slot) so signed manifests can be required later without a format change.

## FAQ

**I run one chain. Should I use this?**
Probably not — a manifest is more work than the one or two PRs a year you'd otherwise open. This exists for providers maintaining entries across many chains.

**Does this replace my existing registry entries?**
Entries carrying your provider name become managed by your manifest once you onboard (including removal if absent). Entries under other names are untouched.

**What if my manifest is temporarily unreachable?**
The run skips you and reports; nothing is removed just because the fetch failed. Repeated consecutive failures open an issue for follow-up.
