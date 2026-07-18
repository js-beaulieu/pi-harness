# Code intelligence

Code intelligence and authored knowledge have different jobs.

`codebase-memory-mcp` is required workspace infrastructure. It produces a local, disposable structural graph: symbols, imports, call chains, routes, impact paths, and cross-service links. This workflow makes cross-repository planning and review a first-class operation; without a structural graph, agents repeatedly discover the same coupling by expensive, incomplete file-by-file search. The graph is therefore worth its small local setup cost. It is not an architecture decision record, task tracker, or source of truth.

Keep this specialized system rather than hand-rolling a code graph. Reimplementing parsers, language resolution, cross-project edges, incremental indexing, and query tooling would recreate a substantial system with no workflow-specific advantage. The workspace adds the useful integration around it instead:

- Pi Harness bundles the MCP package and launches it with Pi's own Node executable; workspaces do not need Corepack, pnpm, or a separate global install.
- `task index` and `task reindex` derive project paths from `workspace.yaml`.
- Workers use the graph for structural discovery before broad file reading.
- The workflow records that an index is current before entering review.
- The graph database and any exported artifacts are disposable; Markdown in `docs/` remains authoritative.

The binary is pinned in the Pi Harness package; `.mcp.json` exposes it through `pi-mcp-adapter`. It stays local to the developer machine and its graph database remains disposable, but every workspace installation has the same discovery capability.
