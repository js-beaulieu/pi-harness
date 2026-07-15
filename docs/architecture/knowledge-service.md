# Knowledge service

`docs/` is the canonical, Git-reviewed knowledge base. It is not an opaque memory store and it is never generated from a code graph.

The first package release implements a local Pi knowledge tool with a deliberately small but enforced structured model:

- `Decision` — an accepted choice, alternatives, consequences, and review date.
- `Plan` — scope, acceptance criteria, dependencies, and validation plan.
- `Task` — lifecycle state, current step, blockers, and resumption context.
- `Contract` — owned interface, consumers, compatibility policy, and validation.
- `Reference` — durable orientation or operational knowledge.

Every entry is Markdown with YAML frontmatter (`title`, `kind`, `status`), a matching H1, and required headings defined by its kind. The tool owns safe paths, validates those invariants, searches titles/frontmatter/body, and writes an audit-friendly complete file. `workspace-knowledge-protocol` defines exactly what belongs in each entry and what does not.

Only the orchestrator may write canonical knowledge. Implementation and exploration subagents can read/search it but report their findings back; the orchestrator turns material reports, decisions, deviations, and contract changes into durable documentation. Writes are allowed in `plan` and `code` only, and must be complete before review.

Updates are section-scoped compare-and-patch operations, not document rewrites. They require exact expected section content plus a change reason and evidence. Normalized no-ops do not write the file or update its timestamp; wording-only and formatting-only changes are prohibited by protocol rather than guessed at by a model.

## Enforcement and future MCP interface

The custom Pi tool is phase-aware because it runs in the same process as the workflow extension. It is the write interface used by the initial workflow.

The next extraction point is a local stdio MCP server with the same operations. It will read the same Markdown files and maintain only a disposable local search index. Pi will consume it through `pi-mcp-adapter`; other harnesses can use its standard `.mcp.json` entry. Before exposing write tools through the adapter, the server will require a short-lived workflow capability issued by the extension, so an arbitrary MCP caller cannot bypass phase gates.

That capability bridge is intentionally not faked in this initial package: a generic MCP proxy has no reliable Pi-session identity on its own. The in-process tool keeps the enforcement claim true today.
