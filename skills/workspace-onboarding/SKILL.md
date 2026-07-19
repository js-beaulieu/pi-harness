---
name: workspace-onboarding
description: Run a local-first, conversational onboarding flow for a Pi Harness workspace.
---

# Workspace onboarding

Use this skill after the human has placed repositories under `projects/`. This is a guided local analysis, not a source-import or cloning workflow.

1. Call `workspace_onboarding(action="discover")` without source arguments.
2. Explain the local Git, CI workflow, Taskfile, and package-script evidence. Do not call GitHub, the web, `gh`, or remote-inspection commands. Empty non-repositories are ignored rather than turned into a user decision.
3. Use `ask_user` to confirm CI for every included project, dependency relationships, model pins, and session-worktree lifecycle commands. Ask separately for workspace setup/cleanup and each project's setup/cleanup; an empty array is a valid explicit choice. Lifecycle commands run in an extension-owned shell, not a subagent, with the worktree as `$PWD`. For project hooks, offer `PH_PROJECT_BASE` to copy ignored local state (for example, `cp "$PH_PROJECT_BASE/.env" .env`) without Git-path discovery. Discovered scripts are evidence, not consent. Do not infer CI requirements, lifecycle commands, or model preferences without confirmation. Ask normal conversational questions for open-ended requirements.
4. Present the complete proposed `workspace.yaml`, including `workspace.setup`, `workspace.cleanup`, and every project's `setup` / `cleanup` arrays. Do not infer dependencies, CI commands, or lifecycle commands without evidence or confirmation.
5. Immediately stage that exact manifest with `workspace_onboarding(action="propose")`; staging is not approval and does not change the workspace.
6. Ask exactly one approval question with context `pi-harness:onboarding-apply:<token>` and exactly `Apply now`, `Revise proposal`, or `Cancel` choices. This is the only approval gate. Apply only after the user selects `Apply now`; on `Revise proposal`, revise and restage before asking again.

Onboarding never creates, clones, or modifies product repositories. It writes only the approved manifest and generated configuration.
