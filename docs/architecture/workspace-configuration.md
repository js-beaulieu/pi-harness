# Workspace configuration

`workspace.yaml` is the only workspace-specific configuration input. It is committed and user-owned. `/workspace:init` creates it; `/workspace:sync` reads it and reconciles the generated runtime files.

| Section | Owns | Generated consumer |
| --- | --- | --- |
| `workspace` | documentation and repository-root directories; workflow naming defaults | workflow extension and managed scripts |
| `projects` | repositories or existing local paths, dependencies, CI-equivalent commands | clone/status/index tasks and PR ordering |
| `agents` | orchestrator and worker model pins | `.pi/settings.json` |
| `pi.packages` | companion Pi package sources and pinned versions | `.pi/settings.json` |
| `code_graph` | mandatory local code-graph server command and lifecycle | `.mcp.json` and index tasks |
| `permissions` | default shell, MCP, and external-directory posture | `.pi/extensions/pi-permission-system/config.json` |

`/workspace:sync` overwrites `.pi-harness/` and its generated Pi/MCP/permission outputs. It does not overwrite `workspace.yaml`, `docs/`, root `AGENTS.md`, the root README, or custom root tasks. It preserves unrelated MCP servers and unrelated Pi settings.

The YAML controls workspace values, not the workflow’s non-negotiable invariants: phase transitions, parent/worker write separation, documentation schema, code-graph requirement, and no-force-push policy remain enforced by the package.

## Guided onboarding

After `/workspace:init`, `/workspace:onboard` can inspect GitHub repositories supplied by the user and the models available to the local Pi installation. It proposes default branches from GitHub metadata and CI commands only when it finds an explicit `task ci`, package `ci`, `lint`, or `test` script. Dependencies remain an explicit user decision. The agent stages, but cannot apply, a complete reviewed manifest; only the user’s `/workspace:onboard apply` command writes it and synchronizes generated files.

Existing local directories are valid onboarding references too: use a path such as `projects/api`, an absolute path, or an existing name beneath `projects/`. They are inspected directly without `gh`; an origin remote is recorded when present. Any cloneable Git remote URL is also valid and uses Git rather than `gh`. A bare missing name is a greenfield local project: `/workspace:onboard apply` creates its Git repository under `projects/` only after the user reviewed and explicitly applied the proposal. A local-only project without a remote omits `repository`, and bootstrap leaves its path alone rather than attempting a clone.
