import assert from "node:assert/strict";
import test from "node:test";
import { branchName, createWorkflow, isPlanPhaseCommand, isReadOnlyPhaseCommand, transition } from "../extensions/workflow-core.ts";

test("workflow lifecycle and branch names are constrained", () => {
  const state = createWorkflow("Fix pagination crash", "s");
  assert.equal(branchName(state.subject), "fix/fix-pagination-crash");
  assert.equal(transition(state, "code").phase, "code");
  assert.throws(() => transition(state, "review"), /Cannot transition/);
});

test("non-code shell policy is narrow", () => {
  assert.equal(isReadOnlyPhaseCommand("git status --short && rg TODO"), true);
  assert.equal(isPlanPhaseCommand("git -C projects/api switch -c feat/add-search"), true);
  assert.equal(isReadOnlyPhaseCommand("git push"), false);
  assert.equal(isReadOnlyPhaseCommand("echo nope > file"), false);
});
