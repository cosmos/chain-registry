#!/usr/bin/env bash
# Commit the working-tree changes onto $TARGET_BRANCH as ONE signed commit on
# top of the checked-out commit, using only the GitHub API:
#
#   1. create a temp branch at the checked-out commit
#   2. createCommitOnBranch on it   (GraphQL; GitHub signs the commit)
#   3. point $TARGET_BRANCH at the new commit (create, or force-move)
#   4. delete the temp branch       (always, via trap)
#
# The temp branch exists because createCommitOnBranch can only append to an
# existing branch, and resetting $TARGET_BRANCH to master first would make
# GitHub auto-close its open PR.
#
# Env: GH_TOKEN, TARGET_BRANCH, COMMIT_MESSAGE, plus the standard GITHUB_* vars.
set -euo pipefail

REPO="$GITHUB_REPOSITORY"
WORK="$(mktemp -d)"
TMP_BRANCH=""

cleanup() {
  if [[ -n "$TMP_BRANCH" ]]; then
    gh api -X DELETE "repos/$REPO/git/refs/heads/$TMP_BRANCH" >/dev/null 2>&1 \
      || echo "::warning::Could not delete temp branch $TMP_BRANCH; delete it by hand."
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

is_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }

# --- guard: only ever write bot branches -----------------------------------
if [[ ! "$TARGET_BRANCH" =~ ^(update|auto)/[A-Za-z0-9._/-]+$ ]] \
   || ! git check-ref-format --branch "$TARGET_BRANCH" >/dev/null 2>&1; then
  echo "::error::Refusing to write '$TARGET_BRANCH': bot branches must be a valid ref under update/ or auto/."
  exit 1
fi
DEFAULT_BRANCH="$(gh api "repos/$REPO" --jq .default_branch)"
if [[ "$TARGET_BRANCH" == "$DEFAULT_BRANCH" ]]; then
  echo "::error::Refusing to write the default branch '$DEFAULT_BRANCH'."
  exit 1
fi

BASE="$(git rev-parse HEAD)"
is_sha "$BASE" || { echo "::error::Could not resolve HEAD: $BASE"; exit 1; }

# --- collect changes (same set `git add -A` would commit; .gitignore applies)
git add -A
# -z: NUL-separated, so paths are never C-quoted; changes.txt is display-only.
git diff --cached --name-status --no-renames -z HEAD > "$WORK/changes.z"
git -c core.quotePath=false diff --cached --name-status --no-renames HEAD > "$WORK/changes.txt"
if [[ ! -s "$WORK/changes.z" ]]; then
  echo "No files changed; nothing to commit."
  echo "changed=false" >> "$GITHUB_OUTPUT"
  echo "sha=" >> "$GITHUB_OUTPUT"
  exit 0
fi
echo "Files changed:"; cat "$WORK/changes.txt"

# --- guard: never overwrite a human commit on the bot branch ----------------
# Bot commits (old and new) all start with "[AUTO]". Any other commit on the
# branch that the checked-out commit doesn't already contain is a manual edit
# that the force-move below would drop, whether or not a PR is open for it.
# Assign first: a failing $(...) inside a for-list or [[ ]] does NOT trip
# set -e, which would silently skip this guard.
TARGET_SHA=""
if gh api "repos/$REPO/git/ref/heads/$TARGET_BRANCH" >/dev/null 2>&1; then
  TARGET_SHA="$(gh api "repos/$REPO/git/ref/heads/$TARGET_BRANCH" --jq .object.sha)"
  is_sha "$TARGET_SHA" || { echo "::error::Could not resolve $TARGET_BRANCH: $TARGET_SHA"; exit 1; }
  compare="$(gh api "repos/$REPO/compare/$BASE...$TARGET_SHA" \
    --jq '[.total_commits, ([.commits[] | select(.commit.message | startswith("[AUTO]") | not) | .sha[:8]] | join(" "))] | @tsv')"
  IFS=$'\t' read -r total manual <<< "$compare"
  [[ "$total" =~ ^[0-9]+$ ]] || { echo "::error::Could not compare $TARGET_BRANCH with $BASE: $compare"; exit 1; }
  if (( total > 250 )); then
    echo "::error::$TARGET_BRANCH has $total commits not in $BASE; too many to check. Clean it up by hand."
    exit 1
  fi
  if [[ -n "$manual" ]]; then
    echo "::error::$TARGET_BRANCH has non-[AUTO] commits ($manual). Merge or drop them first, so they are not overwritten."
    exit 1
  fi
fi

# --- build the createCommitOnBranch request ---------------------------------
# File contents go through files (--rawfile/--slurpfile), never argv: a large
# base64 blob in one argument hits the kernel's per-argument size limit.
: > "$WORK/add.jsonl"; : > "$WORK/del.jsonl"
while IFS= read -r -d '' status && IFS= read -r -d '' path; do
  case "$status" in
    D) jq -n --arg path "$path" '{path: $path}' >> "$WORK/del.jsonl" ;;
    *) base64 -w0 -- "$path" > "$WORK/blob.b64"
       jq -n --arg path "$path" --rawfile contents "$WORK/blob.b64" \
         '{path: $path, contents: $contents}' >> "$WORK/add.jsonl" ;;
  esac
done < "$WORK/changes.z"

TMP_BRANCH="tmp/signed-commit/${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}/${TARGET_BRANCH}"

jq -n \
  --arg repo "$REPO" --arg branch "$TMP_BRANCH" --arg base "$BASE" \
  --arg headline "$COMMIT_MESSAGE" --rawfile changes "$WORK/changes.txt" \
  --slurpfile add "$WORK/add.jsonl" --slurpfile del "$WORK/del.jsonl" \
  '{
     query: "mutation($i: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $i) { commit { oid } } }",
     variables: { i: {
       branch: { repositoryNameWithOwner: $repo, branchName: $branch },
       expectedHeadOid: $base,
       message: { headline: $headline, body: ("Files changed:\n" + ($changes | rtrimstr("\n"))) },
       fileChanges: { additions: $add, deletions: $del }
     } }
   }' > "$WORK/request.json"

# --- 1. temp branch, 2. signed commit ---------------------------------------
gh api "repos/$REPO/git/refs" -f "ref=refs/heads/$TMP_BRANCH" -f "sha=$BASE" >/dev/null
NEW="$(gh api graphql --input "$WORK/request.json" --jq '.data.createCommitOnBranch.commit.oid')"
is_sha "$NEW" || { echo "::error::createCommitOnBranch did not return a commit: $NEW"; exit 1; }

# Check the signature BEFORE touching the bot branch: an unsigned commit would
# only produce a PR that the signed-commits rule blocks.
VERIFIED="$(gh api "repos/$REPO/commits/$NEW" --jq '.commit.verification.verified')"
if [[ "$VERIFIED" != "true" ]]; then
  echo "::error::Commit $NEW is not signed (verified: $VERIFIED); leaving $TARGET_BRANCH untouched."
  exit 1
fi

# --- 3. point the bot branch at it ------------------------------------------
if [[ -n "$TARGET_SHA" ]]; then
  gh api -X PATCH "repos/$REPO/git/refs/heads/$TARGET_BRANCH" -f "sha=$NEW" -F force=true >/dev/null
else
  gh api "repos/$REPO/git/refs" -f "ref=refs/heads/$TARGET_BRANCH" -f "sha=$NEW" >/dev/null
fi
echo "Committed $NEW to $TARGET_BRANCH (signed)."

echo "changed=true" >> "$GITHUB_OUTPUT"
echo "sha=$NEW" >> "$GITHUB_OUTPUT"
