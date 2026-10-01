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
if [[ ! "$TARGET_BRANCH" =~ ^(update|auto)/[A-Za-z0-9._/-]+$ ]]; then
  echo "::error::Refusing to write '$TARGET_BRANCH': bot branches must start with update/ or auto/."
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
git -c core.quotePath=false diff --cached --name-status --no-renames HEAD > "$WORK/changes.txt"
if [[ ! -s "$WORK/changes.txt" ]]; then
  echo "No files changed; nothing to commit."
  echo "changed=false" >> "$GITHUB_OUTPUT"
  echo "sha=" >> "$GITHUB_OUTPUT"
  exit 0
fi
echo "Files changed:"; cat "$WORK/changes.txt"

# --- guard: never overwrite a human fix on an open bot PR -------------------
# Bot commits (old and new) all start with "[AUTO]". Anything else on an open
# PR from this branch is a manual edit that a force-move would destroy.
for pr in $(gh api "repos/$REPO/pulls?state=open&head=$GITHUB_REPOSITORY_OWNER:$TARGET_BRANCH" --jq '.[].number'); do
  manual="$(gh api --paginate "repos/$REPO/pulls/$pr/commits" \
    --jq '.[] | select(.commit.message | startswith("[AUTO]") | not) | .sha[:8]')"
  if [[ -n "$manual" ]]; then
    echo "::error::Open PR #$pr from $TARGET_BRANCH has non-[AUTO] commits ($(echo $manual)). Merge or close it first, so they are not overwritten."
    exit 1
  fi
done

# --- build the createCommitOnBranch request ---------------------------------
# File contents go through files (--rawfile/--slurpfile), never argv: a large
# base64 blob in one argument hits the kernel's per-argument size limit.
: > "$WORK/add.jsonl"; : > "$WORK/del.jsonl"
while IFS=$'\t' read -r status path; do
  case "$status" in
    D) jq -n --arg path "$path" '{path: $path}' >> "$WORK/del.jsonl" ;;
    *) base64 -w0 -- "$path" > "$WORK/blob.b64"
       jq -n --arg path "$path" --rawfile contents "$WORK/blob.b64" \
         '{path: $path, contents: $contents}' >> "$WORK/add.jsonl" ;;
  esac
done < "$WORK/changes.txt"

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

# --- 3. point the bot branch at it ------------------------------------------
if gh api "repos/$REPO/git/ref/heads/$TARGET_BRANCH" >/dev/null 2>&1; then
  gh api -X PATCH "repos/$REPO/git/refs/heads/$TARGET_BRANCH" -f "sha=$NEW" -F force=true >/dev/null
else
  gh api "repos/$REPO/git/refs" -f "ref=refs/heads/$TARGET_BRANCH" -f "sha=$NEW" >/dev/null
fi

VERIFIED="$(gh api "repos/$REPO/commits/$NEW" --jq '.commit.verification.verified')"
echo "Committed $NEW to $TARGET_BRANCH (signature verified: $VERIFIED)."
[[ "$VERIFIED" == "true" ]] || echo "::warning::Commit $NEW is not signed; the PR will be blocked by the signed-commits rule."

echo "changed=true" >> "$GITHUB_OUTPUT"
echo "sha=$NEW" >> "$GITHUB_OUTPUT"
