#!/usr/bin/env bats
# Run with: bats .pi/bin/tests/pi-wt-gc.bats
# Install on macOS: brew install bats-core

setup() {
  TEST_ROOT="$(mktemp -d)"
  REPO="$TEST_ROOT/repo"
  PI_WT_ROOT_DIR="$TEST_ROOT/worktrees"
  MOCK_BIN="$TEST_ROOT/bin"
  BUSY_LIST="$TEST_ROOT/busy.txt"
  PI_WT="$BATS_TEST_DIRNAME/../pi-wt"

  mkdir -p "$MOCK_BIN" "$PI_WT_ROOT_DIR"
  : >"$BUSY_LIST"

  cat >"$MOCK_BIN/lsof" <<'EOF'
#!/usr/bin/env bash
while IFS= read -r p; do
  [ -n "$p" ] || continue
  printf 'p1\nn%s\n' "$p"
done <"$BUSY_LIST"
EOF
  chmod +x "$MOCK_BIN/lsof"
  export PATH="$MOCK_BIN:$PATH"
  export BUSY_LIST

  mkdir -p "$REPO"
  git -C "$REPO" init -q
  git -C "$REPO" config user.email pi-wt-test@example.com
  git -C "$REPO" config user.name "pi-wt test"
  printf 'initial\n' >"$REPO/README.md"
  git -C "$REPO" add README.md
  git -C "$REPO" commit -q -m initial

  TMPDIR="$TEST_ROOT" # keep the gc lock inside the sandbox
  export TMPDIR
}

teardown() {
  rm -rf "$TEST_ROOT"
}

# Create a worktree holding a reinstallable node_modules tree.
make_worktree() {
  local name=$1 wt
  wt="$PI_WT_ROOT_DIR/repo/$name"
  (cd "$REPO" && PI_WT_ROOT="$PI_WT_ROOT_DIR" "$PI_WT" new "$name" >/dev/null 2>&1)
  printf '{"name":"root"}\n' >"$wt/package.json"
  mkdir -p "$wt/node_modules/left-pad" "$wt/frontend/node_modules/.pnpm/foo"
  printf '{"name":"frontend"}\n' >"$wt/frontend/package.json"
  head -c 20000 /dev/zero >"$wt/node_modules/left-pad/index.js"
  head -c 20000 /dev/zero >"$wt/frontend/node_modules/.pnpm/foo/index.js"
  printf '%s' "$wt"
}

# Backdate every mtime gc inspects so the worktree reads as idle.
age_worktree() {
  local wt=$1 git_dir
  git_dir="$(git -C "$wt" rev-parse --git-dir)"
  find "$wt" -exec touch -t 202001010000 {} + 2>/dev/null || true
  touch -t 202001010000 "$git_dir/index" 2>/dev/null || true
}

run_gc() {
  run env PI_WT_ROOT="$PI_WT_ROOT_DIR" "$PI_WT" gc "$@"
}

@test "dry-run reports reclaimable node_modules without deleting them" {
  wt="$(make_worktree seoul-v1)"
  age_worktree "$wt"

  run_gc

  [ "$status" -eq 0 ]
  [[ "$output" == *"would"* ]]
  [[ "$output" == *"repo/seoul-v1"* ]]
  [[ "$output" == *"2 dir(s)"* ]]
  [[ "$output" == *"reclaimable"* ]]
  [ -d "$wt/node_modules" ]
  [ -d "$wt/frontend/node_modules" ]
}

@test "--apply deletes node_modules and keeps the rest of the worktree" {
  wt="$(make_worktree seoul-v1)"
  age_worktree "$wt"

  run_gc --apply

  [ "$status" -eq 0 ]
  [[ "$output" == *"freed"* ]]
  [ ! -d "$wt/node_modules" ]
  [ ! -d "$wt/frontend/node_modules" ]
  [ -f "$wt/package.json" ]
  [ -f "$wt/frontend/package.json" ]
  [ -e "$wt/.git" ]
}

@test "skips a worktree touched within the retention window" {
  wt="$(make_worktree seoul-v1)"
  age_worktree "$wt"
  touch "$wt/frontend/src.ts"

  run_gc --apply

  [ "$status" -eq 0 ]
  [[ "$output" == *"active within 7d"* ]]
  [ -d "$wt/node_modules" ]
}

@test "skips a worktree that a live process is sitting in" {
  wt="$(make_worktree seoul-v1)"
  age_worktree "$wt"
  printf '%s/frontend\n' "$wt" >"$BUSY_LIST"

  run_gc --apply

  [ "$status" -eq 0 ]
  [[ "$output" == *"in use"* ]]
  [ -d "$wt/node_modules" ]
}

@test "leaves node_modules that has no sibling package.json" {
  wt="$(make_worktree seoul-v1)"
  rm "$wt/frontend/package.json"
  age_worktree "$wt"

  run_gc --apply

  [ "$status" -eq 0 ]
  [[ "$output" == *"1 dir(s)"* ]]
  [ ! -d "$wt/node_modules" ]
  [ -d "$wt/frontend/node_modules" ]
}

@test "PI_WT_GC_TARGETS controls which directories are swept" {
  wt="$(make_worktree seoul-v1)"
  mkdir -p "$wt/frontend/.next/cache"
  head -c 20000 /dev/zero >"$wt/frontend/.next/cache/blob"
  age_worktree "$wt"

  run env PI_WT_ROOT="$PI_WT_ROOT_DIR" PI_WT_GC_TARGETS="node_modules .next" "$PI_WT" gc --apply

  [ "$status" -eq 0 ]
  [ ! -d "$wt/frontend/.next" ]
  [ ! -d "$wt/node_modules" ]
}

@test "--repo limits the sweep to one repository" {
  wt="$(make_worktree seoul-v1)"
  age_worktree "$wt"

  run_gc --repo other --apply

  [ "$status" -eq 0 ]
  [ -d "$wt/node_modules" ]
}

@test "a lock left behind by a dead run does not block the next run" {
  wt="$(make_worktree seoul-v1)"
  age_worktree "$wt"
  mkdir "$TMPDIR/pi-wt-gc.lock"
  printf '999999' >"$TMPDIR/pi-wt-gc.lock/pid"

  run_gc --apply

  [ "$status" -eq 0 ]
  [ ! -d "$wt/node_modules" ]
}

@test "a live lock owner blocks a concurrent run" {
  wt="$(make_worktree seoul-v1)"
  age_worktree "$wt"
  mkdir "$TMPDIR/pi-wt-gc.lock"
  printf '%s' "$$" >"$TMPDIR/pi-wt-gc.lock/pid"

  run_gc --apply

  [ "$status" -ne 0 ]
  [[ "$output" == *"already"* || "$output" == *"is running"* ]]
  [ -d "$wt/node_modules" ]
}

@test "--days rejects a non-numeric retention window" {
  run_gc --days soon

  [ "$status" -ne 0 ]
  [[ "$output" == *"positive integer"* ]]
}
