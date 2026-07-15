---
name: workspace-development-loop
description: Enforce Pi Harness planning, implementation, review, and closure phases.
---

# Development loop

The lifecycle is `plan → code → review → done`; only `/workspace:code` and `/workspace:done` accept user-controlled transitions. The parent orchestrates and never edits `projects/**`.

## Plan

Search canonical knowledge with `workspace_knowledge(action="search")`, read relevant entries, use the code graph for structural discovery, and create durable Plan and Task entries. Identify projects, dependency order, contracts, risks, validation, and acceptance criteria. Create branches only; do not edit product code.

## Code

Delegate complex/multi-file or contract work to `impl`; delegate narrow work to `impl-lite`. Every delegation includes: Plan/Task paths, target `AGENTS.md`, graph evidence, acceptance criteria, and branch. Workers return changed files, commands/results, risks, and blockers. The parent runs or collects configured CI, records checks, updates knowledge, and opens PRs.

## Review and done

Enter review only after CI and graph evidence are recorded and every affected project has a PR. Review is read-only. `/workspace:done` summarizes PRs in dependency order; never merge or force-push.
