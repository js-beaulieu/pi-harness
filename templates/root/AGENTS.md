# Workspace instructions

This is a coordination root. Product repositories live in `projects/`; read each repository's `AGENTS.md` before changing it.

The parent Pi session orchestrates and must never edit `projects/**`. Canonical knowledge is `docs/`; only the parent accesses it through `workspace_knowledge`.

For planning, load `workspace-development-loop` and `workspace-knowledge-protocol` first. Call knowledge orientation and read relevant Project Architecture References, Contracts, and Decisions, then use the `codebase-memory` MCP, before targeted direct code reads. Never inspect package internals or `node_modules/` to rediscover this workflow. Direct reads are allowed everywhere except `docs/`.

For exploration and implementation, use the `subagent` tool with the named `explore`, `impl`, or `impl-lite` agents—never generic `delegate`. Run them asynchronously (`async: true`, `clarify: false`, `context: "fresh"`, `artifacts: false`, `acceptance: { level: "none", reason: "Pi Harness owns worker evidence, CI, and review." }`). Use `wait` only when there is no independent orchestration work. The exact named agents receive the model pins from `workspace.yaml`; only one implementation writer may work in a checkout at once. `/workspace:plan <subject>` creates a separate, reattachable worktree and switches Pi into it automatically. Use `/workspace:continue <id>` to return to a saved workflow.

Session hooks are declared in `workspace.yaml` as workspace or project `setup` / `cleanup` command arrays. They run directly from the extension, never as subagents: `$PWD` is the new session worktree, `PH_WORKSPACE_BASE` is the primary coordination root, and project hooks additionally receive `PH_PROJECT_BASE` for the primary product checkout. Use the base paths to copy ignored local state, for example `cp "$PH_PROJECT_BASE/.env" .env`; do not rediscover them with Git commands.

Use `/workspace:plan`, `/workspace:code`, and `/workspace:done` for the enforced lifecycle. Use configured CI commands as the minimum validation requirement. Review requires PRs only where a GitHub remote and usable local `gh` push permission exist. Never force-push or merge through this workflow.
