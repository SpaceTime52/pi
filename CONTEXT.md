# Context

## Glossary

| Term | Meaning | Notes |
|---|---|---|
| spawn | New worktree + new Ghostty window + pi running, all in one command | Implemented as `pi-wt spawn`; trigger via `/wt-spawn` |
| city slug | `<city>-vN` worktree name (e.g. `seoul-v1`, `tokyo-v2`) | Allocated by `pi-wt spawn` from a fixed city pool; v-suffix increments on collision |
| worktree | A `pi-wt` managed git worktree under `$PI_WT_ROOT/<repo>/<slug>/` | One worktree = one PR = one pi session |

## Repo aliases

These aliases let prompts and natural-language commands resolve to absolute paths:

| Alias | Path |
|---|---|
| product | /Users/bohyeon/Desktop/creatrip/01.WAS/product |
| pi | /Users/bohyeon/Desktop/creatrip/01.WAS/pi |
| pi-conductor | /Users/bohyeon/Desktop/creatrip/01.WAS/pi-conductor |
