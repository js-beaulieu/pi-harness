---
name: workspace-knowledge-protocol
description: Maintain idempotent, scoped canonical Markdown knowledge through workspace_knowledge.
---

# Knowledge protocol

Only the parent orchestrator accesses canonical `docs/`, and only through `workspace_knowledge`. Search before reading; validate before creating; update exactly one known section at a time.

Do not rewrite an entry to improve wording, ordering, or formatting. An update must represent a material fact change, use the exact previously read section content, and provide a reason and evidence. If normalized content is unchanged, leave the file untouched.

Use Decisions for accepted choices, Plans for approved scope, Tasks for active execution state, Contracts for interfaces and compatibility, and References for durable orientation. Keep transient exploration and worker narration out of the knowledge base.
