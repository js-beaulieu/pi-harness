# Product Workspace

This private coordination repository contains canonical knowledge and configuration for product repositories under `projects/`.

## First use

Clone or initialize product repositories beneath `projects/`, then open Pi and ask it to onboard this workspace. Pi analyzes local checkouts only, proposes `workspace.yaml`, and applies it only after an explicit structured confirmation. This root is already a Git repository; add a remote and establish its initial `main` commit before you need workspace PRs.

## Work

```text
/workspace:plan <subject>
/workspace:code
/workspace:code <review feedback>
/workspace:done
/workspace:continue <id>
/workspace:cleanup <id>
```

`/workspace:plan <subject>` creates `worktrees/<workflow>/` with a coordination worktree and matching product worktrees, forks the current conversation there, and switches Pi into it automatically. Hooks run directly from the extension: `$PWD` is the new worktree, `PH_WORKSPACE_BASE` is this primary root, and project hooks also receive `PH_PROJECT_BASE`. This makes a project hook such as `cp "$PH_PROJECT_BASE/.env" .env` reliable without Git path discovery. Use `/workspace:continue <id>` to return to a saved workflow. When it is merged or no longer needed, run `/workspace:cleanup <id>` from this primary checkout; teardown removes only clean worktrees and leaves branches available.

The parent session coordinates; workers edit product checkouts. The parent alone maintains canonical `docs/` through `workspace_knowledge`. Planning starts with knowledge orientation: follow the relevant project Knowledge map to the narrowest capability/component nodes, read related Project Architecture References, Contracts, and Decisions, then use `codebase-memory` and inspect code selectively. Workspace documentation/configuration is committed on its own workflow branch and receives a PR whenever this root has usable GitHub access. Local-only or inaccessible repositories may complete review without a PR.

After onboarding, Pi offers `/workspace:knowledge-backfill` as an optional next step; add project names to limit the sweep. Pi plans every project from metadata, presents one complete contiguous oldest-to-newest sequence with commit subjects and commit/file/line/evidence estimates, and asks once to start, cancel, split a segment, or merge adjacent segments. It stops all tools while awaiting that answer, then analyzes each segment with a dedicated read-only agent while the parent records what/why/how/where guidance immediately. After history, a mandatory current-snapshot pass checks every node and tracked file, requires every code file to be anchored, and removes or retires obsolete guidance. Only a current-snapshot-validated map is ready for development. `workspace:code` records equivalent session-scoped knowledge, and review is blocked until each changed project's checklist is complete.
