---
name: workspace-knowledge-protocol
description: Maintain idempotent, scoped canonical Markdown knowledge through workspace_knowledge.
---

# Knowledge protocol

Only the parent orchestrator accesses canonical `docs/`, and only through the workspace knowledge tools. Search before reading with `workspace_knowledge`. For every write, use `workspace_knowledge_record`: provide the kind, title, and a map of factual sections. It creates a structured entry when absent, or updates only the named sections when present. Kinds and section names are intentionally flexible; use the meaningful names from the work rather than trying to fit a Markdown template.

Do not rewrite an entry to improve wording, ordering, or formatting. A record must represent a material fact change. The record tool compares normalized section content and leaves wording-only or formatting-only changes untouched; it preserves unnamed sections.

Use Decisions for accepted choices, Plans for approved scope, Tasks for active execution state, Contracts for interfaces and compatibility, and References for durable orientation. Record final implementation evidence before review: knowledge is frozen in review and done. Keep transient exploration and worker narration out of the knowledge base.

Maintain one `Reference` titled `Project architecture — <project>` for each project touched by the workflow. It is the pickup document: record purpose, owned responsibilities, entry points, important modules/symbols, runtime/data flow, external interfaces, configuration, validation, and graph anchors. Update it only for material architectural knowledge. A later agent should be able to read this Reference, relevant Contracts and Decisions, then ask the graph a narrow question instead of rediscovering the repository file by file.
