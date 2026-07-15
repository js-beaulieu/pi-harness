import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const yaml = await readFile(path.join(root, "workspace.yaml"), "utf8");
const projects = [...yaml.matchAll(/^\s*path:\s*([^\s#]+)\s*$/gm)].map((match) => match[1]);
if (process.argv[2] === "status") for (const project of projects) console.log(`${project}: ${existsSync(path.join(root, "projects", project)) ? "present" : "missing"}`);
if (process.argv[2] === "bootstrap") for (const project of projects) if (!existsSync(path.join(root, "projects", project))) console.log(`${project}: clone or create this checkout manually; bootstrap does not clone projects.`);
