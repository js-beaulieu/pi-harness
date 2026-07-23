---
name: workspace-knowledge-protocol
description: Maintain idempotent, scoped canonical Markdown knowledge through workspace_knowledge.
---

# Knowledge protocol

Only the parent orchestrator accesses canonical `docs/`, and only through the workspace knowledge tools. Search before reading with `workspace_knowledge`. For every write, use `workspace_knowledge_record`: provide the kind, title, and a map of factual sections. It creates a structured entry when absent, or updates only the named sections when present. Kinds and section names are intentionally flexible; use the meaningful names from the work rather than trying to fit a Markdown template.

Do not rewrite an entry to improve wording, ordering, or formatting. A record must represent a material fact change. The record tool compares normalized section content and leaves wording-only or formatting-only changes untouched; it preserves unnamed sections.

Use Decisions for accepted choices, Plans for approved scope, Tasks for active execution state, Contracts for interfaces and compatibility, and References for durable orientation. Record final implementation evidence before review: knowledge is frozen in review and done. Keep transient exploration and worker narration out of the knowledge base.

Maintain one `Reference` titled `Project architecture — <project>` for each project touched by the workflow. It is the broad architectural pickup document. The generated project Knowledge map is the progressive-disclosure navigator: follow it to the narrowest capability/component node, then use related Contracts and Decisions before asking the graph a focused question.

## Git history backfill

Use `/workspace:knowledge-backfill [projects...]` to build that navigator from historical context. Follow these phases literally; do not discover the protocol with shell commands.

1. **Plan:** call `history_status` and then `history_plan` once for every selected project. Complexity and sizing are inferred internally from repository/history metadata. Do not call graph/MCP, permissions, parent `bash`, Git, grep, find, subagents, or direct source reads.
2. **Present and stop:** call `history_start` once with `projects` set to the complete selected project-name list. Present its complete multi-project estimate and immediately call `ask_user` with its exact question, context, and choices. Call no other tool until the answer arrives. This is a processing plan, not completed code investigation; detailed analysis intentionally begins only after `Start processing`.
3. **Adjust if requested:** ask which project and adjacent chronological boundary should move. Call `history_plan` again only for that project with replacement positive `segmentSizes` totaling its remaining commits, then call `history_start` again with the complete selected project-name list. Splitting a segment and merging adjacent segments are supported; commit order never changes.
4. **Process:** only after `Start processing`, call `history_chunk` with no additional inputs and follow its `requiredSequence` exactly.

For each returned segment, launch exactly one `backfill` agent with the `scopeToken` and all segment evidence using `async:true`, `clarify:false`, `context:"fresh"`, `artifacts:false`, and no cwd override. The backfill agent queries the code graph, calls `workspace_knowledge_impact` with the `scopeToken` and graph result, inspects the source, and records its durable knowledge directly by calling `workspace_knowledge_tree_record` itself with the `impactToken` and complete dispositions. For a large or rename/delete-heavy segment it stages nodes incrementally with `mode:"stage"` then finalizes with `mode:"commit"` under the same `impactToken`; a failed commit keeps the buffer so the agent can amend and retry. Do not set `turnBudget` or `toolBudget` — the read-only backfill agent must run to completion. Immediately `wait` once for that run; never poll status. The child is the only component that uses read-only Git/grep and the code graph for detailed segment analysis.

After the run completes, call `history_chunk` again with no additional inputs to advance to the next segment; the backfill agent already recorded its segment, so do not read a handoff file or re-record it. The `impactToken` is a short opaque hex string the backfill agent copies exactly as-is from its `workspace_knowledge_impact` result. Report the resulting guidance paths so progress is visible in `docs/knowledge/`.

Backfill nodes use a stable taxonomy: `architecture/`, `features/`, `interfaces/`, `data/`, `operations/`, or `quality/`, followed by a stable concept path. Reuse an existing node and claim key whenever possible. Give every node layered impact anchors: owned path patterns, important qualified symbols (`path` + `name` + optional `kind`), interface/config/route identifiers, and related knowledge nodes. Search terms remain navigation hints, not impact anchors. Each claim has one category:

- **What** — behavior, responsibility, or invariant.
- **Why** — rationale or constraint; mark intent inferred from commit subject/body as **Inferred intent**.
- **How** — mechanism, flow, configuration, or collaboration.
- **Where** — the best starting point for investigation.

Every claim supplies concrete repository-relative paths plus useful symbols/search terms. Historical messages may inform the agent's understanding of a decision, but knowledge records only what/why/how/where—never commit details, chronology, or change narration. Changed paths prove relevance and location, but never intent.

For every history or session scope, inspect changed symbols and interfaces with the code graph, then call `workspace_knowledge_impact`. Explicitly disposition every listed existing node as `updated`, `unchanged`, `moved`, or `retired`, and classify every uncovered changed path as `new-node` or `no-durable-knowledge`. Never silently omit a candidate. Supply factual reasons for unchanged/no-knowledge results and replacement nodes for updated/moved/retired/new-node results.

During `workspace:code`, call `workspace_knowledge(action="session_scope", project=...)` after implementation for each changed project, run the same scope-token → impact-token → disposition flow, then record node changes. Relevance is limited to the active session and no final commit IDs are needed. Review is blocked until every changed project has completed this checklist.

Keep user-facing progress free of implementation protocol: say “history segment”, “existing knowledge”, “uncovered files”, and “recorded project guidance”; never expose tokens, digests, receipts, recorder names, ingestion, or schema debugging. A project map marked **Backfill incomplete** or **Current snapshot validation pending** must not be presented as current-state development guidance.

After all history segments are recorded, `current_scope` is mandatory for each project. Call it to get the `scopeToken` and complete existing-node facts, then launch one `backfill` agent with the same `async:true` configuration used for history segments. The backfill agent queries the graph, calls `workspace_knowledge_impact`, checks every existing node against current behavior, classifies every current file, and records the result directly with `workspace_knowledge_tree_record`. For a wide-reaching snapshot audit it stages node-by-node with `mode:"stage"` then finalizes with `mode:"commit"` under the same `impactToken`. Every current code file must be covered by an active node and will appear explicitly in the generated code-file ownership index; `no-durable-knowledge` is allowed only for non-code files with a factual reason. For an updated current node, supply its complete current claim set so obsolete claims are removed. Retire nodes whose behavior no longer exists. Only a map marked **Current snapshot: validated** is actionable for future plans, features, and bug fixes.

Replaying a processed source state is a no-op even if the agent proposes new wording. Existing claim text/locators can change only under the same stable key when their located source state changed within the scope. Unrelated scopes do not regenerate maps or nodes. Generated directory maps expose short summaries and search hints; agents open progressively narrower nodes instead of scanning the repository.
