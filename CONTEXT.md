# Context

## Glossary

| Term | Meaning | Notes |
|---|---|---|
| spawn | New worktree + new Ghostty tab + pi running, all in one command | Implemented as `pi-wt spawn`; opens a new window only when Ghostty has none; trigger via `/wt-spawn` |
| city slug | `<city>-vN` worktree name (e.g. `seoul-v1`, `tokyo-v2`) | Allocated by `pi-wt spawn` from a fixed city pool; v-suffix increments on collision |
| worktree | A `pi-wt` managed git worktree under `$PI_WT_ROOT/<repo>/<slug>/` | One worktree = one PR = one pi session |
| idle worktree | A worktree with no process cwd inside it and no git/file activity for N days | The unit `pi-wt gc` acts on; default N is 7 |
| gc | Deleting reinstallable dependency dirs (`node_modules`) from idle worktrees | `pi-wt gc` — dry-run by default, `--apply` to delete; restore with `pnpm install`. Scheduled daily via `.pi/launchd/com.spacetime52.pi-wt-gc.plist` |

## Repo aliases

These aliases let prompts and natural-language commands resolve to absolute paths:

| Alias | Path |
|---|---|
| product | /Users/bohyeon/Desktop/creatrip/01.WAS/product |
| lambda | /Users/bohyeon/Desktop/creatrip/01.WAS/lambda |
| pi | /Users/bohyeon/Desktop/creatrip/01.WAS/pi |
| pi-conductor | /Users/bohyeon/Desktop/creatrip/01.WAS/pi-conductor |
