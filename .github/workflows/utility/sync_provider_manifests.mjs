// sync_provider_manifests.mjs
// Fetch one allowlisted provider's manifest, validate it, health-check every
// entry, and apply the provider-scoped diff to the local checkout.
// The workflow commits the result to auto/provider-manifest/<slug> and opens
// an [AUTO] PR. ONLY MAINTAINERS MERGE.
//
// Invocation:  PROVIDER_NAME="Example Infra" node sync_provider_manifests.mjs
// Exit codes:  0 = changes applied (commit+PR)
//             78 = clean run, no changes (workflow skips PR)
//              1 = hard error (bad manifest, identity mismatch, fetch failure)

import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import * as tls from 'tls';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const REPO_ROOT = path.join(process.cwd(), '..', '..', '..');
const ALLOWLIST = path.join(REPO_ROOT, '_providers', 'provider-allowlist.json');
const MANIFEST_SCHEMA = path.join(REPO_ROOT, 'provider-manifest.schema.json');

const FETCH_TIMEOUT_MS = 10_000;
const MAX_MANIFEST_BYTES = 512 * 1024;
const HEALTH_TIMEOUT_MS = 15_000;

// The ONLY blocks the bot may touch inside a chain.json. Everything else is
// structurally out of reach: we never read or write any other key.
const MANAGED = ['apis', 'peers', 'snapshots'];  // explorers deferred: registry explorer object has no provider field

const providerName = process.env.PROVIDER_NAME;
if (!providerName) { console.error('PROVIDER_NAME env var required'); process.exit(1); }

const report = { provider: providerName, fetched_at: new Date().toISOString(),
                 manifest_url: null, manifest_sha256: null,
                 added: [], updated: [], removed: [], retained: [], held_back: [], unverified: [], conflicts: [], skipped_chains: [] };

// ---------- 1. Allowlist lookup ----------
const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
const entry = allowlist.providers.find(p => p.name === providerName && p.status === 'active');
if (!entry) { console.error(`Provider "${providerName}" not active in allowlist`); process.exit(1); }
report.manifest_url = entry.manifest_url;
const allowedOrigin = new URL(entry.manifest_url).origin;

// ---------- 2. Fetch (size cap, timeout, no cross-origin redirects) ----------
async function fetchManifest(url, hops = 0) {
  if (hops > 5) throw new Error('too many redirects');
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'manual',
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = new URL(res.headers.get('location'), url);
    if (loc.origin !== allowedOrigin) throw new Error(`redirect off-domain: ${loc.origin}`);
    return fetchManifest(loc.href, hops + 1);            // same-origin redirect ok
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_MANIFEST_BYTES) throw new Error(`manifest too large: ${buf.length}B`);
  return buf;
}

let manifestRaw;
try { manifestRaw = await fetchManifest(entry.manifest_url); }
catch (e) { console.error(`Fetch failed: ${e.message}`); writeReport(); process.exit(1); }
report.manifest_sha256 = (await import('crypto')).createHash('sha256').update(manifestRaw).digest('hex');

// ---------- 3. Schema validation (whole-file reject on any error) ----------
const ajv = new Ajv({ strict: false });
addFormats(ajv);
// registry schemas use "https://json-schema.org/draft-07/schema" (https, no #);
// alias it to the built-in draft-07 meta-schema so AJV accepts them as-is
ajv.addMetaSchema(ajv.getSchema('http://json-schema.org/draft-07/schema#').schema,
                  'https://json-schema.org/draft-07/schema');
const validate = ajv.compile(JSON.parse(fs.readFileSync(MANIFEST_SCHEMA, 'utf8')));
let manifest;
try { manifest = JSON.parse(manifestRaw.toString('utf8')); }
catch { console.error('Manifest is not valid JSON'); writeReport(); process.exit(1); }
if (!validate(manifest)) {
  console.error('Schema validation failed:', JSON.stringify(validate.errors, null, 1));
  writeReport(); process.exit(1);
}

// Duplicate chain_id = whole-manifest reject: the schema cannot express
// per-key uniqueness, and processing the same chain twice would make the
// second entry silently undo the first's additions.
const chainIds = manifest.chains.map(c => c.chain_id);
const dupIds = [...new Set(chainIds.filter((id, i) => chainIds.indexOf(id) !== i))];
if (dupIds.length) {
  console.error(`Manifest lists duplicate chain_id(s): ${dupIds.join(', ')}`);
  writeReport(); process.exit(1);
}

// ---------- 4. Identity check (T1 impersonation guard) ----------
if (manifest.provider.name !== providerName) {
  console.error(`Identity mismatch: manifest says "${manifest.provider.name}", allowlist says "${providerName}"`);
  writeReport(); process.exit(1);
}

// ---------- 5. Resolve chain_id -> registry directory ----------
function buildChainIndex() {
  const index = {};
  for (const dirent of fs.readdirSync(REPO_ROOT, { withFileTypes: true })) {
    if (!dirent.isDirectory() || dirent.name.startsWith('.') || dirent.name.startsWith('_')) continue;
    for (const sub of [dirent.name, ...listTestnets(dirent.name)]) {
      const cj = path.join(REPO_ROOT, sub, 'chain.json');
      if (fs.existsSync(cj)) {
        try { index[JSON.parse(fs.readFileSync(cj, 'utf8')).chain_id] = sub; } catch { /* skip */ }
      }
    }
  }
  return index;
}
function listTestnets(top) {
  if (top !== 'testnets') return [];
  return fs.readdirSync(path.join(REPO_ROOT, 'testnets'), { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => path.join('testnets', d.name));
}
const chainIndex = buildChainIndex();

// ---------- 6. Health checks (hard precondition; failures are held back) ----------
// append a path to an endpoint address WITHOUT dropping any existing path prefix
// (new URL('/x', addr) would discard e.g. the '/cosmos/injective/rpc' in
//  https://public.stakewolle.com/cosmos/injective/rpc)
const joinPath = (addr, p) => addr.replace(/\/+$/, '') + p;

async function httpJson(url, opts = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS), ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
// TCP/TLS reachability probe for endpoint types we can't identity-check with a
// plain fetch: grpc is HTTP/2+protobuf, wss is a websocket upgrade, grpc-web
// varies by gateway. This proves ONLY that the socket accepts a connection --
// not which chain it serves (that needs a full gRPC/ws client + reflection).
// Honest reachability, strictly better than the old no-op pass-through.
//   - bare "host:port" (grpc)            -> plain TCP connect
//   - wss:// / https:// (wss, grpc-web)  -> TLS handshake must complete
//   - ws:// / http://                    -> plain TCP connect
function reach(addr) {
  let host, port, useTls;
  if (addr.includes('://')) {
    const u = new URL(addr);
    host = u.hostname;
    useTls = u.protocol === 'wss:' || u.protocol === 'https:';
    port = u.port ? Number(u.port) : (useTls ? 443 : 80);
  } else {
    const i = addr.lastIndexOf(':');
    if (i < 0) return Promise.reject(new Error(`no port in "${addr}"`));
    host = addr.slice(0, i);
    port = Number(addr.slice(i + 1));
    useTls = false;                          // bare host:port (grpc): TCP reach
  }
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535)
    return Promise.reject(new Error(`unparseable address "${addr}"`));
  return new Promise((resolve, reject) => {
    // rejectUnauthorized:false -- this is a reachability probe, not a cert check;
    // we only need the handshake to complete, and identity is out of scope here.
    // Omit SNI for raw IPs (RFC 6066 forbids an IP ServerName; Node warns and will drop it).
    const socket = useTls
      ? tls.connect({ host, port, servername: net.isIP(host) ? undefined : host, timeout: HEALTH_TIMEOUT_MS, rejectUnauthorized: false })
      : net.connect({ host, port, timeout: HEALTH_TIMEOUT_MS });
    const finish = (err, msg) => { socket.destroy(); err ? reject(err) : resolve(msg); };
    socket.once(useTls ? 'secureConnect' : 'connect',
      () => finish(null, `reachable (${useTls ? 'tls' : 'tcp'} ${host}:${port})`));
    socket.once('timeout', () => finish(new Error('timeout')));
    socket.once('error', finish);
  });
}
const checks = {
  async rpc(addr, chainId) {
    const j = await httpJson(joinPath(addr, '/status'));
    const r = j.result ?? j;
    if (r.node_info.network !== chainId) throw new Error(`serves ${r.node_info.network}, claimed ${chainId}`);
    if (r.sync_info.catching_up) throw new Error('catching_up=true');
    return `height ${r.sync_info.latest_block_height}`;
  },
  async rest(addr, _chainId) {
    await httpJson(joinPath(addr, '/cosmos/base/tendermint/v1beta1/node_info'));
    return 'LCD ok';
  },
  async 'evm-http-jsonrpc'(addr) {
    const j = await httpJson(addr, { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }) });
    if (!j.result) throw new Error('no eth_chainId result');
    return `eth_chainId ${j.result}`;
  },
  async grpc(addr) { return reach(addr); },
  async wss(addr) { return reach(addr); },
  async 'grpc-web'(addr) { return reach(addr); },
};
// Advisory snapshot probe. A snapshot is best-effort, provider-owned infra, and
// a liveness check cannot verify its contents — so the probe INFORMS rather than
// gates. Verdicts:
//   verified   - got a 2xx; reachable.
//   dead       - definitively gone (404/410) or host unreachable (only network
//                errors / timeouts, never an HTTP response) -> held back.
//   unverified - reachable but non-2xx (e.g. a WAF returning 403/405/429, or a
//                5xx) -> still synced, flagged, because that is not proof of
//                absence. Tries HEAD then GET (some hosts block HEAD) with a
//                browser-like UA (some WAFs reject default agents), and never
//                downloads the payload.
const SNAPSHOT_UA = 'Mozilla/5.0 (compatible; cosmos-chain-registry-sync/1.0; +https://github.com/cosmos/chain-registry)';
async function probeSnapshot(s) {
  const url = s.latest_url ?? s.url;
  let blockedStatus = null;   // an HTTP status that is reachable-but-not-2xx (403/405/429/5xx)
  let netError = null;        // a network/timeout/DNS error (no HTTP response at all)
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow',
        headers: { 'user-agent': SNAPSHOT_UA }, signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
      if (method === 'GET') { try { await res.body?.cancel(); } catch { /* never download the payload */ } }
      if (res.ok) {
        const len = res.headers.get('content-length');
        return { verdict: 'verified', note: `reachable${len ? `, ${len}B` : ''}` };
      }
      if (res.status === 404 || res.status === 410) return { verdict: 'dead', note: `HTTP ${res.status}` };
      blockedStatus = res.status;
    } catch (err) {
      netError = err.message;
    }
  }
  // No 2xx and no definitive 404/410. A reachable-but-blocked status wins over a
  // network error (a server that answered 403 is present, not dead).
  if (blockedStatus !== null)
    return { verdict: 'unverified', note: `HTTP ${blockedStatus} (check inconclusive; not confirmed dead)` };
  return { verdict: 'dead', note: netError || 'unreachable' };
}

// ---------- 7. Provider-scoped merge ----------
// Rule: within MANAGED blocks, this run owns exactly the entries whose
// `provider` string === providerName. Everything else is copied through
// untouched. Manifest-absence of an owned entry = removal.
const keyOf = {
  endpoint: e => e.address,
  peer: p => `${p.id}@${p.address}`,
  snapshot: s => s.url,
};

function mergeArray(existing = [], desired = [], kind, label, held = new Set()) {
  const ours = new Map(desired.map(d => [keyOf[kind](d), { ...d, provider: providerName }]));
  // keys already registered to a DIFFERENT provider: never claimable here.
  // A new entry colliding with one is reported as a conflict, not added —
  // maintainers adjudicate. Prevents attribution squatting on live infra
  // (health checks can't discriminate: the endpoint is up regardless of
  // who claims it).
  const foreign = new Map(existing.filter(e => e.provider !== providerName)
                                  .map(e => [keyOf[kind](e), e.provider ?? '(unattributed)']));
  const out = [];
  for (const cur of existing) {
    if (cur.provider !== providerName) { out.push(cur); continue; }   // other providers: untouchable
    const k = keyOf[kind](cur);
    if (ours.has(k)) {
      const next = ours.get(k); ours.delete(k);
      if (JSON.stringify(next) !== JSON.stringify(cur)) report.updated.push(`${label}: ${k}`);
      out.push(next);
    } else if (held.has(k)) {
      // still in the manifest but failed THIS run's health check: keep the
      // existing entry — the health gate guards what ENTERS; only
      // manifest-absence removes. Prevents flip-flop removal on transient blips.
      out.push(cur);
      report.retained.push(`${label}: ${k} (health check failed this run; kept — still in manifest)`);
    } else {
      report.removed.push(`${label}: ${k}`);                          // absent from manifest = removed
    }
  }
  for (const [k, next] of ours) {
    if (foreign.has(k)) {
      report.conflicts.push(`${label}: ${k} (already registered to "${foreign.get(k)}" — NOT added; maintainer adjudication required)`);
      continue;
    }
    report.added.push(`${label}: ${k}`); out.push(next);
  }
  return out;
}

let anyChange = false;
for (const chain of manifest.chains) {
  const dir = chainIndex[chain.chain_id];
  if (!dir) { report.skipped_chains.push(chain.chain_id); continue; }  // never create chains
  const cjPath = path.join(REPO_ROOT, dir, 'chain.json');
  const cj = JSON.parse(fs.readFileSync(cjPath, 'utf8'));

  // health-gate the manifest's desired entries first; remember what failed so
  // the merge can RETAIN (not remove) already-registered entries that blipped
  const desired = { apis: {}, peers: {}, snapshots: [] };
  const heldKeys = {};                                   // slot -> Set of entry keys
  const markHeld = (slot, k) => (heldKeys[slot] ??= new Set()).add(k);
  for (const [apiType, entries] of Object.entries(chain.apis ?? {})) {
    desired.apis[apiType] = [];
    for (const e of entries) {
      try {
        const evidence = await (checks[apiType] ?? (async () => 'unchecked'))(e.address, chain.chain_id);
        desired.apis[apiType].push(e);
        console.log(`  ok  ${chain.chain_id} ${apiType} ${e.address} (${evidence})`);
      } catch (err) {
        report.held_back.push({ chain: chain.chain_id, type: apiType, address: e.address, reason: err.message });
        markHeld(`apis.${apiType}`, e.address);
        console.log(`  HELD ${chain.chain_id} ${apiType} ${e.address}: ${err.message}`);
      }
    }
  }
  for (const [peerType, entries] of Object.entries(chain.peers ?? {})) desired.peers[peerType] = entries;
  for (const s of chain.snapshots ?? []) {
    const { verdict, note } = await probeSnapshot(s);
    // `address` stays s.url — the snapshot's identity key, matching the merge
    // and the added/removed lines. When a different latest_url was the URL
    // actually probed, name it in the note so a maintainer can reproduce.
    const reason = s.latest_url && s.latest_url !== s.url ? `${note} [probed ${s.latest_url}]` : note;
    if (verdict === 'dead') {
      report.held_back.push({ chain: chain.chain_id, type: 'snapshot', address: s.url, reason });
      markHeld('snapshots', s.url);
    } else {
      desired.snapshots.push(s);   // verified or unverified: snapshots are advisory, so sync them
      if (verdict === 'unverified')
        report.unverified.push({ chain: chain.chain_id, type: 'snapshot', address: s.url, reason });
    }
  }

  const before = JSON.stringify([cj.apis, cj.peers, cj.snapshots]);
  cj.apis ??= {};
  for (const t of ['rpc', 'rest', 'grpc', 'wss', 'grpc-web', 'evm-http-jsonrpc'])
    if ((desired.apis[t] ?? []).length || (cj.apis[t] ?? []).some(e => e.provider === providerName))
      cj.apis[t] = mergeArray(cj.apis[t], desired.apis[t], 'endpoint', `${chain.chain_id}/apis.${t}`, heldKeys[`apis.${t}`]);
  cj.peers ??= {};
  for (const t of ['seeds', 'persistent_peers'])
    if ((desired.peers[t] ?? []).length || (cj.peers[t] ?? []).some(p => p.provider === providerName))
      cj.peers[t] = mergeArray(cj.peers[t], desired.peers[t], 'peer', `${chain.chain_id}/peers.${t}`);
  if (desired.snapshots.length || (cj.snapshots ?? []).some(s => s.provider === providerName))
    cj.snapshots = mergeArray(cj.snapshots, desired.snapshots, 'snapshot', `${chain.chain_id}/snapshots`, heldKeys['snapshots']);
  // drop blocks we created but left empty (cosmetics: never write "peers": {})
  for (const block of ['apis', 'peers']) {
    for (const k of Object.keys(cj[block] ?? {})) if (!cj[block][k]?.length) delete cj[block][k];
    if (cj[block] && !Object.keys(cj[block]).length) delete cj[block];
  }
  if (cj.snapshots && !cj.snapshots.length) delete cj.snapshots;

  if (JSON.stringify([cj.apis, cj.peers, cj.snapshots]) !== before) {
    fs.writeFileSync(cjPath, JSON.stringify(cj, null, 2) + '\n');
    anyChange = true;
  }
}

// ---------- 8. Report + exit ----------
function writeReport() {
  // NEVER write inside the checkout — the commit-push action stages `add -A`
  const dir = process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp';
  fs.writeFileSync(path.join(dir, `sync-report-${providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`),
    JSON.stringify(report, null, 2));
}
writeReport();
console.log(`\nSummary: +${report.added.length} ~${report.updated.length} -${report.removed.length}, retained ${report.retained.length}, held back ${report.held_back.length}, conflicts ${report.conflicts.length}, skipped chains ${report.skipped_chains.length}`);
process.exit(anyChange ? 0 : 78);
