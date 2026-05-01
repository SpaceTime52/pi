---
name: cli-toolbox
description: Discovers and uses installed CLI tools for external services. Use when needing to interact with GitHub, AWS, GCP/BigQuery, Cloudflare, internal company tools (e.g. Creatrip's `ct`), databases, or any external service where the answer comes through a CLI rather than direct file/web access. Also use when the user asks "what tools do I have" or seems to expect a CLI-based solution.
---

# Using the CLI Toolbox

The user has many CLIs installed beyond pi's built-in tools. Trial-and-error
across them wastes turns. There's a curated catalog with auth state, common
patterns, and decision rules for each tool.

## Read the catalog first

```bash
cat ~/.pi/agent/clis.md
```

That file lists every CLI worth using on this machine, grouped by purpose
(Git, Cloud, DB, Internal, ...) with:
- exact command name and location
- current auth state (logged in / configured / missing)
- the 3-5 commands most likely to be useful
- decision tree for "MCP server vs direct CLI vs curl"
- safety notes (which writes need user confirmation)

## When to read it

- At session start if the task involves any external service
- Whenever you're about to `npm install` / `brew install` something — it might
  already be there
- Whenever you're about to write a `curl` against an API — the catalog might
  point to a CLI or MCP server that's faster and authenticated

## Project-specific tools

If `~/.pi/agent/clis.md` doesn't have what you need, check the current project
root for `AGENTS.md`, `CLAUDE.md`, or `README` — project-specific tools live
there.

## Workflow

1. **Identify the task domain.** "Find a PR" → GitHub; "query analytics" → BigQuery;
   "deploy worker" → Cloudflare; "post Slack" → Slack API; etc.
2. **Look up in catalog.** Find the matching CLI or MCP server.
3. **Verify auth.** Run the auth-check command listed (e.g. `gh auth status`).
   If unauthenticated, either inform the user or use a different path.
4. **Execute** with appropriate confirmation:
   - Read operations: free
   - Writes that affect shared state (production deploy, DB write, force push,
     posting messages): **always confirm with user first**
5. **Update catalog** if you find a useful pattern not already documented —
   tell the user and add a one-line note.

## When to ask the user

- CLI not in catalog and not in project docs → ask before installing or
  guessing the path
- Auth state shown as missing → ask whether to set it up or use a different
  approach
- Sensitive write operation → confirm even if listed in the catalog as
  "common pattern"

## Catalog maintenance

The catalog is hand-curated at `~/.pi/agent/clis.md`. If many entries are
stale, suggest the user run a refresh (e.g. `~/.pi/agent/bin/refresh-clis.sh`
if it exists) or that we generate a refresh script together.

## Examples

**User**: "어제 머지된 PR들 보여줘"
1. Read catalog → "GitHub" section → `gh` CLI logged in.
2. `gh pr list --state merged --search "merged:>2026-04-30"` (or use `github-mcp-server` MCP if available).
3. Format and show.

**User**: "BigQuery에서 어제 가입자 수 알려줘"
1. Read catalog → "BigQuery" section → `bigquery` MCP server is connected (read-only) and `bq` CLI also available.
2. Use MCP `bigquery.query` for safety + structured output.
3. Show count, mention which dataset.

**User**: "production 워커 배포해줘"
1. Read catalog → `wrangler` CLI.
2. **Confirm with user** before running `wrangler deploy` (production write).
3. Verify env (`wrangler whoami`) and target environment.

**User**: "AWS S3에 파일 업로드"
1. Catalog says aws is **not authenticated**.
2. Inform user, ask whether to configure or use a different path.
