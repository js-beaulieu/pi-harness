import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("the parent may not edit a product checkout", async () => workspace(async (root) => {
  const h = harness(); const response = await h.events.get("tool_call")({ toolName: "write", input: { path: "projects/api/x.ts" } }, ctx(root));
  assert.equal(response.block, true); assert.match(response.reason, /orchestrator/);
}));

test("onboard command is a local-only conversation", async () => workspace(async (root) => {
  const h = harness(); await h.commands.get("workspace:onboard").handler("", ctx(root));
  assert.match(h.messages[0].message, /local-first/); await assert.rejects(h.commands.get("workspace:onboard").handler("owner/repo", ctx(root)), /takes no sources/);
}));
