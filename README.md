# Pi Harness

Pi Harness is a local-first, multi-repository workflow for Pi. A private coordination repository holds the workspace manifest and Git-backed canonical knowledge, while product repositories live beneath `projects/`.

```text
you approve scope and transitions → Pi orchestrates → workers explore or implement → PRs
```

The enforced lifecycle is `plan → code → review → done`.

## Bootstrap before opening Pi

Install from a tagged public GitHub release directly—no npmjs or GitHub Packages registry is required:

```sh
npx --yes github:js-beaulieu/pi-harness#v0.1.0 init
```

The command is idempotent. It creates/adopts the coordination root, writes local `.pi/settings.json` pinned to that tag, and creates `projects/`, `docs/`, `workspace.yaml`, mise, and Task files. It does not start Pi, so it works equally with Paseo, the Pi TUI, and other Pi hosts.

For local package development, pass a local Pi package source explicitly, for example `pi-harness init . --source ../../pi-harness`. This prevents a test workspace from trying to fetch an unpublished Git tag.

Next, clone existing product repositories or create and initialize greenfield repositories under `projects/`. Open Pi normally and say that you want to onboard the workspace, or run:

```text
/workspace:onboard
```

Onboarding examines local checkouts only: Git metadata, checked-out CI workflows, Taskfiles, and package scripts. It never calls GitHub, the web, `gh`, or remote inspection; it never creates or clones repositories. It proposes the complete manifest, uses structured questions for dependencies, uncertain CI commands, and model pins, then applies only after an explicit **Apply now** confirmation.

## Daily flow

```text
/workspace:plan Add saved searches
/workspace:code
/workspace:code Fix the review feedback
/workspace:done
```

`/workspace:plan` creates a session-scoped plan. Pi searches canonical knowledge, uses the mandatory code graph for structural discovery, identifies projects/contracts/risks/validation, and creates durable Plan and Task entries. It may create recorded feature branches but cannot edit product code.

`/workspace:code` is your explicit implementation authorization. The parent orchestrator delegates every product edit: `impl` handles complex or multi-file work and `impl-lite` handles narrow work. Workers return changed files, checks, deviations, risks, and blockers; they do not write canonical knowledge.

Pi can enter review only after CI and code-index evidence are recorded and every affected project has a PR. Review is read-only. `/workspace:done` is closure only; Pi never merges or force-pushes.

## Configuration and ownership

`workspace.yaml` is the committed source of truth for:

- project paths, optional origin remotes, default branches, dependencies, and required CI commands;
- orchestrator/worker model pins;
- code-graph command and lifecycle; and
- permission defaults.

`/workspace:sync` regenerates `.pi-harness/`, managed Pi settings, MCP configuration, and permission configuration. It preserves `workspace.yaml`, `docs/`, root instructions, and unrelated Pi/MCP settings.

`docs/` is canonical authored knowledge. Only the parent session accesses it through `workspace_knowledge`; direct native reads/writes and shell access are blocked. Entries are structured Markdown. Updates are section-scoped compare-and-patch operations that require evidence and leave the file untouched for wording-only or formatting-only changes.

The code graph is mandatory structural acceleration, never a source of truth. Use it before broad reading for architecture, ownership, call paths, routes, and cross-project impact.

## Security boundary

This is an enforcement layer inside a trusted Pi installation. It constrains native Pi tools and permission-system actions, but cannot prevent a user from disabling the package, approving an action, or using another terminal. Use an OS sandbox for untrusted code.
