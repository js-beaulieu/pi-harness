#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const permissionPackage = "npm:@gotgenes/pi-permission-system@20.3.0";
const args = process.argv.slice(2);
const [command = ""] = args;
const sourceFlag = args.indexOf("--source");
let destination = ".";
for (let index = 1; index < args.length; index += 1) {
  if (args[index] === "--source") { index += 1; continue; }
  destination = args[index]; break;
}
const source = process.env.PI_HARNESS_SOURCE ?? (sourceFlag >= 0 ? args[sourceFlag + 1] : undefined) ?? `git:github.com/js-beaulieu/pi-harness@v${pkg.version}`;
const externalDirectoryPolicy = (settingsFile, packages, fallback = "ask") => {
  const policy = { "*": fallback, "/dev/null": "allow", "/tmp/*": "allow" };
  for (const packageSource of packages) {
    if (typeof packageSource !== "string" || (!packageSource.startsWith(".") && !path.isAbsolute(packageSource))) continue;
    policy[`${path.resolve(path.dirname(settingsFile), packageSource)}/*`] = "allow";
  }
  return policy;
};
const bundledGraphCommand = (graph = {}) => {
  const legacyCorepack = graph.command === "corepack" && JSON.stringify(graph.args ?? []) === JSON.stringify(["pnpm", "exec", "codebase-memory-mcp"]);
  return legacyCorepack || !graph.command
    ? { command: process.execPath, args: [path.join(packageRoot, "node_modules", "codebase-memory-mcp", "bin.js")] }
    : { command: graph.command, args: graph.args ?? [] };
};
if (command !== "init") {
  console.error("Usage: pi-harness init [directory] [--source <Pi package source>]");
  process.exitCode = 1;
} else {
  const root = path.resolve(destination); const templates = path.join(packageRoot, "templates", "root");
  const copyIfMissing = async (from, to) => { if (existsSync(to)) return; await mkdir(path.dirname(to), { recursive: true }); await cp(from, to, { recursive: true }); };
  const report = (message) => process.stdout.write(`pi-harness: ${message}\n`);
  report(`Preparing workspace at ${root}.`);
  for (const file of ["Taskfile.yml", "mise.toml", "package.json", "pnpm-workspace.yaml", "workspace.yaml", "AGENTS.md", "README.md"]) await copyIfMissing(path.join(templates, file), path.join(root, file));
  await copyIfMissing(path.join(templates, "gitignore"), path.join(root, ".gitignore"));
  report("Created user-owned workspace files.");
  if (!existsSync(path.join(root, ".git"))) {
    execFileSync("git", ["init", "-b", "main", root], { stdio: "ignore" });
    report("Initialized the workspace Git repository on main.");
  }
  await mkdir(path.join(root, "projects"), { recursive: true }); await copyIfMissing(path.join(templates, "projects", ".gitkeep"), path.join(root, "projects", ".gitkeep"));
  await mkdir(path.join(root, "docs"), { recursive: true }); await copyIfMissing(path.join(templates, "docs", "README.md"), path.join(root, "docs", "README.md"));
  report("Created documentation and product-repository directories.");
  const settingsFile = path.join(root, ".pi", "settings.json"); await mkdir(path.dirname(settingsFile), { recursive: true });
  const settings = existsSync(settingsFile) ? JSON.parse(await readFile(settingsFile, "utf8")) : {}; const packages = Array.isArray(settings.packages) ? settings.packages : [];
  const identity = (value) => String(value).replace(/@[^@]+$/, ""); const required = [source, permissionPackage];
  const next = [...packages.filter((entry) => !required.some((item) => identity(item) === identity(entry))), ...required];
  await writeFile(settingsFile, JSON.stringify({ ...settings, packages: next }, null, 2) + "\n");
  report(`Pinned ${source} in local Pi settings.`);
  const workspace = YAML.parse(await readFile(path.join(root, "workspace.yaml"), "utf8")) ?? {};
  const managed = path.join(root, ".pi-harness");
  await cp(path.join(packageRoot, "templates", "managed"), managed, { recursive: true, force: true });
  await writeFile(path.join(managed, "manifest.json"), JSON.stringify({ package: pkg.name, version: pkg.version, generatedAt: new Date().toISOString() }, null, 2) + "\n");
  const mcpFile = path.join(root, ".mcp.json"); const mcp = existsSync(mcpFile) ? JSON.parse(await readFile(mcpFile, "utf8")) : {}; const graph = workspace.code_graph ?? {}; const graphProcess = bundledGraphCommand(graph);
  await writeFile(mcpFile, JSON.stringify({ ...mcp, mcpServers: { ...(mcp.mcpServers ?? {}), [graph.server_name ?? "codebase-memory"]: { ...graphProcess, lifecycle: graph.lifecycle ?? "lazy", idleTimeout: graph.idle_timeout ?? 10 } } }, null, 2) + "\n");
  const permission = JSON.parse(await readFile(path.join(packageRoot, "templates", "permission-config.json"), "utf8")); const configuredPermissions = workspace.permissions ?? {};
  permission.permission["*"] = configuredPermissions.default ?? "allow"; permission.permission.bash["*"] = configuredPermissions.shell ?? "allow"; permission.permission.mcp["*"] = configuredPermissions.mcp ?? "allow"; permission.permission.external_directory = externalDirectoryPolicy(settingsFile, next, configuredPermissions.external_directories ?? "ask");
  const permissionFile = path.join(root, ".pi", "extensions", "pi-permission-system", "config.json"); await mkdir(path.dirname(permissionFile), { recursive: true }); await writeFile(permissionFile, JSON.stringify(permission, null, 2) + "\n");
  const subagentConfigFile = path.join(root, ".pi", "extensions", "subagent", "config.json"); await mkdir(path.dirname(subagentConfigFile), { recursive: true }); const subagentSettings = workspace.subagents ?? {};
  await writeFile(subagentConfigFile, JSON.stringify({ asyncByDefault: subagentSettings.async_by_default ?? true, toolDescriptionMode: subagentSettings.tool_description_mode ?? "compact", completionBatch: { enabled: subagentSettings.completion_batch ?? true }, control: { notifyOn: ["needs_attention"], notifyChannels: ["async"] }, intercomBridge: { mode: subagentSettings.intercom_bridge_mode ?? "always" } }, null, 2) + "\n");
  const agents = workspace.agents ?? {}; const agentOverrides = settings.subagents?.agentOverrides ?? {};
  for (const [name, config] of Object.entries(agents)) if (name !== "orchestrator" && config?.model) agentOverrides[name] = { ...(agentOverrides[name] ?? {}), model: config.model };
  await writeFile(settingsFile, JSON.stringify({ ...settings, packages: next, ...(agents.orchestrator?.model ? { defaultModel: agents.orchestrator.model } : {}), subagents: { ...(settings.subagents ?? {}), agentOverrides } }, null, 2) + "\n");
  report("Generated managed Pi, MCP, permission, and task configuration.");
  report("Initialization complete. Add local repositories under projects/, then open Pi in this directory and ask it to onboard the workspace.");
}
