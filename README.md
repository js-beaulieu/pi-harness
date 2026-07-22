# Pi Harness

Pi Harness is a local-first, multi-repository workflow for Pi. A private coordination repository holds the workspace manifest and Git-backed canonical knowledge, while product repositories live beneath `projects/`.

```text
you approve scope and transitions → Pi orchestrates → workers explore or implement → PRs
```

The enforced lifecycle is `plan → code → review → done`.

## Bootstrap before opening Pi

Install from a tagged public GitHub release directly—no npmjs or GitHub Packages registry is required:

```sh
npx --yes github:js-beaulieu/pi-harness#v0.1.5 init
```

The command is idempotent. It creates/adopts the coordination root, initializes it as a Git repository on `main` when needed, commits the initial workspace state so the first `/workspace:plan` can create a session worktree, writes local `.pi/settings.json` pinned to that tag, and creates `projects/`, `docs/`, `workspace.yaml`, mise, and Task files. It does not start Pi, so it works equally with Paseo, the Pi TUI, and other Pi hosts. `init` refuses to run in a non-empty directory that is not already a pi-harness workspace; pass `--force` to override, for example `npx --yes github:js-beaulieu/pi-harness#v0.1.5 init existing-dir --force`.

For local package development, pass a local Pi package source explicitly, for example `pi-harness init . --source ../../pi-harness`. This prevents a test workspace from trying to fetch an unpublished Git tag.

Next, clone existing product repositories or create and initialize greenfield repositories under `projects/`. Open Pi normally and say that you want to onboard the workspace, or run:

```text
/workspace:onboard
```

Onboarding examines local checkouts only: Git metadata, checked-out CI workflows, Taskfiles, and package scripts. It never calls GitHub, the web, `gh`, or remote inspection; it never creates or clones repositories. It proposes the complete manifest, uses structured questions for dependencies, uncertain CI commands, model pins, and workspace/project setup and cleanup commands for session worktrees, then applies only after an explicit **Apply now** confirmation.

## Daily flow

```text
/workspace:plan Add saved searches
/workspace:code
/workspace:code Fix the review feedback
/workspace:done
/workspace:continue add-saved-searches
/workspace:cleanup add-saved-searches

/workspace:knowledge-backfill          # all managed projects
/workspace:knowledge-backfill api web  # selected managed projects
```

`/workspace:plan` makes concurrency the default. It creates an ignored `worktrees/<workflow>/` coordination checkout plus matching product worktrees, forks the current Pi conversation into that cwd, switches the active runtime in-process, and runs optional setup commands from `workspace.yaml`. Hooks run in a direct extension-owned shell, not a subagent; their worktree is `$PWD`, and `PH_WORKSPACE_BASE` / `PH_PROJECT_BASE` point to the original checkouts for copying local state such as `.env` files. The original Pi session is preserved. `/workspace:continue <id>` locates and switches back to the saved worktree conversation; use `/workspace:cleanup <id>` from the primary checkout after completion. Cleanup runs configured teardown, removes only clean worktrees, and preserves branches.

`/workspace:plan` then creates a session-scoped plan and a separate workspace branch for coordination changes. Its required order is knowledge orientation (project Knowledge map to focused capability/component nodes, then related Architecture References, contracts, and decisions), code-graph discovery, then targeted direct code inspection. It identifies projects/contracts/risks/validation and creates durable Plans, Tasks, and project architecture references. It may create recorded feature branches but cannot edit product code.

`/workspace:code` is your explicit implementation authorization. The parent orchestrator launches `impl` for complex/multi-file work and `impl-lite` for narrow work via Pi Subagents, asynchronously and with one writer per checkout. A workspace session has its own checkout of every configured product, so sessions can run independently. Those exact names receive the manifest model pins. Workers return changed files, checks, deviations, risks, and blockers; they do not write canonical knowledge. Before review, the parent records the same structured what/why/how/where tree claims used by backfill, scoped to the current session's changed paths—no eventual production commit IDs are required. The review gate requires an impact checklist for every changed project.

Pi commits workspace knowledge/configuration on its own branch before review. A workspace PR is required alongside affected product PRs whenever its GitHub origin and the local `gh` session permit it. Pi can enter review only after CI and code-index evidence are recorded. Review is read-only. `/workspace:done` is closure only; Pi never merges or force-pushes.

## Configuration and ownership

`workspace.yaml` is the committed source of truth for:

- project paths, optional origin remotes, default branches, dependencies, and required CI commands;
- orchestrator/worker model pins;
- subagent async/intercom behavior and compact versus full supervisor-message rendering;
- code-graph lifecycle (or an explicitly overridden command); and
- permission defaults.

`/workspace:sync` regenerates `.pi-harness/`, managed Pi settings, MCP configuration, and permission configuration, and bumps the pinned `pi-harness` git-source version in `.pi/settings.json` to match the running package. It preserves `workspace.yaml`, `docs/`, root instructions, and unrelated Pi/MCP settings. To upgrade, bump the pin in `.pi/settings.json` to a newer tag, restart Pi, then run `/workspace:sync` — or run `/workspace:sync X.Y.Z` with a version higher than the installed one to bump and regenerate in one step.

`docs/` is canonical authored knowledge. Only the parent session accesses it through the workspace knowledge tools; direct native reads/writes and shell access are blocked. Start with `workspace_knowledge` orientation, follow the relevant project Knowledge map to the narrowest capability/component node, then read related References, Contracts, and Decisions before exploring code. `workspace_knowledge_record` records factual named sections, creates valid structured entries, preserves unnamed sections, and leaves wording-only or formatting-only changes untouched.

`/workspace:knowledge-backfill` uses each selected project's configured default-branch history to build a progressive-disclosure knowledge tree—not a second Git log or code index. Before processing, Pi computes every project's complete contiguous oldest-to-newest segment sequence entirely from Git/repository metadata, without graph or shell analysis, then asks one question for the whole run. You can start, cancel, split a segment, or merge adjacent segments; chronology cannot be reordered. Once the plan is shown, Pi stops all investigation until you answer. A dedicated read-only `backfill` agent validates each segment against project history, endpoint source, and the code graph; it cannot edit code or canonical docs. The parent immediately records stable claims about what a capability does, why it exists, how it works, and where an agent should search before retrieving the next segment.

Generated knowledge records facts and rationale, not change-history metadata. Project maps lead to focused capability/component nodes containing facts, rationale, paths, symbols, and search terms. Maps visibly warn while history or current-snapshot validation is incomplete. After history, a mandatory full-snapshot pass checks every existing node and tracked file against current source and graph, requires every current code file to be anchored and listed in a generated ownership index, replaces obsolete claims, and retires absent behavior. Only a map marked current-snapshot validated is ready as the actionable starting point for future features and fixes. Onboarding offers this backfill as an optional next step and never starts it without consent.

Pi Subagent debug artifacts are disabled for Harness delegations and `.pi-subagents/` is ignored at the coordination root. Product repositories are never expected to add Harness-specific ignore rules.

The code graph is mandatory structural acceleration, never a source of truth. It is bundled with Pi Harness and launched through the Node executable that is already running Pi—no Corepack, pnpm, or workspace runtime is assumed. Use it before broad reading for architecture, ownership, call paths, routes, and cross-project impact.

## Security boundary

This is an enforcement layer inside a trusted Pi installation. It constrains native Pi tools and permission-system actions, but cannot prevent a user from disabling the package, approving an action, or using another terminal. Use an OS sandbox for untrusted code.

## Development

```sh
pnpm test
pnpm lint
```

Contributor guidance is in [AGENTS.md](AGENTS.md).
