# Workspace configuration

`workspace.yaml` is the only workspace-specific configuration input. It is committed and user-owned. The pre-Pi `pi-harness init` command creates it; `/workspace:sync` reads it and reconciles the generated runtime files.

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

Run `pi-harness init` before opening Pi, then place cloned or initialized repositories beneath `projects/`. `/workspace:onboard` inspects those local checkouts only—Git metadata, checked-out CI workflows, Taskfiles, and package scripts—then asks the user to confirm CI, dependencies, and model pins. It never calls GitHub, the web, `gh`, or a remote; it never creates or clones repositories.

The agent stages the complete proposed manifest, then asks its single token-bound Apply / Revise / Cancel question. An Apply response writes the manifest and synchronizes generated configuration; there is no `/workspace:onboard apply` slash command.
