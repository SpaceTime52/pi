---
description: 새 워크트리 + Ghostty 새 윈도우 + pi 한 방에 띄우기
argument-hint: "<repo> 예: product (또는 절대 경로)"
---
사용자가 `pi-wt spawn`으로 새 워크트리, Ghostty 새 윈도우, pi 세션을 한 번에 띄우려고 해.

입력:
`$@`

다음을 수행해:

1. 아래 bash를 한 번만 실행해. `CONTEXT.md`의 `Repo aliases` 표를 읽어서 `$@`를 절대 repo 경로로 해석해야 해.
   - `$@`가 alias와 정확히 같거나 문장 안에 alias 토큰이 있으면 그 `Path`를 사용해. 예: `내 product 레포` → `product` alias.
   - `$@`가 `/`로 시작하는 절대 경로처럼 보이면 그대로 사용해.
   - `$@`가 비어 있으면 현재 `pwd`의 git repo 루트를 사용해.

```bash
PI_WT_SPAWN_INPUT='$@' bash <<'PI_WT_SPAWN'
set -euo pipefail

input="${PI_WT_SPAWN_INPUT:-}"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
context="$repo_root/CONTEXT.md"
primary_pi_wt="/Users/bohyeon/Desktop/creatrip/01.WAS/pi/.pi/bin/pi-wt"
fallback_pi_wt="$HOME/.pi/agent/git/github.com/SpaceTime52/pi/.pi/bin/pi-wt"

if [ -f "$primary_pi_wt" ]; then
  pi_wt="$primary_pi_wt"
elif [ -f "$fallback_pi_wt" ]; then
  pi_wt="$fallback_pi_wt"
else
  printf "pi-wt_not_found primary=%s fallback=%s\n" "$primary_pi_wt" "$fallback_pi_wt" >&2
  exit 127
fi

trimmed="$(printf "%s" "$input" | awk '{$1=$1; print}')"
resolved_path=""

if [ -z "$trimmed" ]; then
  resolved_path="$repo_root"
elif [ "${trimmed#/}" != "$trimmed" ]; then
  resolved_path="$trimmed"
elif [ -f "$context" ]; then
  resolved_path="$(awk -F"|" -v input="$trimmed" '
    /^## Repo aliases/ { in_aliases=1; next }
    in_aliases && /^## / { exit }
    in_aliases && /^\|/ {
      alias=$2; path=$3
      gsub(/^[ \t]+|[ \t]+$/, "", alias)
      gsub(/^[ \t]+|[ \t]+$/, "", path)
      if (alias == "Alias" || alias == "---" || alias == "") next
      pattern="(^|[^[:alnum:]_-])" alias "([^[:alnum:]_-]|$)"
      if (input == alias || input ~ pattern) {
        print path
        exit
      }
    }
  ' "$context")"
fi

if [ -z "$resolved_path" ]; then
  printf "alias_unresolved=%s\nCONTEXT.md의 Repo aliases 표(Glossary 아래)에 alias를 추가해.\n" "$trimmed" >&2
  exit 2
fi

output="$(bash "$pi_wt" spawn "$resolved_path")"
printf "%s\n" "$output"

slug="$(printf "%s\n" "$output" | tr " " "\n" | awk -F= '$1 == "slug" { print $2; exit }')"
path="$(printf "%s\n" "$output" | tr " " "\n" | awk -F= '$1 == "path" { print $2; exit }')"

printf "resolved_path=%s\n" "$resolved_path"
printf "spawn_slug=%s\n" "$slug"
printf "spawn_path=%s\n" "$path"
PI_WT_SPAWN
```

2. stdout에서 `slug=`와 `path=`를 확인해 사용자에게 짧게 보고해:
   - 생성된 slug
   - 생성된 path
   - 새 Ghostty 윈도우에서 pi가 이미 실행 중이라는 사실
3. 현재 pi 세션에서는 새 worktree로 `cd`하지 마. 추가 터미널이나 후속 액션을 자동으로 열지 마.

실패하면:
- `Ghostty.app` not found: Ghostty를 설치하라고 안내해.
- city pool exhausted: `pi-wt prune` 실행을 제안해.
- `alias_unresolved=...`: `CONTEXT.md`의 `Repo aliases` 표(Glossary 아래)에 alias를 추가하라고 안내해.
- `pi-wt_not_found`: `/Users/bohyeon/Desktop/creatrip/01.WAS/pi/.pi/bin/pi-wt` 또는 `~/.pi/agent/git/github.com/SpaceTime52/pi/.pi/bin/pi-wt` 설치 위치를 확인하라고 안내해.

핵심 원칙:
- 한 worktree = 한 PR = 한 pi 세션
- 이 프롬프트는 spawn만 한다.
- 현재 세션에서 새 worktree로 이동하지 않는다.
