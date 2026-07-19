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
```

For isolated concurrent work, run `/workspace:session <subject>` from this root. It creates `worktrees/<session>/` with a coordination worktree and matching product worktrees, then runs any configured setup commands. Hooks run directly from the extension: `$PWD` is the new worktree, `PH_WORKSPACE_BASE` is this primary root, and project hooks also receive `PH_PROJECT_BASE`. This makes a project hook such as `cp "$PH_PROJECT_BASE/.env" .env` reliable without Git path discovery. Open Pi there and run the supplied `/workspace:continue <id>` command before planning. When the session is merged or no longer needed, `/workspace:session cleanup <session>` runs teardown and removes only clean worktrees; its branches remain available.

The parent session coordinates; workers edit product checkouts. The parent alone maintains canonical `docs/` through `workspace_knowledge`. Planning starts with knowledge orientation: read relevant Project Architecture References, Contracts, and Decisions, then use `codebase-memory`, then inspect code selectively. Workspace documentation/configuration is committed on its own workflow branch and receives a PR whenever this root has usable GitHub access. Local-only or inaccessible repositories may complete review without a PR.
