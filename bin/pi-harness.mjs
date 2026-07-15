#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const source = process.env.PI_HARNESS_SOURCE ?? `git:github.com/js-beaulieu/pi-harness@v${pkg.version}`;
const [command = "", destination = "."] = process.argv.slice(2);
if (command !== "init") {
  console.error("Usage: pi-harness init [directory]");
  process.exitCode = 1;
} else {
  const root = path.resolve(destination); const templates = path.join(packageRoot, "templates", "root");
  const copyIfMissing = async (from, to) => { if (existsSync(to)) return; await mkdir(path.dirname(to), { recursive: true }); await cp(from, to, { recursive: true }); };
  const report = (message) => process.stdout.write(`pi-harness: ${message}\n`);
  report(`Preparing workspace at ${root}.`);
  for (const file of ["Taskfile.yml", "mise.toml", "package.json", "pnpm-workspace.yaml", "workspace.yaml", "AGENTS.md", "README.md", ".gitignore"]) await copyIfMissing(path.join(templates, file), path.join(root, file));
  report("Created user-owned workspace files.");
  await mkdir(path.join(root, "projects"), { recursive: true }); await copyIfMissing(path.join(templates, "projects", ".gitkeep"), path.join(root, "projects", ".gitkeep"));
  await mkdir(path.join(root, "docs"), { recursive: true }); await copyIfMissing(path.join(templates, "docs", "README.md"), path.join(root, "docs", "README.md"));
  report("Created documentation and product-repository directories.");
  const settingsFile = path.join(root, ".pi", "settings.json"); await mkdir(path.dirname(settingsFile), { recursive: true });
  const settings = existsSync(settingsFile) ? JSON.parse(await readFile(settingsFile, "utf8")) : {}; const packages = Array.isArray(settings.packages) ? settings.packages : [];
  const identity = source.replace(/@[^@]+$/, ""); const next = [...packages.filter((entry) => String(entry).replace(/@[^@]+$/, "") !== identity), source];
  await writeFile(settingsFile, JSON.stringify({ ...settings, packages: next }, null, 2) + "\n");
  report(`Pinned ${source} in local Pi settings.`);
  report("Initialization complete. Add local repositories under projects/, then open Pi in this directory and ask it to onboard the workspace.");
}
