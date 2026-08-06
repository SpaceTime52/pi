#!/usr/bin/env bats
# Run with: bats .pi/bin/tests/pi-wt-spawn.bats
# Install on macOS: brew install bats-core

setup() {
  TEST_ROOT="$(mktemp -d)"
  REPO="$TEST_ROOT/repo"
  PI_WT_ROOT_DIR="$TEST_ROOT/worktrees"
  MOCK_BIN="$TEST_ROOT/bin"
  MOCK_LOG="$TEST_ROOT/mock.log"
  MOCK_APPLESCRIPT="$TEST_ROOT/ghostty.applescript"
  PI_WT="$BATS_TEST_DIRNAME/../pi-wt"

  mkdir -p "$MOCK_BIN" "$PI_WT_ROOT_DIR"

  cat >"$MOCK_BIN/open" <<'EOF'
#!/usr/bin/env bash
printf 'open' >>"$MOCK_LOG"
for arg in "$@"; do
  printf ' %s' "$arg" >>"$MOCK_LOG"
done
printf '\n' >>"$MOCK_LOG"
EOF

  cat >"$MOCK_BIN/osascript" <<'EOF'
#!/usr/bin/env bash
printf 'osascript\n' >>"$MOCK_LOG"
for arg in "$@"; do
  printf 'arg=%s\n' "$arg" >>"$MOCK_LOG"
done
cat >"$MOCK_APPLESCRIPT"
EOF

  chmod +x "$MOCK_BIN/open" "$MOCK_BIN/osascript"
  export PATH="$MOCK_BIN:$PATH"
  export MOCK_LOG MOCK_APPLESCRIPT

  create_git_repo "$REPO"
}

teardown() {
  rm -rf "$TEST_ROOT"
}

create_git_repo() {
  local repo=$1
  mkdir -p "$repo"
  git -C "$repo" init -q
  git -C "$repo" config user.email pi-wt-test@example.com
  git -C "$repo" config user.name "pi-wt test"
  printf 'initial\n' >"$repo/README.md"
  git -C "$repo" add README.md
  git -C "$repo" commit -q -m initial
}

run_spawn() {
  env \
    PI_WT_ROOT="$PI_WT_ROOT_DIR" \
    PI_WT_CITY_POOL="${PI_WT_CITY_POOL:-seoul}" \
    PI_WT_CITY_START="${PI_WT_CITY_START:-0}" \
    "$PI_WT" spawn "$@"
}

assert_line_present() {
  local expected=$1
  local line
  for line in "${lines[@]}"; do
    [[ "$line" == "$expected" ]] && return 0
  done
  printf 'expected line not found: %s\noutput:\n%s\n' "$expected" "$output" >&2
  return 1
}

@test "spawn with explicit repo path allocates seoul-v1, creates worktree, and opens a Ghostty tab" {
  run run_spawn "$REPO"

  [ "$status" -eq 0 ]
  local wt_path="$PI_WT_ROOT_DIR/repo/seoul-v1"
  assert_line_present "slug=seoul-v1"
  assert_line_present "path=$wt_path"
  [ -e "$wt_path/.git" ]
  [ -f "$wt_path/.pi/worktree.json" ]
  [ -x "$wt_path/.pi/pi-wt-session.zsh" ]

  ! grep -Fq "open " "$MOCK_LOG"
  grep -Fxq "arg=-" "$MOCK_LOG"
  grep -Fxq "arg=$wt_path" "$MOCK_LOG"
  grep -Fq "arg=/bin/zsh '$wt_path/.pi/pi-wt-session.zsh' '$wt_path'" "$MOCK_LOG"
  grep -Fq 'set targetTab to new tab in targetWindow with configuration cfg' "$MOCK_APPLESCRIPT"
}

@test "spawn passes quoted worktree paths to AppleScript as arguments" {
  local quoted_repo="$TEST_ROOT/repo with 'quote"
  create_git_repo "$quoted_repo"

  run run_spawn "$quoted_repo"

  [ "$status" -eq 0 ]
  local wt_path="$PI_WT_ROOT_DIR/$(basename "$quoted_repo")/seoul-v1"
  assert_line_present "path=$wt_path"
  grep -Fxq "arg=$wt_path" "$MOCK_LOG"
  ! grep -Fq "$wt_path" "$MOCK_APPLESCRIPT"
}

@test "running spawn twice with same city start allocates seoul-v1 then seoul-v2" {
  run run_spawn "$REPO"
  [ "$status" -eq 0 ]
  assert_line_present "slug=seoul-v1"
  assert_line_present "path=$PI_WT_ROOT_DIR/repo/seoul-v1"

  run run_spawn "$REPO"
  [ "$status" -eq 0 ]
  assert_line_present "slug=seoul-v2"
  assert_line_present "path=$PI_WT_ROOT_DIR/repo/seoul-v2"
}

@test "spawn skips city slugs used by local and remote branches" {
  git -C "$REPO" branch seoul-v1
  git -C "$REPO" update-ref refs/remotes/upstream/seoul-v2 HEAD

  run run_spawn "$REPO"

  [ "$status" -eq 0 ]
  assert_line_present "slug=seoul-v3"
  assert_line_present "path=$PI_WT_ROOT_DIR/repo/seoul-v3"
}

@test "spawn rotates to tokyo-v1 when seoul-v1 through seoul-v999 already exist" {
  mkdir -p "$PI_WT_ROOT_DIR/repo"
  for i in $(seq 1 999); do
    mkdir -p "$PI_WT_ROOT_DIR/repo/seoul-v$i"
  done

  PI_WT_CITY_POOL="seoul tokyo" run run_spawn "$REPO"

  [ "$status" -eq 0 ]
  assert_line_present "slug=tokyo-v1"
  assert_line_present "path=$PI_WT_ROOT_DIR/repo/tokyo-v1"
  [ -e "$PI_WT_ROOT_DIR/repo/tokyo-v1/.git" ]
}

@test "spawn fails when the only city has no available version" {
  mkdir -p "$PI_WT_ROOT_DIR/repo"
  for i in $(seq 1 999); do
    mkdir -p "$PI_WT_ROOT_DIR/repo/seoul-v$i"
  done

  PI_WT_CITY_POOL="seoul" run run_spawn "$REPO"

  [ "$status" -ne 0 ]
  [[ "$output" == *"no available city name"* ]]
}

@test "spawn rejects invalid explicit repo paths" {
  run run_spawn "$TEST_ROOT/does-not-exist"
  [ "$status" -ne 0 ]
  [[ "$output" == *"not a directory"* ]]

  mkdir -p "$TEST_ROOT/not-git"
  run run_spawn "$TEST_ROOT/not-git"
  [ "$status" -ne 0 ]
  [[ "$output" == *"not inside a git repository"* ]]
}
