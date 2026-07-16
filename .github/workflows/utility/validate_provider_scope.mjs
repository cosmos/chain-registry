// validate_provider_scope.mjs
// Independent CI guard for provider-manifest sync PRs (threat T6: even a
// compromised bot/token cannot land an out-of-lane change past this check).
//
// Recomputes the base..head diff from scratch and FAILS unless EVERY change:
//   1. touches only */chain.json files (sync reports live in RUNNER_TEMP and
//      never enter the checkout),
//   2. touches only the managed blocks: apis / peers / snapshots,
//   3. only adds/updates/removes entries whose `provider` === EXPECTED_PROVIDER,
//   4. never adds an entry whose identity key (address / id@address / url) is
//      already registered to a DIFFERENT provider in the base revision — the
//      bot reports such collisions as conflicts instead of adding them, so a
//      diff containing one means the bot was bypassed or compromised.
//
// Invocation (from repo root, in a PR checkout with the base ref fetched):
//   EXPECTED_PROVIDER="Example Infra" BASE_SHA=<sha> HEAD_SHA=<sha> node .github/workflows/utility/validate_provider_scope.mjs

import { execSync } from 'child_process';

const provider = process.env.EXPECTED_PROVIDER;
const base = process.env.BASE_SHA, head = process.env.HEAD_SHA;
if (!provider || !base || !head) { console.error('EXPECTED_PROVIDER, BASE_SHA, HEAD_SHA required'); process.exit(1); }

const MANAGED = ['apis', 'peers', 'snapshots'];  // explorers deferred (no provider field in registry explorer object)
const violations = [];

const changedFiles = execSync(`git diff --name-only ${base} ${head}`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);

for (const file of changedFiles) {
  // Rule 1: file allowlist
  if (!/^(testnets\/)?[a-z0-9]+\/chain\.json$/.test(file)) {
    violations.push(`file out of scope: ${file}`);
    continue;
  }
  const read = (ref) => {
    try { return JSON.parse(execSync(`git show ${ref}:${file}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })); }
    catch { return null; }
  };
  const a = read(base), b = read(head);
  if (!a || !b) { violations.push(`${file}: added or deleted whole chain.json — never in scope`); continue; }

  // Rule 2: nothing outside managed blocks may differ
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (MANAGED.includes(key)) continue;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key]))
      violations.push(`${file}: unmanaged field "${key}" changed`);
  }

  // Rule 3: within managed blocks, only EXPECTED_PROVIDER's entries may change
  const arrays = (o) => ({
    ...Object.fromEntries(Object.entries(o.apis ?? {}).map(([k, v]) => [`apis.${k}`, v])),
    ...Object.fromEntries(Object.entries(o.peers ?? {}).map(([k, v]) => [`peers.${k}`, v])),
    snapshots: o.snapshots ?? [],
  });
  const A = arrays(a), B = arrays(b);
  for (const slot of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const sig = (e) => JSON.stringify(e);
    const before = new Map((A[slot] ?? []).map(e => [sig(e), e]));
    const after = new Map((B[slot] ?? []).map(e => [sig(e), e]));
    for (const [s, e] of before) if (!after.has(s) && e.provider !== provider)
      violations.push(`${file} ${slot}: removed/altered entry of provider "${e.provider ?? '(none)'}"`);
    for (const [s, e] of after) if (!before.has(s) && e.provider !== provider)
      violations.push(`${file} ${slot}: added/altered entry claiming provider "${e.provider ?? '(none)'}"`);
  }

  // Rule 4: a NEW entry may not claim a key already registered to a different
  // provider in the base (attribution squatting). Keyed like the bot's merge:
  // endpoints by address, peers by id@address, snapshots by url. A key the
  // expected provider ALREADY held in the base is not a new claim (updates of
  // a pre-existing same-key duplicate stay legal).
  const keyFor = (slot, e) => slot.startsWith('peers.') ? `${e.id}@${e.address}`
                            : slot === 'snapshots' ? e.url : e.address;
  for (const slot of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const baseOthers = new Map((A[slot] ?? []).filter(e => e.provider !== provider)
                                              .map(e => [keyFor(slot, e), e.provider ?? '(unattributed)']));
    const baseOurs = new Set((A[slot] ?? []).filter(e => e.provider === provider)
                                            .map(e => keyFor(slot, e)));
    const beforeSigs = new Set((A[slot] ?? []).map(e => JSON.stringify(e)));
    for (const e of (B[slot] ?? [])) {
      if (e.provider !== provider) continue;              // foreign stamps: rule 3's job
      if (beforeSigs.has(JSON.stringify(e))) continue;    // unchanged entry
      const k = keyFor(slot, e);
      if (baseOthers.has(k) && !baseOurs.has(k))
        violations.push(`${file} ${slot}: new entry claims key "${k}" already registered to provider "${baseOthers.get(k)}"`);
    }
  }

  // Rule 3b: order of surviving other-provider entries must be preserved
  for (const slot of Object.keys(A)) {
    const others = (arr) => (arr ?? []).filter(e => e.provider !== provider).map(e => JSON.stringify(e));
    const keptA = others(A[slot]).filter(s => others(B[slot]).includes(s));
    const keptB = others(B[slot]).filter(s => others(A[slot]).includes(s));
    if (JSON.stringify(keptA) !== JSON.stringify(keptB))
      violations.push(`${file} ${slot}: other providers' entries were reordered`);
  }
}

if (violations.length) {
  console.error(`❌ ${violations.length} scope violation(s):`);
  for (const v of violations) console.error('  - ' + v);
  process.exit(1);
}
console.log(`✅ Diff is fully scoped to provider "${provider}" within ${MANAGED.join('/')} across ${changedFiles.length} file(s).`);
