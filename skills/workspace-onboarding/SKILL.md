---
name: workspace-onboarding
description: Run a local-first, conversational onboarding flow for a Pi Harness workspace.
---

# Workspace onboarding

Use this skill after the human has placed repositories under `projects/`. This is a guided local analysis, not a source-import or cloning workflow.

1. Call `workspace_onboarding(action="discover")` without source arguments.
2. Explain the local Git, CI workflow, Taskfile, and package-script evidence. Do not call GitHub, the web, `gh`, or remote-inspection commands.
3. Use `ask_user` for bounded decisions: dependency direction, uncertain CI commands, model pins, and final approval. Ask normal conversational questions for open-ended requirements.
4. Present the complete proposed `workspace.yaml`. Do not infer dependencies or CI commands without evidence or confirmation.
5. Once the user approves exact YAML, call `workspace_onboarding(action="propose")`.
6. Ask `ask_user` with context `pi-harness:onboarding-apply:<token>` and exactly `Apply now`, `Revise proposal`, or `Cancel` choices. Apply only after the user selects `Apply now`.

Onboarding never creates, clones, or modifies product repositories. It writes only the approved manifest and generated configuration.
