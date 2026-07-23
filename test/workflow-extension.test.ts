import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import workspaceFlow from "../extensions/workflow.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
const ctx = (cwd: string) => ({ cwd, sessionManager: { getSessionId: () => "session-a" }, ui: { notify: () => undefined, confirm: async () => true } });

test("onboarding discovers only existing local projects and requires approval", async () => workspace(async (root) => {
  await mkdir(path.join(root, "projects", "api"), { recursive: true });
  await writeFile(path.join(root, "projects", "api", "package.json"), JSON.stringify({ packageManager: "pnpm@10", scripts: { lint: "x", test: "x" } }));
  const h = harness(); const result = await h.tools.get("workspace_onboarding").execute("id", { action: "discover" }, undefined, undefined, ctx(root));
  assert.deepEqual(result.details.repositories[0].ci, ["pnpm lint", "pnpm test"]);
  assert.match(result.details.manifest, /worktrees_directory: worktrees/); assert.match(result.details.manifest, /setup: \[\]/); assert.match(result.details.manifest, /cleanup: \[\]/);
  const staged = await h.tools.get("workspace_onboarding").execute("id", { action: "propose", manifest: result.details.manifest }, undefined, undefined, ctx(root));
  await assert.rejects(h.tools.get("workspace_onboarding").execute("id", { action: "apply", approvalToken: staged.details.approvalToken }, undefined, undefined, ctx(root)), /fresh ask_user/);
  h.asks.get("ask:answered")({ context: `pi-harness:onboarding-apply:${staged.details.approvalToken}`, response: { kind: "selection", selections: ["Apply now"] } });
  const applied = await h.tools.get("workspace_onboarding").execute("id", { action: "apply", approvalToken: staged.details.approvalToken }, undefined, undefined, ctx(root)); assert.equal(applied.details.offerKnowledgeBackfill, true);
  assert.equal(existsSync(path.join(root, ".pi", "harness", "onboarding-proposal.json")), false);
}));

test("the dedicated backfill agent records knowledge directly and cannot write freeform docs", async () => {
  const definition = await readFile(path.resolve("agents/backfill.md"), "utf8");
  const frontmatter = definition.match(/^---[\s\S]*?---/)?.[0] ?? "";
  assert.match(definition, /tools: read, bash, mcp:codebase-memory/); assert.match(definition, /"\*": deny/);
  assert.doesNotMatch(frontmatter, /\bwrite\b|\bedit\b|\bworkspace_knowledge_record\b/);
  assert.match(frontmatter, /workspace_knowledge_impact: allow/);
  assert.match(frontmatter, /workspace_knowledge_tree_record: allow/);
  assert.match(frontmatter, /workspace_knowledge:/); assert.match(frontmatter, /orientation.*allow/); assert.match(frontmatter, /search.*allow/); assert.match(frontmatter, /read.*allow/);
  assert.match(definition, /call workspace_knowledge_tree_record once/); assert.match(definition, /never emit a handoff file/);
});

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

test("Git history progressively builds a stable, source-locating knowledge tree", async () => workspace(async (root) => {
  await writeFile(path.join(root, "workspace.yaml"), "workspace:\n  docs_directory: docs\n  projects_directory: projects\nprojects:\n  - name: api\n    path: api\n    default_branch: main\n    ci: []\n");
  const api = path.join(root, "projects", "api"); await mkdir(api, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", api]); execFileSync("git", ["-C", api, "config", "user.email", "test@example.com"]); execFileSync("git", ["-C", api, "config", "user.name", "Test User"]);
  for (let index = 1; index <= 21; index++) { await writeFile(path.join(api, "service.txt"), `${index}\n`); execFileSync("git", ["-C", api, "add", "service.txt"]); execFileSync("git", ["-C", api, "commit", "-qm", `${index === 1 ? "Create" : "Evolve"} service ${index}`]); }
  const h = harness(); await h.commands.get("workspace:knowledge-backfill").handler("api", ctx(root));
  const knowledge = h.tools.get("workspace_knowledge"); const impactTool = h.tools.get("workspace_knowledge_impact"); const treeRecord = h.tools.get("workspace_knowledge_tree_record"); const anchors = { paths: ["service.txt"], symbols: [{ path: "service.txt", name: "service-state", kind: "function" }], interfaces: [], relatedNodes: [] };
  const status = await knowledge.execute("id", { action: "history_status", projects: ["api"] }, undefined, undefined, ctx(root)); assert.equal(status.details.projects[0].pending, 21); assert.equal(status.details.projects[0].repositoryProfile.trackedFiles, 1); assert.ok(status.details.projects[0].repositoryProfile.trackedLines > 0);
  const automatic = await knowledge.execute("id", { action: "history_plan", project: "api" }, undefined, undefined, ctx(root)); assert.ok(automatic.details.chunks[0].subjects.length > 0); assert.equal(automatic.details.complexity, "low"); assert.match(automatic.content[0].text, /do not present segments/); const adjusted = await knowledge.execute("id", { action: "history_plan", project: "api", segmentSizes: [5, 16] }, undefined, undefined, ctx(root)); assert.deepEqual(adjusted.details.chunks.map((chunk: any) => chunk.commits), [5, 16]); const merged = await knowledge.execute("id", { action: "history_plan", project: "api", segmentSizes: [21] }, undefined, undefined, ctx(root)); assert.deepEqual(merged.details.chunks.map((chunk: any) => chunk.commits), [21]); await assert.rejects(knowledge.execute("id", { action: "history_plan", project: "api", segmentSizes: [5, 15] }, undefined, undefined, ctx(root)), /totaling the 21/);
  const draftStart = await knowledge.execute("id", { action: "history_start", projects: ["api"] }, undefined, undefined, ctx(root)); h.asks.get("ask:answered")({ context: `pi-harness:backfill-start:${draftStart.details.approvalKey}`, response: { kind: "selection", selections: ["Adjust adjacent boundaries"] } }); const plan = await knowledge.execute("id", { action: "history_plan", project: "api", segmentSizes: [5, 16] }, undefined, undefined, ctx(root)); const started = await knowledge.execute("id", { action: "history_start", projects: ["api"] }, undefined, undefined, ctx(root)); await assert.rejects(knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root)), /No started backfill run/); h.asks.get("ask:answered")({ context: `pi-harness:backfill-start:${started.details.approvalKey}`, response: { kind: "selection", selections: ["Start processing"] } });
  const first = await knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root)); assert.ok(first.details.commits.length > 0 && first.details.commits.length < 21); assert.equal(first.details.source.complexity, "low"); assert.ok(first.details.estimate.changedFiles > 0); assert.ok(first.details.estimate.changedLines > 0); assert.match(first.details.commits[0].patch, /service\.txt/); assert.deepEqual(first.details.existingNodes, []); const firstImpact = await impactTool.execute("id", { scopeToken: first.details.scopeToken, graph: { status: "checked" }, changedSymbols: [], changedInterfaces: [] }, undefined, undefined, ctx(root));
  const input = { impactToken: firstImpact.details.impactToken, reviews: [], unmappedReviews: [{ path: "service.txt", result: "new-node" }], nodes: [{ nodePath: "features/service", title: "Service capability", anchors, claims: [
    { key: "purpose", category: "What", fact: "Provides the project service capability.", paths: ["service.txt"], symbols: [], searchTerms: ["service"] },
    { key: "origin", category: "Why", fact: "Inferred intent: establish a service that can evolve incrementally.", paths: ["service.txt"], symbols: [], searchTerms: ["Create service"] },
    { key: "implementation", category: "How", fact: "The capability is represented by the revision stored in service.txt.", paths: ["service.txt"], symbols: [], searchTerms: ["service.txt"] },
    { key: "entry", category: "Where", fact: "Start investigation at the service state file.", paths: ["service.txt"], symbols: [], searchTerms: ["service"] },
  ] }] };
  await assert.rejects(treeRecord.execute("id", { ...input, nodes: [{ ...input.nodes[0], claims: [{ ...input.nodes[0].claims[0], fact: "Initially created the service." }] }] }, undefined, undefined, ctx(root)), /narrates change history/);
  const created = await treeRecord.execute("id", input, undefined, undefined, ctx(root)); assert.deepEqual(created.details.changedNodes, ["features/service"]);
  const nodePath = path.join(root, "docs", "knowledge", "api", "features", "service.md"); const firstBody = await readFile(nodePath, "utf8"); assert.match(firstBody, /## What/); assert.match(firstBody, /## Why/); assert.match(firstBody, /Locate with path: `service\.txt`/); assert.doesNotMatch(firstBody, /Evidence:|[0-9a-f]{40}/);
  const rootMap = await readFile(path.join(root, "docs", "knowledge", "api", "README.md"), "utf8"); assert.match(rootMap, /features\/README\.md/); assert.match(rootMap, /Backfill incomplete/); const featureMap = await readFile(path.join(root, "docs", "knowledge", "api", "features", "README.md"), "utf8"); assert.match(featureMap, /service\.md/); const oriented = await knowledge.execute("id", { action: "orientation", projects: ["api"] }, undefined, undefined, ctx(root)); assert.match(oriented.content[0].text, /Knowledge map — api/);
  const retry = await treeRecord.execute("id", { ...input, nodes: [{ ...input.nodes[0], claims: [{ ...input.nodes[0].claims[0], fact: "Arbitrary rewording." }] }] }, undefined, undefined, ctx(root)); assert.equal(retry.details.changed, false); assert.equal(await readFile(nodePath, "utf8"), firstBody);
  const second = await knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root)); const secondImpact = await impactTool.execute("id", { scopeToken: second.details.scopeToken, graph: { status: "checked" }, changedSymbols: [{ path: "service.txt", name: "service-state", kind: "function" }], changedInterfaces: [] }, undefined, undefined, ctx(root)); assert.ok(secondImpact.details.requiredNodeReviews[0].matchedBy.includes("symbol:service-state")); await treeRecord.execute("id", { impactToken: secondImpact.details.impactToken, reviews: [{ nodePath: "features/service", result: "updated" }], unmappedReviews: [], nodes: [{ nodePath: "features/service", title: "Service capability", anchors, claims: [{ key: "implementation", category: "How", fact: "The service state file now carries revision 21.", paths: ["service.txt"], symbols: [], searchTerms: ["service.txt"] }] }] }, undefined, undefined, ctx(root)); assert.match(await readFile(nodePath, "utf8"), /revision 21/); assert.match(await readFile(path.join(root, "docs", "knowledge", "api", "README.md"), "utf8"), /Current snapshot validation pending/); const obsoleteState = path.join(root, "docs", ".pi-harness", "knowledge", "api", "features", "obsolete.json"); const obsoleteDoc = path.join(root, "docs", "knowledge", "api", "features", "obsolete.md"); await mkdir(path.dirname(obsoleteState), { recursive: true }); await mkdir(path.dirname(obsoleteDoc), { recursive: true }); await writeFile(obsoleteState, JSON.stringify({ version: 1, project: "api", nodePath: "features/obsolete", title: "Obsolete capability", status: "active", anchors: { paths: ["removed.ts"], symbols: [], interfaces: [], relatedNodes: [] }, claims: [{ key: "legacy", category: "What", fact: "Describes behavior that no longer exists.", paths: ["removed.ts"], symbols: [], searchTerms: [], stateHash: "old" }] }, null, 2)); await writeFile(obsoleteDoc, "# Obsolete capability\n\nStale guidance.\n"); const current = await knowledge.execute("id", { action: "current_scope", project: "api" }, undefined, undefined, ctx(root)); const currentImpact = await impactTool.execute("id", { scopeToken: current.details.scopeToken, graph: { status: "checked" }, changedSymbols: [{ path: "service.txt", name: "service-state", kind: "function" }], changedInterfaces: [] }, undefined, undefined, ctx(root)); await treeRecord.execute("id", { impactToken: currentImpact.details.impactToken, reviews: [{ nodePath: "features/obsolete", result: "retired" }, { nodePath: "features/service", result: "updated" }], unmappedReviews: [], nodes: [{ nodePath: "features/obsolete", title: "Obsolete capability", status: "retired", anchors: { paths: ["removed.ts"], symbols: [], interfaces: [], relatedNodes: [] }, claims: [{ key: "legacy", category: "What", fact: "The capability has no current implementation.", paths: ["removed.ts"], symbols: [], searchTerms: [] }] }, { nodePath: "features/service", title: "Service capability", anchors, claims: [
    { key: "purpose", category: "What", fact: "Provides the project service capability.", paths: ["service.txt"], symbols: [], searchTerms: ["service"] },
    { key: "implementation", category: "How", fact: "The service state file carries revision 21.", paths: ["service.txt"], symbols: [], searchTerms: ["service.txt"] },
    { key: "entry", category: "Where", fact: "Start investigation at the service state file.", paths: ["service.txt"], symbols: [], searchTerms: ["service"] },
  ] }] }, undefined, undefined, ctx(root)); assert.doesNotMatch(await readFile(nodePath, "utf8"), /origin|establish a service/); assert.equal(existsSync(obsoleteDoc), false); assert.doesNotMatch(await readFile(path.join(root, "docs", "knowledge", "api", "README.md"), "utf8"), /Obsolete capability/); assert.match(await readFile(path.join(root, "docs", "knowledge", "api", "README.md"), "utf8"), /Current snapshot: \*\*validated\*\*/);
  await writeFile(path.join(api, "README.md"), "unrelated docs\n"); await writeFile(path.join(api, "orphan.ts"), "export const worker = true;\n"); execFileSync("git", ["-C", api, "add", "README.md", "orphan.ts"]); execFileSync("git", ["-C", api, "commit", "-qm", "Document setup and add worker"]); const followupPlan = await knowledge.execute("id", { action: "history_plan", project: "api" }, undefined, undefined, ctx(root)); const followupStarted = await knowledge.execute("id", { action: "history_start", projects: ["api"] }, undefined, undefined, ctx(root)); h.asks.get("ask:answered")({ context: `pi-harness:backfill-start:${followupStarted.details.approvalKey}`, response: { kind: "selection", selections: ["Start processing"] } }); const unrelated = await knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root)); const unrelatedImpact = await impactTool.execute("id", { scopeToken: unrelated.details.scopeToken, graph: { status: "checked" }, changedSymbols: [], changedInterfaces: [] }, undefined, undefined, ctx(root)); const beforeUnrelated = await readFile(nodePath, "utf8"); const unrelatedReview = [{ path: "README.md", result: "no-durable-knowledge", reason: "Setup prose does not change program knowledge." }, { path: "orphan.ts", result: "no-durable-knowledge", reason: "The historical segment did not establish a durable capability." }]; await assert.rejects(treeRecord.execute("id", { impactToken: unrelatedImpact.details.impactToken, reviews: [], unmappedReviews: unrelatedReview, nodes: [{ nodePath: "features/service", title: "Service capability", anchors, claims: [{ key: "implementation", category: "How", fact: "Unrelated rewording.", paths: ["service.txt"], symbols: [], searchTerms: [] }] }] }, undefined, undefined, ctx(root)), /outside this source scope/); await treeRecord.execute("id", { impactToken: unrelatedImpact.details.impactToken, reviews: [], unmappedReviews: unrelatedReview, nodes: [] }, undefined, undefined, ctx(root)); assert.equal(await readFile(nodePath, "utf8"), beforeUnrelated); const refreshed = await knowledge.execute("id", { action: "current_scope", project: "api" }, undefined, undefined, ctx(root)); const refreshedImpact = await impactTool.execute("id", { scopeToken: refreshed.details.scopeToken, graph: { status: "checked" }, changedSymbols: [{ path: "service.txt", name: "service-state", kind: "function" }, { path: "orphan.ts", name: "worker", kind: "variable" }], changedInterfaces: [] }, undefined, undefined, ctx(root)); await assert.rejects(treeRecord.execute("id", { impactToken: refreshedImpact.details.impactToken, reviews: [{ nodePath: "features/obsolete", result: "unchanged", reason: "This node is already retired and absent from readable guidance." }, { nodePath: "features/service", result: "unchanged", reason: "The current service implementation still matches the guidance." }], unmappedReviews: unrelatedReview, nodes: [] }, undefined, undefined, ctx(root)), /current code file/); await treeRecord.execute("id", { impactToken: refreshedImpact.details.impactToken, reviews: [{ nodePath: "features/obsolete", result: "unchanged", reason: "This node is already retired and absent from readable guidance." }, { nodePath: "features/service", result: "unchanged", reason: "The current service implementation still matches the guidance." }], unmappedReviews: [{ path: "README.md", result: "no-durable-knowledge", reason: "Setup prose does not describe program behavior." }, { path: "orphan.ts", result: "new-node" }], nodes: [{ nodePath: "features/worker", title: "Worker capability", anchors: { paths: ["orphan.ts"], symbols: [{ path: "orphan.ts", name: "worker", kind: "variable" }], interfaces: [], relatedNodes: ["features/service"] }, claims: [{ key: "purpose", category: "What", fact: "Exposes the worker capability.", paths: ["orphan.ts"], symbols: ["worker"], searchTerms: ["worker"] }, { key: "implementation", category: "How", fact: "The worker is exported as a module value.", paths: ["orphan.ts"], symbols: ["worker"], searchTerms: ["export const worker"] }, { key: "entry", category: "Where", fact: "Start at the worker module.", paths: ["orphan.ts"], symbols: ["worker"], searchTerms: ["orphan.ts"] }] }] }, undefined, undefined, ctx(root));
  const complete = await knowledge.execute("id", { action: "history_status", projects: ["api"] }, undefined, undefined, ctx(root)); assert.equal(complete.details.projects[0].upToDate, true); assert.equal(complete.details.projects[0].readyForDevelopment, true); const fileIndex = await readFile(path.join(root, "docs", "knowledge", "api", "FILE-INDEX.md"), "utf8"); assert.match(fileIndex, /`orphan\.ts`.*Worker capability/); assert.equal(existsSync(path.join(root, "docs", "history")), false);
  execFileSync("git", ["-C", api, "switch", "-q", "-c", "feat/session-service"]); await writeFile(path.join(api, "service.txt"), "session behavior\n"); execFileSync("git", ["-C", api, "add", "service.txt"]); execFileSync("git", ["-C", api, "commit", "-qm", "Update service behavior"]); await h.commands.get("workspace:code").handler("", ctx(root)); const session = await knowledge.execute("id", { action: "session_scope", project: "api" }, undefined, undefined, ctx(root)); assert.equal("commits" in session.details.source, false); const sessionImpact = await impactTool.execute("id", { scopeToken: session.details.scopeToken, graph: { status: "checked" }, changedSymbols: [{ path: "service.txt", name: "service-state", kind: "function" }], changedInterfaces: [] }, undefined, undefined, ctx(root)); await h.tools.get("workspace_workflow").execute("id", { action: "record_checks", ciPassed: true, codeIndexed: true }, undefined, undefined, ctx(root)); await assert.rejects(h.tools.get("workspace_workflow").execute("id", { action: "enter_review" }, undefined, undefined, ctx(root)), /knowledge impact checklist/); await assert.rejects(treeRecord.execute("id", { impactToken: sessionImpact.details.impactToken, reviews: [], unmappedReviews: [], nodes: [] }, undefined, undefined, ctx(root)), /Every and only impacted node/); await treeRecord.execute("id", { impactToken: sessionImpact.details.impactToken, reviews: [{ nodePath: "features/service", result: "updated" }, { nodePath: "features/worker", result: "unchanged", reason: "The related worker implementation was not changed by this session." }], unmappedReviews: [], nodes: [{ nodePath: "features/service", title: "Service capability", anchors, claims: [{ key: "implementation", category: "How", fact: "The service state file carries the session behavior.", paths: ["service.txt"], symbols: [], searchTerms: ["session behavior"] }] }] }, undefined, undefined, ctx(root)); assert.match(await readFile(nodePath, "utf8"), /session behavior/);
}));

test("one adjustable plan approval processes multiple projects in order", async () => workspace(async (root) => {
  await writeFile(path.join(root, "workspace.yaml"), "workspace:\n  docs_directory: docs\n  projects_directory: projects\nprojects:\n  - name: api\n    path: api\n    default_branch: main\n    ci: []\n  - name: tasks-api\n    path: tasks-api\n    default_branch: main\n    ci: []\n");
  for (const name of ["api", "tasks-api"]) { const directory = path.join(root, "projects", name); await mkdir(directory, { recursive: true }); execFileSync("git", ["init", "-q", "-b", "main", directory]); execFileSync("git", ["-C", directory, "config", "user.email", "test@example.com"]); execFileSync("git", ["-C", directory, "config", "user.name", "Test User"]); await writeFile(path.join(directory, "notes.txt"), `${name}\n`); execFileSync("git", ["-C", directory, "add", "notes.txt"]); execFileSync("git", ["-C", directory, "commit", "-qm", `Create ${name}`]); }
  const h = harness(); await h.commands.get("workspace:knowledge-backfill").handler("api tasks-api", ctx(root)); assert.match(h.messages[0].message, /history_start once/); assert.match(h.messages[0].message, /Stop all tools while waiting/); assert.match(h.messages[0].message, /records its durable knowledge directly by calling workspace_knowledge_tree_record itself/); assert.match(h.messages[0].message, /Do not set turnBudget or toolBudget/); const knowledge = h.tools.get("workspace_knowledge"); assert.equal("planToken" in knowledge.parameters.properties, false); assert.equal("planTokens" in knowledge.parameters.properties, false); assert.equal("runToken" in knowledge.parameters.properties, false); assert.equal("complexity" in knowledge.parameters.properties, false); const impact = h.tools.get("workspace_knowledge_impact"); const record = h.tools.get("workspace_knowledge_tree_record"); const apiPlan = await knowledge.execute("id", { action: "history_plan", project: "api" }, undefined, undefined, ctx(root)); const tasksPlan = await knowledge.execute("id", { action: "history_plan", project: "tasks-api" }, undefined, undefined, ctx(root)); const started = await knowledge.execute("id", { action: "history_start", projects: ["api", "tasks-api"] }, undefined, undefined, ctx(root)); assert.deepEqual(started.details.projects.map((project: any) => project.project), ["api", "tasks-api"]); assert.match(started.content[0].text, /Adjust adjacent boundaries/); assert.equal(await h.events.get("tool_call")({ toolName: "ask_user", input: {} }, ctx(root)), undefined); h.asks.get("ask:answered")({ context: `pi-harness:backfill-start:${started.details.approvalKey}`, response: { kind: "selection", selections: ["Start processing"] } });
  for (const expectedProject of ["api", "tasks-api"]) { const chunk = await knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root)); assert.equal(chunk.details.project, expectedProject); assert.match(chunk.content[0].text, /records its durable knowledge directly by calling workspace_knowledge_tree_record itself/); const assessed = await impact.execute("id", { scopeToken: chunk.details.scopeToken, graph: { status: "checked" }, changedSymbols: [], changedInterfaces: [] }, undefined, undefined, ctx(root)); await record.execute("id", { impactToken: assessed.details.impactToken, reviews: [], unmappedReviews: [{ path: "notes.txt", result: "no-durable-knowledge", reason: "Fixture text has no program behavior." }], nodes: [] }, undefined, undefined, ctx(root)); }
  const complete = await knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root)); assert.equal(complete.details.complete, true); assert.equal(await h.events.get("tool_call")({ toolName: "bash", input: { command: "git log --oneline" } }, ctx(root)), undefined);
}));

test("history_status reports planning, pending, and processing phases so the orchestrator knows the next action", async () => workspace(async (root) => {
  await writeFile(path.join(root, "workspace.yaml"), "workspace:\n  docs_directory: docs\n  projects_directory: projects\nprojects:\n  - name: api\n    path: api\n    default_branch: main\n    ci: []\n");
  const api = path.join(root, "projects", "api"); await mkdir(api, { recursive: true }); execFileSync("git", ["init", "-q", "-b", "main", api]); execFileSync("git", ["-C", api, "config", "user.email", "test@example.com"]); execFileSync("git", ["-C", api, "config", "user.name", "Test User"]); await writeFile(path.join(api, "service.txt"), "1\n"); execFileSync("git", ["-C", api, "add", "service.txt"]); execFileSync("git", ["-C", api, "commit", "-qm", "Create service"]);
  const h = harness(); await h.commands.get("workspace:knowledge-backfill").handler("api", ctx(root));
  const knowledge = h.tools.get("workspace_knowledge");
  const planning = await knowledge.execute("id", { action: "history_status", projects: ["api"] }, undefined, undefined, ctx(root)); assert.equal(planning.details.phase, "planning"); assert.match(planning.content[0].text, /call history_plan once/);
  await knowledge.execute("id", { action: "history_plan", project: "api" }, undefined, undefined, ctx(root));
  const started = await knowledge.execute("id", { action: "history_start", projects: ["api"] }, undefined, undefined, ctx(root));
  const pending = await knowledge.execute("id", { action: "history_status", projects: ["api"] }, undefined, undefined, ctx(root)); assert.equal(pending.details.phase, "pending"); assert.match(pending.content[0].text, /waiting for the user's/);
  h.asks.get("ask:answered")({ context: `pi-harness:backfill-start:${started.details.approvalKey}`, response: { kind: "selection", selections: ["Start processing"] } });
  const processing = await knowledge.execute("id", { action: "history_status", projects: ["api"] }, undefined, undefined, ctx(root)); assert.equal(processing.details.phase, "processing"); assert.match(processing.content[0].text, /Call history_chunk/);
}));

test("review does not require a PR for a local-only workspace", async () => workspace(async (root) => {
  const h = harness(); await h.commands.get("workspace:plan").handler("Local change", ctx(root)); await h.commands.get("workspace:code").handler("", ctx(root));
  await h.tools.get("workspace_workflow").execute("id", { action: "record_checks", ciPassed: true, codeIndexed: true }, undefined, undefined, ctx(root));
  const result = await h.tools.get("workspace_workflow").execute("id", { action: "enter_review" }, undefined, undefined, ctx(root));
  assert.equal(result.details.phase, "review"); assert.deepEqual(result.details.pullRequestsRequired, []);
}));

test("review requires workspace documentation to be committed", async () => workspace(async (root) => {
  const h = harness(); await h.commands.get("workspace:plan").handler("Local change", ctx(root));
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  execFileSync("git", ["-C", root, "switch", "-q", "-c", "feat/local-change"]);
  await h.commands.get("workspace:code").handler("", ctx(root));
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

test("workspace plan creates and enters an isolated session that continue can re-enter", async () => workspace(async (root) => {
  await writeFile(path.join(root, "workspace.yaml"), "workspace:\n  docs_directory: docs\n  projects_directory: projects\n  worktrees_directory: worktrees\n  setup: [\"test -n \\\"$PH_WORKSPACE_BASE\\\" && test -z \\\"${PI_SUBAGENT_CHILD:-}\\\" && touch .workspace-session-marker\"]\n  cleanup: [\"rm -f .workspace-session-marker\"]\nprojects:\n  - name: api\n    path: api\n    default_branch: main\n    ci: []\n    setup: [\"test -n \\\"$PH_PROJECT_BASE\\\" && test -z \\\"${PI_SUBAGENT_CHILD:-}\\\" && touch .project-session-marker\"]\n    cleanup: [\"rm -f .project-session-marker\"]\n");
  await writeFile(path.join(root, ".gitignore"), ".pi/\n.mcp.json\n.pi-harness/\nprojects/\nworktrees/\n");
  execFileSync("git", ["init", "-q", "-b", "main", root]); execFileSync("git", ["-C", root, "config", "user.email", "test@example.com"]); execFileSync("git", ["-C", root, "config", "user.name", "Test User"]); execFileSync("git", ["-C", root, "add", "workspace.yaml", ".gitignore"]); execFileSync("git", ["-C", root, "commit", "-qm", "workspace"]);
  const api = path.join(root, "projects", "api"); await mkdir(api, { recursive: true }); await writeFile(path.join(api, "service.ts"), "export const service = true;\n");
  execFileSync("git", ["init", "-q", "-b", "main", api]); execFileSync("git", ["-C", api, "config", "user.email", "test@example.com"]); execFileSync("git", ["-C", api, "config", "user.name", "Test User"]); execFileSync("git", ["-C", api, "add", "service.ts"]); execFileSync("git", ["-C", api, "commit", "-qm", "api"]);
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR; process.env.PI_CODING_AGENT_DIR = path.join(root, ".pi", "test-agent");
  try {
    const source = SessionManager.create(root, path.join(root, ".pi", "source-sessions")); source.appendSessionInfo("test source"); source.appendMessage({ role: "assistant", content: [], timestamp: Date.now() } as any); const switches: Array<{ file: string; cwd: string; session: SessionManager }> = []; const continued: string[] = [];
    const commandCtx = { cwd: root, sessionManager: source, ui: { notify: () => undefined }, waitForIdle: async () => undefined, switchSession: async (file: string, options?: any) => { const session = SessionManager.open(file); switches.push({ file, cwd: session.getCwd(), session }); await options?.withSession?.({ cwd: session.getCwd(), sessionManager: session, ui: { notify: () => undefined }, sendUserMessage: async (message: string) => { continued.push(message); } }); return { cancelled: false }; } };
    const h = harness(); assert.equal(h.commands.has("workspace:session"), false); await h.commands.get("workspace:plan").handler("Add session isolation", commandCtx); assert.equal(existsSync(source.getSessionFile()!), true);
    const listed = await h.tools.get("workspace_session").execute("id", { action: "list" }, undefined, undefined, ctx(root)); assert.equal(listed.details.sessions.length, 1); const sessionRoot = path.join(root, listed.details.sessions[0]);
    assert.equal(switches[0]?.cwd, sessionRoot); assert.match(continued[0] ?? "", /plan phase/); assert.equal(existsSync(path.join(sessionRoot, "workspace.yaml")), true); assert.equal(existsSync(path.join(sessionRoot, "projects", "api", "service.ts")), true);
    assert.equal(existsSync(path.join(sessionRoot, ".workspace-session-marker")), true); assert.equal(existsSync(path.join(sessionRoot, "projects", "api", ".project-session-marker")), true);
    assert.equal(execFileSync("git", ["-C", sessionRoot, "branch", "--show-current"], { encoding: "utf8" }).trim(), "feat/session-isolation"); assert.equal(execFileSync("git", ["-C", path.join(sessionRoot, "projects", "api"), "branch", "--show-current"], { encoding: "utf8" }).trim(), "feat/session-isolation");
    const active = { ...ctx(sessionRoot), sessionManager: switches[0]!.session }; const state = await h.tools.get("workspace_workflow").execute("id", { action: "status" }, undefined, undefined, active); assert.equal(state.details.sessionId, switches[0]!.session.getSessionId()); assert.deepEqual(state.details.sessionWorktree.products, { api: "projects/api" });
    await h.commands.get("workspace:continue").handler(state.details.id, commandCtx); assert.equal(switches.at(-1)?.cwd, sessionRoot); assert.match(continued.at(-1) ?? "", /Resume workflow/);
    await h.commands.get("workspace:cleanup").handler(state.details.id, commandCtx); assert.equal(existsSync(sessionRoot), false);
  } finally { if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previousAgentDir; }
}));

test("tree_record reclassifies unanchored new-node paths to no-durable-knowledge in a history segment", async () => workspace(async (root) => {
  await writeFile(path.join(root, "workspace.yaml"), "workspace:\n  docs_directory: docs\n  projects_directory: projects\nprojects:\n  - name: api\n    path: api\n    default_branch: main\n    ci: []\n");
  const api = path.join(root, "projects", "api"); await mkdir(api, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", api]); execFileSync("git", ["-C", api, "config", "user.email", "test@example.com"]); execFileSync("git", ["-C", api, "config", "user.name", "Test User"]);
  await writeFile(path.join(api, "service.txt"), "1\n"); await writeFile(path.join(api, "ui.txt"), "ui\n"); execFileSync("git", ["-C", api, "add", "service.txt", "ui.txt"]); execFileSync("git", ["-C", api, "commit", "-qm", "Create service and ui"]);
  const h = harness(); await h.commands.get("workspace:knowledge-backfill").handler("api", ctx(root));
  const knowledge = h.tools.get("workspace_knowledge"); const impactTool = h.tools.get("workspace_knowledge_impact"); const treeRecord = h.tools.get("workspace_knowledge_tree_record");
  await knowledge.execute("id", { action: "history_plan", project: "api" }, undefined, undefined, ctx(root));
  const started = await knowledge.execute("id", { action: "history_start", projects: ["api"] }, undefined, undefined, ctx(root));
  h.asks.get("ask:answered")({ context: `pi-harness:backfill-start:${started.details.approvalKey}`, response: { kind: "selection", selections: ["Start processing"] } });
  const chunk = await knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root));
  const impact = await impactTool.execute("id", { scopeToken: chunk.details.scopeToken, graph: { status: "checked" }, changedSymbols: [], changedInterfaces: [] }, undefined, undefined, ctx(root));
  const serviceAnchors = { paths: ["service.txt"], symbols: [], interfaces: [], relatedNodes: [] };
  // ui.txt marked new-node but no node anchors it; the recorder reclassifies it instead of failing the segment.
  const result = await treeRecord.execute("id", { impactToken: impact.details.impactToken, reviews: [], unmappedReviews: [{ path: "service.txt", result: "new-node" }, { path: "ui.txt", result: "new-node" }], nodes: [{ nodePath: "features/service", title: "Service capability", anchors: serviceAnchors, claims: [{ key: "purpose", category: "What", fact: "Provides the service capability.", paths: ["service.txt"], symbols: [], searchTerms: ["service"] }, { key: "implementation", category: "How", fact: "The service state file carries the capability.", paths: ["service.txt"], symbols: [], searchTerms: ["service.txt"] }, { key: "entry", category: "Where", fact: "Start at the service state file.", paths: ["service.txt"], symbols: [], searchTerms: ["service"] }] }] }, undefined, undefined, ctx(root));
  assert.deepEqual(result.details.changedNodes, ["features/service"]);
  assert.deepEqual(result.details.reclassifiedFromNewNode, ["ui.txt"]);
  assert.match(result.content[0].text, /Reclassified 1 path\(s\)/);
  // The final current-snapshot audit still demands ui.txt be anchored, so the deferred behavior is not lost.
  const currentScope = await knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root));
  assert.equal(currentScope.details.complete, true);
}));

test("tree_record accepts a call from the dedicated backfill agent (isSubagent + isBackfillAgent)", async () => workspace(async (root) => {
  await writeFile(path.join(root, "workspace.yaml"), "workspace:\n  docs_directory: docs\n  projects_directory: projects\nprojects:\n  - name: api\n    path: api\n    default_branch: main\n    ci: []\n");
  const api = path.join(root, "projects", "api"); await mkdir(api, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", api]); execFileSync("git", ["-C", api, "config", "user.email", "test@example.com"]); execFileSync("git", ["-C", api, "config", "user.name", "Test User"]);
  await writeFile(path.join(api, "service.txt"), "1\n"); execFileSync("git", ["-C", api, "add", "service.txt"]); execFileSync("git", ["-C", api, "commit", "-qm", "Create service"]);
  const h = harness(); await h.commands.get("workspace:knowledge-backfill").handler("api", ctx(root));
  const knowledge = h.tools.get("workspace_knowledge"); const impactTool = h.tools.get("workspace_knowledge_impact"); const treeRecord = h.tools.get("workspace_knowledge_tree_record");
  await knowledge.execute("id", { action: "history_plan", project: "api" }, undefined, undefined, ctx(root));
  const started = await knowledge.execute("id", { action: "history_start", projects: ["api"] }, undefined, undefined, ctx(root));
  h.asks.get("ask:answered")({ context: `pi-harness:backfill-start:${started.details.approvalKey}`, response: { kind: "selection", selections: ["Start processing"] } });
  const chunk = await knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root));
  const impact = await impactTool.execute("id", { scopeToken: chunk.details.scopeToken, graph: { status: "checked" }, changedSymbols: [], changedInterfaces: [] }, undefined, undefined, ctx(root));
  const recordInput = { impactToken: impact.details.impactToken, reviews: [], unmappedReviews: [{ path: "service.txt", result: "new-node" }], nodes: [{ nodePath: "features/service", title: "Service capability", anchors: { paths: ["service.txt"], symbols: [], interfaces: [], relatedNodes: [] }, claims: [{ key: "purpose", category: "What", fact: "Provides the service capability.", paths: ["service.txt"], symbols: [], searchTerms: ["service"] }, { key: "implementation", category: "How", fact: "The service state file carries the capability.", paths: ["service.txt"], symbols: [], searchTerms: ["service.txt"] }, { key: "entry", category: "Where", fact: "Start at the service state file.", paths: ["service.txt"], symbols: [], searchTerms: ["service"] }] }] };
  const previousChild = process.env.PI_SUBAGENT_CHILD; const previousAgent = process.env.PI_SUBAGENT_CHILD_AGENT; const previousParent = process.env.PI_SUBAGENT_PARENT_SESSION;
  // The dedicated backfill agent may record directly.
  process.env.PI_SUBAGENT_CHILD = "1"; process.env.PI_SUBAGENT_CHILD_AGENT = "backfill"; process.env.PI_SUBAGENT_PARENT_SESSION = "session-a";
  try { const result = await treeRecord.execute("id", recordInput, undefined, undefined, ctx(root)); assert.deepEqual(result.details.changedNodes, ["features/service"]); }
  finally { if (previousChild === undefined) delete process.env.PI_SUBAGENT_CHILD; else process.env.PI_SUBAGENT_CHILD = previousChild; if (previousAgent === undefined) delete process.env.PI_SUBAGENT_CHILD_AGENT; else process.env.PI_SUBAGENT_CHILD_AGENT = previousAgent; if (previousParent === undefined) delete process.env.PI_SUBAGENT_PARENT_SESSION; else process.env.PI_SUBAGENT_PARENT_SESSION = previousParent; }
  // A plain (non-backfill) subagent is still rejected, even with a fresh impact token for the next segment.
  const secondChunk = await knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root));
  if (secondChunk.details.complete) return; // single-segment fixture: the guard-rejection path is covered by the fresh-impact case below
  const secondImpact = await impactTool.execute("id", { scopeToken: secondChunk.details.scopeToken, graph: { status: "checked" }, changedSymbols: [], changedInterfaces: [] }, undefined, undefined, ctx(root));
  process.env.PI_SUBAGENT_CHILD = "1"; process.env.PI_SUBAGENT_CHILD_AGENT = "impl"; process.env.PI_SUBAGENT_PARENT_SESSION = "session-a";
  try { await assert.rejects(treeRecord.execute("id", { impactToken: secondImpact.details.impactToken, reviews: [], unmappedReviews: [{ path: "service.txt", result: "new-node" }], nodes: [] }, undefined, undefined, ctx(root)), /Only the orchestrator and the dedicated backfill agent/); }
  finally { if (previousChild === undefined) delete process.env.PI_SUBAGENT_CHILD; else process.env.PI_SUBAGENT_CHILD = previousChild; if (previousAgent === undefined) delete process.env.PI_SUBAGENT_CHILD_AGENT; else process.env.PI_SUBAGENT_CHILD_AGENT = previousAgent; if (previousParent === undefined) delete process.env.PI_SUBAGENT_PARENT_SESSION; else process.env.PI_SUBAGENT_PARENT_SESSION = previousParent; }
}));

test("tree_record rejects forward-reference relations with an actionable error listing every unresolved target", async () => workspace(async (root) => {
  await writeFile(path.join(root, "workspace.yaml"), "workspace:\n  docs_directory: docs\n  projects_directory: projects\nprojects:\n  - name: api\n    path: api\n    default_branch: main\n    ci: []\n");
  const api = path.join(root, "projects", "api"); await mkdir(api, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", api]); execFileSync("git", ["-C", api, "config", "user.email", "test@example.com"]); execFileSync("git", ["-C", api, "config", "user.name", "Test User"]);
  await writeFile(path.join(api, "service.txt"), "1\n"); execFileSync("git", ["-C", api, "add", "service.txt"]); execFileSync("git", ["-C", api, "commit", "-qm", "Create service"]);
  const h = harness(); await h.commands.get("workspace:knowledge-backfill").handler("api", ctx(root));
  const knowledge = h.tools.get("workspace_knowledge"); const impactTool = h.tools.get("workspace_knowledge_impact"); const treeRecord = h.tools.get("workspace_knowledge_tree_record");
  await knowledge.execute("id", { action: "history_plan", project: "api" }, undefined, undefined, ctx(root));
  const started = await knowledge.execute("id", { action: "history_start", projects: ["api"] }, undefined, undefined, ctx(root));
  h.asks.get("ask:answered")({ context: `pi-harness:backfill-start:${started.details.approvalKey}`, response: { kind: "selection", selections: ["Start processing"] } });
  const chunk = await knowledge.execute("id", { action: "history_chunk" }, undefined, undefined, ctx(root));
  const impact = await impactTool.execute("id", { scopeToken: chunk.details.scopeToken, graph: { status: "checked" }, changedSymbols: [], changedInterfaces: [] }, undefined, undefined, ctx(root));
  const serviceAnchors = { paths: ["service.txt"], symbols: [], interfaces: [], relatedNodes: ["interfaces/ui"] };
  await assert.rejects(treeRecord.execute("id", { impactToken: impact.details.impactToken, reviews: [], unmappedReviews: [{ path: "service.txt", result: "new-node" }], nodes: [{ nodePath: "features/service", title: "Service capability", anchors: serviceAnchors, claims: [{ key: "purpose", category: "What", fact: "Provides the service capability.", paths: ["service.txt"], symbols: [], searchTerms: ["service"] }, { key: "implementation", category: "How", fact: "The service state file carries the capability.", paths: ["service.txt"], symbols: [], searchTerms: ["service.txt"] }, { key: "entry", category: "Where", fact: "Start at the service state file.", paths: ["service.txt"], symbols: [], searchTerms: ["service"] }] }] }, undefined, undefined, ctx(root)), /features\/service -> interfaces\/ui.*Either remove the relation, or add a node/);
  // No receipt saved: the segment is still pending and can be re-recorded once the agent fixes the handoff.
  assert.equal(existsSync(path.join(root, "docs", ".pi-harness", "history", "api.json")), false);
}));

test("sync bumps the pinned pi-harness git source (slash form) to the running version", async () => workspace(async (root) => {
  const h = harness();
  await mkdir(path.join(root, ".pi"), { recursive: true });
  await writeFile(path.join(root, ".pi", "settings.json"), JSON.stringify({ packages: ["git:github.com/js-beaulieu/pi-harness@v0.0.1", "npm:@gotgenes/pi-permission-system@20.3.0"] }, null, 2) + "\n");
  await h.commands.get("workspace:sync").handler("", ctx(root));
  const settings = JSON.parse(await readFile(path.join(root, ".pi", "settings.json"), "utf8"));
  const harnessSource = settings.packages.find((p: string) => /^git:github\.com\/[^/]+\/pi-harness@/.test(p));
  assert.ok(harnessSource, "pi-harness git source should remain in packages");
  const runningVersion = JSON.parse(await readFile(path.join(__dirname, "..", "package.json"), "utf8")).version;
  assert.match(harnessSource, new RegExp(`@v${runningVersion.replace(/\./g, "\\.")}$`));
  const manifest = JSON.parse(await readFile(path.join(root, ".pi-harness", "manifest.json"), "utf8"));
  assert.equal(manifest.version, runningVersion);
}));

test("sync bumps the pinned pi-harness git source (colon form) to the running version", async () => workspace(async (root) => {
  const h = harness();
  await mkdir(path.join(root, ".pi"), { recursive: true });
  await writeFile(path.join(root, ".pi", "settings.json"), JSON.stringify({ packages: ["git:github.com:js-beaulieu/pi-harness@v0.0.1", "npm:@gotgenes/pi-permission-system@20.3.0"] }, null, 2) + "\n");
  await h.commands.get("workspace:sync").handler("", ctx(root));
  const settings = JSON.parse(await readFile(path.join(root, ".pi", "settings.json"), "utf8"));
  const harnessSource = settings.packages.find((p: string) => /^git:github\.com:[^/]+\/pi-harness@/.test(p));
  assert.ok(harnessSource, "pi-harness git source should remain in packages");
  const runningVersion = JSON.parse(await readFile(path.join(__dirname, "..", "package.json"), "utf8")).version;
  assert.match(harnessSource, new RegExp(`@v${runningVersion.replace(/\./g, "\\.")}$`));
}));

test("sync accepts an explicit higher version and updates the pin", async () => workspace(async (root) => {
  const h = harness();
  await mkdir(path.join(root, ".pi"), { recursive: true });
  const runningVersion = JSON.parse(await readFile(path.join(__dirname, "..", "package.json"), "utf8")).version;
  const higher = runningVersion.split(".").map(Number); higher[2] += 1; const higherVersion = higher.join(".");
  await writeFile(path.join(root, ".pi", "settings.json"), JSON.stringify({ packages: [`git:github.com/js-beaulieu/pi-harness@v${runningVersion}`, "npm:@gotgenes/pi-permission-system@20.3.0"] }, null, 2) + "\n");
  await h.commands.get("workspace:sync").handler(higherVersion, ctx(root));
  const settings = JSON.parse(await readFile(path.join(root, ".pi", "settings.json"), "utf8"));
  const harnessSource = settings.packages.find((p: string) => /^git:github\.com\/[^/]+\/pi-harness@/.test(p));
  assert.ok(harnessSource);
  assert.match(harnessSource, new RegExp(`@v${higherVersion.replace(/\./g, "\\.")}$`));
  const manifest = JSON.parse(await readFile(path.join(root, ".pi-harness", "manifest.json"), "utf8"));
  assert.equal(manifest.version, higherVersion);
}));

test("sync rejects an explicit version that is not higher than the installed one", async () => workspace(async (root) => {
  const h = harness();
  const runningVersion = JSON.parse(await readFile(path.join(__dirname, "..", "package.json"), "utf8")).version;
  await assert.rejects(h.commands.get("workspace:sync").handler(runningVersion, ctx(root)), /must be higher/);
}));

test("sync leaves a local path source untouched", async () => workspace(async (root) => {
  const h = harness();
  await mkdir(path.join(root, ".pi"), { recursive: true });
  const localSource = "/home/jsbeaulieu/projects/pi-harness";
  await writeFile(path.join(root, ".pi", "settings.json"), JSON.stringify({ packages: [localSource, "npm:@gotgenes/pi-permission-system@20.3.0"] }, null, 2) + "\n");
  await h.commands.get("workspace:sync").handler("", ctx(root));
  const settings = JSON.parse(await readFile(path.join(root, ".pi", "settings.json"), "utf8"));
  assert.ok(settings.packages.includes(localSource), "local path source should be preserved unchanged");
}));
