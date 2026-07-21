# Workflow enforcement

The workflow is session-scoped and has four phases:

```text
plan → code → review → done
       ↑       │
       └───────┘
```

The user controls `plan → code`, `review → code`, and `review → done` through `/workspace:code` and `/workspace:done`. The agent may move `code → review` only through the workflow tool, after recording successful CI and code-index checks. `done` is terminal.

## What is enforced

The `pi-harness` extension intercepts every native Pi tool call before execution.

- Direct file changes are blocked outside `code`; workflow state is never writable through Pi’s normal file or shell tools.
- Knowledge writes go through `workspace_knowledge_record`; they are allowed only in `plan` and `code`. Planning begins with `workspace_knowledge` orientation so durable architecture, contracts, and decisions narrow later graph and source inspection.
- Pull-request creation is allowed only in `code`.
- During `plan`, `review`, and `done`, shell commands are limited to a small read-only Git/GitHub allowlist plus branch switching. A command that does not match is blocked rather than guessed safe.
- The parent Pi session is treated as an orchestrator and cannot edit `projects/**`. Only `pi-subagents` children in the `impl` or `impl-lite` role receive editing tools. Harness launches disable disposable Pi Subagent artifacts so they do not appear in product worktrees.
- `/workspace:plan` creates one coordination worktree and one worktree per configured product, forks the current persisted Pi conversation, and switches the active runtime to the isolated cwd. `/workspace:continue` locates and re-enters the saved worktree session without deleting the source conversation; its docs and product checkouts remain isolated from other workflows.
- `pi-subagents` exposes only the tools declared by each role. `@gotgenes/pi-permission-system` adds runtime allow/ask/deny policy for paths, shell commands, MCP tools, and skills.

## What cannot be enforced

This is not a sandbox or an authorization system outside Pi. A user can approve an `ask` prompt, remove an extension, use another terminal, or run a different agent. The workflow also cannot prove a command’s semantics from arbitrary shell text. The extension therefore fails closed outside `code`; in `code`, the permission package supplies an additional command/path policy.

Run Pi in a container or OS-level sandbox for untrusted repositories, credentials, or autonomous execution. Pi’s own security guidance applies independently of this workflow.

## Review-entry receipt

The transition tool requires recorded `ci_passed` and `code_indexed` checks. These are a structured receipt for the workflow, not cryptographic proof that a test command was honest or complete. Each project’s `ci` list remains the authoritative required check list and the review prompt requires workers to report exact commands and outcomes.
