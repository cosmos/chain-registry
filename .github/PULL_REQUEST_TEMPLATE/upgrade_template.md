<!-- Suggested title: [upgrade] {network} {version}
Use this optional template for chain upgrades. Replace the prompts below;
write N/A where a patch release does not have a proposal or scheduled height.
-->

## Upgrade details

- Network / chain ID:
- Release version and official release URL:
- Upgrade type: consensus-breaking / compatible patch
- Estimated upgrade time (UTC, or unscheduled):
- Upgrade height (or N/A):
- Governance proposal URL / ID (or N/A):

## Metadata checks

- [ ] Version names, tags and upgrade details match the linked official sources.
- [ ] Relevant `chain.json` codebase fields reflect the version currently recommended for use; a future upgrade is not marked current early.
- [ ] Where applicable, `versions.json` records the upgrade and links the previous/next version names.
- [ ] Any changed binaries, compatibility lists and dependency versions are supported by the release information.

<!--
Minimal versions.json example for a scheduled major upgrade. Use actual names,
versions, height and proposal ID from official sources. Omit height/proposal
for an unscheduled compatible patch. Update the existing history rather than
replacing it with this example. Do not invent unknown values.

{
  "$schema": "../versions.schema.json",
  "chain_name": "examplechain",
  "versions": [
    {
      "name": "v1",
      "recommended_version": "v1.0.0",
      "next_version_name": "v2"
    },
    {
      "name": "v2",
      "tag": "v2.0.0",
      "height": 123456,
      "proposal": 42,
      "recommended_version": "v2.0.0",
      "compatible_versions": ["v2.0.0"],
      "previous_version_name": "v1"
    }
  ]
}
-->

## Validation

Describe the checks run and their results, including any checks not run.
