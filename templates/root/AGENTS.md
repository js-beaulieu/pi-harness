# Workspace instructions

This is a coordination root. Product repositories live in `projects/`; read each repository's `AGENTS.md` before changing it.

The parent Pi session orchestrates and must never edit `projects/**`. Delegate discovery to `explore`, complex implementation to `impl`, and narrow changes to `impl-lite`. Canonical knowledge is `docs/`; only the parent accesses it through `workspace_knowledge`.

Use `/workspace:plan`, `/workspace:code`, and `/workspace:done` for the enforced lifecycle. Use configured CI commands as the minimum validation requirement. Never force-push or merge through this workflow.
