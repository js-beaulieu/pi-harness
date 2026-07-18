import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import workspaceFlow from "../extensions/workflow.ts";

async function workspace(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-harness-"));
  await writeFile(path.join(root, "workspace.yaml"), "workspace:\n  docs_directory: docs\n  projects_directory: projects\nprojects: []\n");
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function harness() {
  const commands = new Map<string, any>(); const tools = new Map<string, any>(); const events = new Map<string, any>(); const asks = new Map<string, any>(); const messages: any[] = [];
  workspaceFlow({ registerCommand: (name: string, value: any) => commands.set(name, value), registerTool: (value: any) => tools.set(value.name, value), on: (name: string, handler: any) => events.set(name, handler), events: { on: (name: string, handler: any) => asks.set(name, handler) }, setSessionName: () => undefined, sendUserMessage: (message: string, options: any) => messages.push({ message, options }) } as any);
  return { commands, tools, events, asks, messages };
}
const ctx = (cwd: string) => ({ cwd, sessionManager: { getSessionId: () => "session-a" }, ui: { notify: () => undefined } });

test("onboarding discovers only existing local projects and requires approval", async () => workspace(async (root) => {
  await mkdir(path.join(root, "projects", "api"), { recursive: true });
  await writeFile(path.join(root, "projects", "api", "package.json"), JSON.stringify({ packageManager: "pnpm@10", scripts: { lint: "x", test: "x" } }));
  const h = harness(); const result = await h.tools.get("workspace_onboarding").execute("id", { action: "discover" }, undefined, undefined, ctx(root));
  assert.deepEqual(result.details.repositories[0].ci, ["pnpm lint", "pnpm test"]);
  const staged = await h.tools.get("workspace_onboarding").execute("id", { action: "propose", manifest: result.details.manifest }, undefined, undefined, ctx(root));
  await assert.rejects(h.tools.get("workspace_onboarding").execute("id", { action: "apply", approvalToken: staged.details.approvalToken }, undefined, undefined, ctx(root)), /fresh ask_user/);
  h.asks.get("ask:answered")({ context: `pi-harness:onboarding-apply:${staged.details.approvalToken}`, response: { kind: "selection", selections: ["Apply now"] } });
  await h.tools.get("workspace_onboarding").execute("id", { action: "apply", approvalToken: staged.details.approvalToken }, undefined, undefined, ctx(root));
  assert.equal(existsSync(path.join(root, ".pi", "harness", "onboarding-proposal.json")), false);
}));

test("canonical docs are blocked outside the knowledge tool", async () => workspace(async (root) => {
  const h = harness(); const response = await h.events.get("tool_call")({ toolName: "read", input: { path: "docs/plan/x.md" } }, ctx(root));
  assert.equal(response.block, true); assert.match(response.reason, /workspace_knowledge/);
}));

test("knowledge record updates sections separated by blank lines", async () => workspace(async (root) => {
  const h = harness(); await h.commands.get("workspace:plan").handler("Record decisions", ctx(root));
  await mkdir(path.join(root, "docs", "plan"), { recursive: true });
  const entry = "docs/plan/record-decisions.md";
  await writeFile(path.join(root, entry), "# Record decisions\n\n## Context\n\nInitial context.\n\n## Acceptance criteria\n\n- Decide the contract.\n\n## Open questions\n\n- Which transport?\n");
  const result = await h.tools.get("workspace_knowledge_record").execute("id", { kind: "Plan", title: "Record decisions", sections: { "Acceptance Criteria": "- Contract is HTTP." } }, undefined, undefined, ctx(root));
  assert.equal(result.details.changed, true);
  assert.match(await readFile(path.join(root, entry), "utf8"), /## Acceptance criteria\n\n- Contract is HTTP\.\n\n## Open questions/);
}));

test("knowledge record creates and idempotently updates selected sections", async () => workspace(async (root) => {
  const h = harness(); await h.commands.get("workspace:plan").handler("Record plan", ctx(root));
  const tool = h.tools.get("workspace_knowledge_record");
  const first = await tool.execute("id", { kind: "Plan", title: "Record plan", sections: { Context: "Initial context.", Scope: "Only the API." } }, undefined, undefined, ctx(root));
  assert.equal(first.details.created, true);
  const second = await tool.execute("id", { kind: "Plan", title: "Record plan", sections: { Scope: "Only the API." } }, undefined, undefined, ctx(root));
  assert.equal(second.details.changed, false);
  await tool.execute("id", { kind: "Plan", title: "Record plan", sections: { Scope: "API and client." } }, undefined, undefined, ctx(root));
  const body = await readFile(path.join(root, "docs", "plan", "record-plan.md"), "utf8");
  assert.match(body, /## Context\n\nInitial context\./); assert.match(body, /## Scope\n\nAPI and client\./);
}));

test("knowledge record accepts an emergent kind and factual headings", async () => workspace(async (root) => {
  const h = harness(); await h.commands.get("workspace:plan").handler("Record workflow", ctx(root));
  const result = await h.tools.get("workspace_knowledge_record").execute("id", { kind: "Workflow Notes", title: "Implementation evidence", sections: { "Graph Evidence": "Routes resolve through gateway.", "Risks / Current Phase": "No migration required." } }, undefined, undefined, ctx(root));
  assert.equal(result.details.created, true);
  const body = await readFile(path.join(root, "docs", "workflow-notes", "implementation-evidence.md"), "utf8");
  assert.match(body, /## Graph Evidence\n\nRoutes resolve through gateway\./); assert.match(body, /## Risks \/ Current Phase\n\nNo migration required\./);
}));

test("knowledge orientation returns durable architecture and contract context", async () => workspace(async (root) => {
  const h = harness(); await h.commands.get("workspace:plan").handler("Orient", ctx(root));
  const record = h.tools.get("workspace_knowledge_record");
  await record.execute("id", { kind: "Reference", title: "Project architecture — api", sections: { Purpose: "Serves the public API." } }, undefined, undefined, ctx(root));
  await record.execute("id", { kind: "Contract", title: "API pagination", sections: { Owner: "api", Consumers: "web" } }, undefined, undefined, ctx(root));
  const result = await h.tools.get("workspace_knowledge").execute("id", { action: "orientation", projects: ["api"] }, undefined, undefined, ctx(root));
  assert.match(result.content[0].text, /Project architecture — api/); assert.match(result.content[0].text, /API pagination/);
}));

test("review does not require a PR for a local-only workspace", async () => workspace(async (root) => {
  const h = harness(); await h.commands.get("workspace:plan").handler("Local change", ctx(root)); await h.commands.get("workspace:code").handler("", ctx(root));
  await h.tools.get("workspace_workflow").execute("id", { action: "record_checks", ciPassed: true, codeIndexed: true }, undefined, undefined, ctx(root));
  const result = await h.tools.get("workspace_workflow").execute("id", { action: "enter_review" }, undefined, undefined, ctx(root));
  assert.equal(result.details.phase, "review"); assert.deepEqual(result.details.pullRequestsRequired, []);
}));

test("review requires workspace documentation to be committed", async () => workspace(async (root) => {
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  execFileSync("git", ["-C", root, "switch", "-q", "-c", "feat/local-change"]);
  const h = harness(); await h.commands.get("workspace:plan").handler("Local change", ctx(root)); await h.commands.get("workspace:code").handler("", ctx(root));
  await h.tools.get("workspace_workflow").execute("id", { action: "record_checks", ciPassed: true, codeIndexed: true }, undefined, undefined, ctx(root));
  await assert.rejects(h.tools.get("workspace_workflow").execute("id", { action: "enter_review" }, undefined, undefined, ctx(root)), /Commit all non-ignored coordination-workspace changes/);
}));

test("the parent may not edit a product checkout", async () => workspace(async (root) => {
  const h = harness(); const response = await h.events.get("tool_call")({ toolName: "write", input: { path: "projects/api/x.ts" } }, ctx(root));
  assert.equal(response.block, true); assert.match(response.reason, /orchestrator/);
}));

test("subagent launches disable project-scoped debug artifacts", async () => workspace(async (root) => {
  const h = harness(); const blocked = await h.events.get("tool_call")({ toolName: "subagent", input: { agent: "impl-lite", task: "Change one file." } }, ctx(root));
  assert.equal(blocked.block, true); assert.match(blocked.reason, /artifacts:false/);
  const allowed = await h.events.get("tool_call")({ toolName: "subagent", input: { agent: "impl-lite", task: "Change one file.", artifacts: false } }, ctx(root));
  assert.equal(allowed, undefined);
}));

test("docs path protection does not block conventional commit messages", async () => workspace(async (root) => {
  const h = harness(); await h.commands.get("workspace:plan").handler("Commit docs", ctx(root)); await h.commands.get("workspace:code").handler("", ctx(root));
  const allowed = await h.events.get("tool_call")({ toolName: "bash", input: { command: "git commit -m 'docs: update architecture'" } }, ctx(root));
  assert.equal(allowed, undefined);
  const blocked = await h.events.get("tool_call")({ toolName: "bash", input: { command: "git diff -- docs/reference/api.md" } }, ctx(root));
  assert.equal(blocked.block, true); assert.match(blocked.reason, /workspace_knowledge/);
}));

test("onboard command is a local-only conversation", async () => workspace(async (root) => {
  const h = harness(); await h.commands.get("workspace:onboard").handler("", ctx(root));
  assert.match(h.messages[0].message, /local-first/); await assert.rejects(h.commands.get("workspace:onboard").handler("owner/repo", ctx(root)), /takes no sources/);
}));
