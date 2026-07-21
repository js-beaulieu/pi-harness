# Workspace configuration

`workspace.yaml` is the only workspace-specific configuration input. It is committed and user-owned. The pre-Pi `pi-harness init` command creates it; `/workspace:sync` reads it and reconciles the generated runtime files.

| Section | Owns | Generated consumer |
| --- | --- | --- |
| `workspace` | documentation, product-checkout, and session-worktree directories; workflow naming defaults | workflow extension and managed scripts |
| `projects` | repositories or existing local paths, dependencies, CI-equivalent commands | clone/status/index tasks and PR ordering |
| `agents` | orchestrator and worker model pins | `.pi/settings.json` |
| `pi.packages` | companion Pi package sources and pinned versions | `.pi/settings.json` |
| `code_graph` | mandatory local code-graph server command and lifecycle | `.mcp.json` and index tasks |
| `permissions` | default shell, MCP, and external-directory posture | `.pi/extensions/pi-permission-system/config.json` |

`/workspace:sync` overwrites `.pi-harness/` and its generated Pi/MCP/permission outputs. It does not overwrite `workspace.yaml`, `docs/`, root `AGENTS.md`, the root README, or custom root tasks. It preserves unrelated MCP servers and unrelated Pi settings.

The YAML controls workspace values, not the workflow’s non-negotiable invariants: phase transitions, parent/worker write separation, documentation schema, code-graph requirement, and no-force-push policy remain enforced by the package.

`workspace.worktrees_directory` defaults to `worktrees`. `/workspace:plan <subject>` creates a coordination Git worktree there and matching Git worktrees for every configured product beneath its `projects/` directory. The directory is ignored by the primary coordination repository. Pi forks the current persisted conversation into the worktree and switches its active runtime in-process. `/workspace:continue <id>` searches these worktrees and re-enters the saved Pi session, falling back to a conversation fork only when the original target session is unavailable.

Optional `workspace.setup` / `workspace.cleanup` and per-project `setup` / `cleanup` arrays contain shell commands to run in a newly created or about-to-be-removed worktree. Use them for dependency installation, generated local configuration, containers, and teardown. Cleanup runs project commands first, then workspace commands, and removal refuses any worktree that remains dirty. List sessions with `workspace_session(action="list")`; clean one from the primary checkout with `/workspace:cleanup <id>` or `workspace_session(action="cleanup", session="<session>")`. Session creation is available only through `/workspace:plan`. Branches are deliberately retained for review or later deletion.

Lifecycle commands run as direct, extension-owned `/bin/sh -lc` processes—not as Pi tool calls or subagents—so the Pi permission system does not gate `pnpm install`, copying an ignored `.env`, or similar setup. Every hook runs with its session worktree as `$PWD`, removes `PI_SUBAGENT_CHILD` values, and receives only the source paths that its worktree cannot otherwise know:

| Variable | Meaning |
| --- | --- |
| `PH_WORKSPACE_BASE` | original coordination workspace |
| `PH_PROJECT_BASE` | original product checkout; project hooks only |

For example, a project hook can copy an ignored local environment file with `test -f "$PH_PROJECT_BASE/.env" && cp "$PH_PROJECT_BASE/.env" .env` before running its installer.

## Guided onboarding

Run `pi-harness init` before opening Pi, then place cloned or initialized repositories beneath `projects/`. `/workspace:onboard` inspects those local checkouts only—Git metadata, checked-out CI workflows, Taskfiles, and package scripts—then asks the user to confirm CI, dependencies, model pins, and workspace/project setup and cleanup commands for session worktrees. It proposes empty lifecycle arrays when no command has been confirmed. It never calls GitHub, the web, `gh`, or a remote; it never creates or clones repositories.

The agent stages the complete proposed manifest, then asks its single token-bound Apply / Revise / Cancel question. An Apply response writes the manifest and synchronizes generated configuration; there is no `/workspace:onboard apply` slash command.
