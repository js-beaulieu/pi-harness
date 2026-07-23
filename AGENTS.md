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

## Why the knowledge base exists

The knowledge base (and the backfill that builds it) has one purpose: an agent picking up a feature, bug, or change must be able to infer where to look for specific existing logic **without grepping, reading a pile of files, and re-inferring everything from scratch every time**. It is a durable, feature-and-decision-oriented capture of **what/why/where** that is richer than what `git log` alone reveals. Every change to `extensions/workflow.ts`, `agents/backfill.md`, `skills/knowledge-protocol/SKILL.md`, or the recorder's validation must be judged against that purpose.

### Knowledge invariants (non-negotiable)

These are the contract. Do not soften them to make a stuck backfill "just proceed" — that trades a blocked run for a silently-corrupt knowledge base, which is strictly worse.

- **Record every changing thing.** Every durable behavior, decision, or locator that changes in a scope must be captured by a node or a review disposition, or explicitly classified as no-durable-knowledge with a factual reason. A recorder change that silently drops a submitted node, claim, or review because it "doesn't fit" violates this — it loses knowledge the agent meant to record. If a submission is genuinely out of place, **reject it at stage time with an actionable message** (teach the agent the correct shape, e.g. use `moved` to re-assign anchor ownership, or re-derive impact) rather than silently discarding it at commit.
- **No dead references.** Anchors and claim paths must point at real current code. Pruning vanished locators is allowed **only at the final current-snapshot audit** (where "current" is well-defined) and must never silently delete a node that still has a surviving anchor. Stale-locators in a *history* segment are not "dead" — they describe the segment's endpoint; a later segment or the final audit updates them.
- **The recorder is the authority, and its job is to force the right shape, not to paper over the agent's mistakes.** Auto-defaulting a missing review to `unchanged`, auto-dropping an "extra" node, or adopting a title are acceptable **only** when they preserve or refine information (title is decorative; a redundant unmappedReview for a path already owned by an anchor adds nothing). They are forbidden when they would hide that the agent failed to engage with a change. When in doubt, reject with a message that tells the agent exactly what to fix.
- **Completeness is per-scope and validated over the assembled set.** Every impacted node gets one review; every uncovered changed path gets one classification. This is what makes the knowledge base navigable — nothing changing in a segment is left ambiguous.
- **One owner per changed path.** A new node may only anchor paths that are currently unmapped (not owned by an existing node). Re-organizing ownership (moving a code file's owning node) is expressed with a `moved` review on the existing node, not by creating a parallel new node — a parallel node would duplicate ownership and lose provenance.
- **History-segment ingestion and session-scope ingestion are the same mechanism, scoped differently.** A history segment is a pinned chunk of historical commits; a session scope is the working-tree changes of one `workspace:code` unit of work. Both answer "what durable knowledge changed in *these* paths?" and must be recorded with the **same** validation rules: the same review-completeness, the same `related:`-only defaulting, the same duplicate-ownership and out-of-scope rejections, the same claim-narration guard (a session claim must not narrate "then I changed…" any more than a history claim may). **Never special-case `source.type === "session"` to be stricter or more lenient than `source.type === "history"`.** The only ingresion with different rules is the **final current-snapshot audit** (`source.type === "snapshot"`): there, "current" is well-defined, so pruned vanished locators, mandatory What/How/Where claims, and "current code file must be anchored" are correct. If you find yourself writing `if (source.type === "session")` in the recorder, stop — history and session diverging is the bug, not the feature.

When a backfill stalls, the correct response is to make the failure **legible and actionable** (a precise error naming the field and the fix) and to fix the recorder so the agent can record correctly — never to make the stall go away by discarding submissions.

## Workflow invariants

The parent session orchestrates but does not edit product checkouts. Canonical `docs/` are accessed only through the workspace knowledge tools. Session worktrees are created and entered automatically through `/workspace:plan`, use manifest-provided setup and cleanup commands, and are removed only after a clean-state check. Never add force-push or merge behavior.
