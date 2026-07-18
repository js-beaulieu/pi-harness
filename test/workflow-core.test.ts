import assert from "node:assert/strict";
import test from "node:test";
import { branchName, createWorkflow, isPlanPhaseCommand, isReadOnlyPhaseCommand, transition } from "../extensions/workflow-core.ts";

test("workflow lifecycle and branch names are constrained", () => {
  const state = createWorkflow("Fix pagination crash", "s");
  assert.equal(branchName(state.subject), "fix/pagination-crash");
  assert.equal(branchName("Add saved searches for completed tasks in the dashboard"), "feat/saved-searches-completed-tasks");
  assert.equal(branchName("Refactor the authentication error handling for OAuth callbacks"), "refactor/authentication-error-handling-oauth");
  assert.equal(branchName("Document workspace onboarding"), "docs/workspace-onboarding");
  assert.equal(transition(state, "code").phase, "code");
  assert.throws(() => transition(state, "review"), /Cannot transition/);
});

test("non-code shell policy is narrow", () => {
  assert.equal(isReadOnlyPhaseCommand("git status --short && rg TODO"), true);
  assert.equal(isReadOnlyPhaseCommand("git -C projects/api config --get remote.origin.url && git -C projects/api log --oneline -5"), true);
  assert.equal(isReadOnlyPhaseCommand("for repo in projects/*; do git -C \"$repo\" status --short; done"), true);
  assert.equal(isReadOnlyPhaseCommand("git -C projects/api worktree list && git -C projects/api config --get-all remote.origin.fetch"), true);
  assert.equal(isReadOnlyPhaseCommand("find projects -maxdepth 3 -type f && task --list"), true);
  assert.equal(isPlanPhaseCommand("git -C projects/api switch -c feat/add-search"), true);
  assert.equal(isPlanPhaseCommand("git -C projects/api switch -c docs/workspace-onboarding"), true);
  assert.equal(isReadOnlyPhaseCommand("git push"), false);
  assert.equal(isReadOnlyPhaseCommand("git config user.name Alice"), false);
  assert.equal(isReadOnlyPhaseCommand("sed -i 's/a/b/' file"), false);
  assert.equal(isReadOnlyPhaseCommand("echo nope > file"), false);
});
