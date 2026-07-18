# Workspace layout

Each product workspace is a private coordination root for independent product repositories. It owns product-specific instructions, authored knowledge, and configuration; the reusable workflow package owns workflow behavior and generated tooling. Product repositories are nested clones, intentionally ignored by the workspace repository.

```text
root/
├── .git/                 # coordination repository; docs/configuration are committed here
├── .pi-harness/          # managed, committed package-generated tools
├── docs/                 # user-owned canonical, reviewed knowledge base
├── projects/             # ignored child-repository clones
├── workspace.yaml        # user-owned workspace source of truth
├── AGENTS.md             # user-owned product-specific rules
└── Taskfile.yml          # user-owned wrapper importing .pi-harness/
```

`workspace.yaml` is the contract between managed scripts and the workflow package. It declares a stable workspace name, repository URLs, local paths, default branches, dependency names, CI-equivalent commands, agent model pins, Pi companion packages, code-graph registration, and default permission posture. `/workspace:sync` reconciles its Pi/MCP/permission sections into generated files. Project order is derived from `depends_on`; use it for bootstrap, code-graph indexing, and suggested PR merge order.

The root repository does not assume a language, package manager, deployment model, or number of child projects. Repository-specific rules stay in each project’s own `AGENTS.md` and are read by worker agents before editing.
