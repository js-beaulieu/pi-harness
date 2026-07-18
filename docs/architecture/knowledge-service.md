# Knowledge service

`docs/` is the canonical, Git-reviewed knowledge base. It is not an opaque memory store and it is never generated from a code graph.

The local Pi knowledge tool provides a durable, Git-reviewed orientation layer:

- `Decision` — an accepted choice, alternatives, consequences, and review date.
- `Plan` — scope, acceptance criteria, dependencies, and validation plan.
- `Task` — lifecycle state, current step, blockers, and resumption context.
- `Contract` — owned interface, consumers, compatibility policy, and validation.
- `Reference` — durable orientation or operational knowledge; every actively maintained product has a `Project architecture — <project>` reference.

Entries are Markdown with an H1 and factual sections. Well-known kinds receive useful starter headings, but kinds and headings remain flexible so the tool records knowledge rather than rejecting valid facts for formatting reasons. `workspace_knowledge` exposes an orientation view over durable References, Contracts, and Decisions; `workspace_knowledge_record` updates only named factual sections and preserves the rest. `workspace-knowledge-protocol` defines what belongs in each entry and what does not.

Only the orchestrator may write canonical knowledge. Implementation and exploration subagents can read/search it but report their findings back; the orchestrator turns material reports, decisions, deviations, and contract changes into durable documentation. Writes are allowed in `plan` and `code` only, and must be complete before review.

Updates are section-scoped, not document rewrites. Normalized no-ops do not write the file or update its timestamp; wording-only and formatting-only changes are prohibited by protocol rather than guessed at by a model. Plans and Tasks capture workflow state; architecture references, contracts, and decisions capture what a later agent needs to know before narrowing graph and source-code investigation.

## Enforcement and future MCP interface

The custom Pi tool is phase-aware because it runs in the same process as the workflow extension. It is the write interface used by the initial workflow.

The next extraction point is a local stdio MCP server with the same operations. It will read the same Markdown files and maintain only a disposable local search index. Pi will consume it through `pi-mcp-adapter`; other harnesses can use its standard `.mcp.json` entry. Before exposing write tools through the adapter, the server will require a short-lived workflow capability issued by the extension, so an arbitrary MCP caller cannot bypass phase gates.

That capability bridge is intentionally not faked in this initial package: a generic MCP proxy has no reliable Pi-session identity on its own. The in-process tool keeps the enforcement claim true today.
