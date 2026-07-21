# Pi Harness contributor instructions

Pi Harness is a TypeScript Pi extension and workspace initializer. Keep workflow behavior, generated templates, and documentation consistent whenever changing user-facing behavior.

## Repository layout

- `extensions/` contains the workflow extension and its pure policy helpers.
- `agents/`, `skills/`, `chains/`, and `prompts/` define the Pi-facing workflow.
- `templates/` contains the files copied into initialized workspaces.
- `test/` contains Node's built-in test-runner coverage.

## Development

Use pnpm and run both checks before handing off a change:

```sh
pnpm test
pnpm lint
```

Use `apply_patch` for source edits. Preserve user-owned workspace files and avoid destructive Git operations. The repository may contain unrelated local changes; do not revert or overwrite them.

## Workflow invariants

The parent session orchestrates but does not edit product checkouts. Canonical `docs/` are accessed only through the workspace knowledge tools. Session worktrees are created and entered automatically through `/workspace:plan`, use manifest-provided setup and cleanup commands, and are removed only after a clean-state check. Never add force-push or merge behavior.
