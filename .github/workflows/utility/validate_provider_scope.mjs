// validate_provider_scope.mjs
// Independent CI guard for provider-manifest sync PRs (threat T6: even a
// compromised bot/token cannot land an out-of-lane change past this check).
//
// Recomputes the PR's own diff (merge-base..head, i.e. what GitHub shows as
// "Files changed") from scratch and FAILS unless EVERY change:
//   1. touches only */chain.json files (sync reports live in RUNNER_TEMP and
//      never enter the checkout),
//   2. touches only the managed blocks: apis / peers / snapshots,
//   3. only adds/updates/removes entries whose `provider` === EXPECTED_PROVIDER,
//   3b. keeps other providers' surviving entries in their original order,
//   4. never adds an entry whose identity key (address / id@address / url) is
//      already registered to a DIFFERENT provider at the merge-base or the
//      current base tip — the bot reports such collisions as conflicts instead
//      of adding them, so a diff containing one means the bot was bypassed or
//      compromised.
// It also fails closed if the PR has more than one merge-base (criss-cross
// history), where a single merge-base diff can hide what actually lands.
//
// Invocation (from repo root, in a PR checkout with full history, i.e.
// actions/checkout fetch-depth: 0):
//   EXPECTED_PROVIDER="Example Infra" BASE_SHA=<sha> HEAD_SHA=<sha> node .github/workflows/utility/validate_provider_scope.mjs

import { execSync } from 'child_process';

const provider = process.env.EXPECTED_PROVIDER;
const base = process.env.BASE_SHA, head = process.env.HEAD_SHA;
if (!provider || !base || !head) { console.error('EXPECTED_PROVIDER, BASE_SHA, HEAD_SHA required'); process.exit(1); }

const MANAGED = ['apis', 'peers', 'snapshots'];  // explorers deferred (no provider field in registry explorer object)
const violations = [];

// BASE_SHA is the base branch TIP when the event fired, not the commit the bot
// branched from. If master moved after the bot opened the PR, a base..head diff
// shows every newer master commit as if this PR reverted it. Diff from the
// merge-base instead. Without full history `git merge-base` errors out, which
// fails the check (closed). With several merge-bases, fail closed too.
const mergeBases = execSync(`git merge-base --all ${base} ${head}`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
if (mergeBases.length !== 1) {
  console.error(`❌ expected exactly 1 merge-base between base and head, found ${mergeBases.length}; rebase the branch onto the base branch`);
  process.exit(1);
}
const mergeBase = mergeBases[0];

const changedFiles = execSync(`git diff --name-only ${mergeBase} ${head}`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);

for (const file of changedFiles) {
  // Rule 1: file allowlist
  if (!/^(testnets\/)?[a-z0-9]+\/chain\.json$/.test(file)) {
    violations.push(`file out of scope: ${file}`);
    continue;
  }
  const read = (ref) => {
    try { return JSON.parse(execSync(`git show ${ref}:${file}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })); }
    catch { return null; }
  };
  const a = read(mergeBase), b = read(head);
  if (!a || !b) { violations.push(`${file}: added or deleted whole chain.json — never in scope`); continue; }
  const tip = read(base);  // current base tip, used by rule 4
  if (!tip) { violations.push(`${file}: no longer exists on the base branch`); continue; }

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
  const A = arrays(a), B = arrays(b), T = arrays(tip);
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
  // provider (attribution squatting). Keyed like the bot's merge: endpoints by
  // address, peers by id@address, snapshots by url. Other providers' keys count
  // if present at the merge-base OR the current base tip, so a key added to
  // master after the bot branched is still protected. Ownership is decided by
  // the base tip (what the PR lands on): a key the expected provider still
  // holds there is not a new claim (updates of a pre-existing same-key
  // duplicate stay legal), but a key it held at the merge-base and that was
  // since re-attributed on master is.
  const keyFor = (slot, e) => slot.startsWith('peers.') ? `${e.id}@${e.address}`
                            : slot === 'snapshots' ? e.url : e.address;
  for (const slot of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const baseOthers = new Map([...(A[slot] ?? []), ...(T[slot] ?? [])]
                                 .filter(e => e.provider !== provider)
                                 .map(e => [keyFor(slot, e), e.provider ?? '(unattributed)']));
    const baseOurs = new Set((T[slot] ?? []).filter(e => e.provider === provider)
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
