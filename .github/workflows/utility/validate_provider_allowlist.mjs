// validate_provider_allowlist.mjs
// PR-time schema validation for _providers/provider-allowlist.json.
//
// The onboarding path — a human PR adding a provider to the allowlist — had no
// automated schema check. sync_provider_manifests runs only on dispatch/
// schedule, validate_provider_scope skips non-sync branches, and
// @chain-registry/cli does not know about _providers/. So an invalid entry
// (e.g. added_by_pr written as a string, a malformed manifest_url, an unknown
// status, an extra property) could land on master with green CI. This closes
// that gap: such a file now fails the "Validate Provider Allowlist" check.
//
// Invocation (from .github/workflows/utility): node validate_provider_allowlist.mjs

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Anchor paths to this script's own location, not process.cwd(), so the repo
// root resolves correctly no matter which directory the script is invoked from
// (CI sets working-directory; local runs may not).
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ALLOWLIST = path.join(ROOT, '_providers', 'provider-allowlist.json');
const SCHEMA = path.join(ROOT, 'provider-allowlist.schema.json');

const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };

let allowlist, schema;
try { allowlist = JSON.parse(readFileSync(ALLOWLIST, 'utf8')); }
catch (e) { fail(`cannot read/parse _providers/provider-allowlist.json: ${e.message}`); }
try { schema = JSON.parse(readFileSync(SCHEMA, 'utf8')); }
catch (e) { fail(`cannot read/parse provider-allowlist.schema.json: ${e.message}`); }

// The schema intentionally omits a $schema meta-key, so AJV validates it as
// draft-07 by default. Its $id is a URL; drop it so AJV never attempts a
// remote fetch to resolve the schema against itself.
delete schema.$id;

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
// The schema currently omits a $schema meta-key (AJV then uses draft-07 by
// default). If it ever declares one, the repo convention is the URI
// "https://json-schema.org/draft-07/schema" (https, no #), which AJV does not
// know by that spelling and would throw on compile. Alias it to the built-in
// draft-07 meta so this stays robust — same guard as sync_provider_manifests.mjs.
ajv.addMetaSchema(ajv.getSchema('http://json-schema.org/draft-07/schema#').schema,
                  'https://json-schema.org/draft-07/schema');
const validate = ajv.compile(schema);

if (!validate(allowlist)) {
  console.error(`❌ ${validate.errors.length} schema violation(s) in _providers/provider-allowlist.json:`);
  for (const e of validate.errors)
    console.error(`   - ${e.instancePath || '(root)'} ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`);
  process.exit(1);
}

// JSON Schema cannot express uniqueness across array items. Enforce it here:
// the sync bot keys every injected registry entry off the exact provider name,
// so two allowlist entries sharing a name would be ambiguous.
const names = (allowlist.providers ?? []).map(p => p.name);
const dupNames = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
if (dupNames.length) fail(`duplicate provider name(s): ${dupNames.join(', ')}`);

// Two entries pointing at the same manifest_url is almost certainly a mistake.
const urls = (allowlist.providers ?? []).map(p => p.manifest_url);
const dupUrls = [...new Set(urls.filter((u, i) => urls.indexOf(u) !== i))];
if (dupUrls.length) fail(`duplicate manifest_url(s): ${dupUrls.join(', ')}`);

console.log(`✅ provider-allowlist.json is valid (${(allowlist.providers ?? []).length} provider(s)).`);
