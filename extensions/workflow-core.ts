export type Phase = "plan" | "code" | "review" | "done";
export type WorkflowState = { id: string; sessionId: string; subject: string; phase: Phase; createdAt: string; updatedAt: string; projects: string[]; branches: Record<string, string>; sessionWorktree?: { branch: string; products: Record<string, string> }; pullRequests: Record<string, number>; checks: { ciPassed: boolean; codeIndexed: boolean }; notes: string[] };

export function slugify(value: string): string { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "workflow"; }
const BRANCH_FILLER = new Set(["a", "an", "the", "and", "or", "for", "of", "to", "in", "on", "with", "from", "into", "about", "after", "before", "across", "within", "that", "this", "these", "those", "i", "we", "need", "want", "please", "can", "could", "should", "would", "like", "ability"]);
const BRANCH_INTENT = new Set(["add", "build", "bug", "change", "create", "doc", "docs", "document", "documentation", "fix", "hotfix", "implement", "improve", "introduce", "make", "patch", "readme", "refactor", "regression", "resolve", "support", "update"]);
function branchSummary(subject: string) { const words = subject.toLowerCase().match(/[a-z0-9]+/g) ?? []; const meaningful = words.filter((word, index) => !BRANCH_FILLER.has(word) && !(index === 0 && BRANCH_INTENT.has(word))); return slugify((meaningful.length ? meaningful : words).slice(0, 4).join("-")); }
function branchType(subject: string) { if (/\b(fix|bug|hotfix|patch|regression)\b/i.test(subject)) return "fix"; if (/\b(doc|docs|document|documentation|readme)\b/i.test(subject)) return "docs"; if (/\brefactor(?:ing)?\b/i.test(subject)) return "refactor"; if (/\b(ci|continuous integration|workflow)\b/i.test(subject)) return "ci"; if (/\b(build|dependency|dependencies)\b/i.test(subject)) return "build"; if (/\b(test|tests|testing)\b/i.test(subject)) return "test"; return "feat"; }
export function branchName(subject: string): string { return `${branchType(subject)}/${branchSummary(subject)}`; }
export function createWorkflow(subject: string, sessionId: string): WorkflowState {
  if (!subject.trim()) throw new Error("A workflow subject is required.");
  const now = new Date().toISOString();
  return { id: slugify(subject), sessionId, subject: subject.trim(), phase: "plan", createdAt: now, updatedAt: now, projects: ["workspace"], branches: {}, pullRequests: {}, checks: { ciPassed: false, codeIndexed: false }, notes: [] };
}
export function transition(state: WorkflowState, target: Phase): WorkflowState {
  const legal: Record<Phase, Phase[]> = { plan: ["code"], code: ["review"], review: ["code", "done"], done: [] };
  if (!legal[state.phase].includes(target)) throw new Error(`Cannot transition ${state.phase} → ${target}.`);
  return { ...state, phase: target, updatedAt: new Date().toISOString() };
}

function simpleReadOnly(command: string): boolean {
  const value = command.trim();
  if (!value || /[`$]|\$\(|<<|(?:^|[^0-9])>>?|\b(?:rm|mv|cp|mkdir|touch|tee|dd|chmod|chown|ln|truncate|install)\b|\bsed\s+-[^\s]*i\b/.test(value)) return false;
  if (/^(?:pwd|ls|rg|grep|sed|cat|head|tail|stat|test|find|sort|echo|printf|wc|file|du|tree|realpath|dirname|basename|jq|yq|cut|tr|uniq|fd|bat|less|date|uname|whoami|id|ps)\b/.test(value)) return !/\s-(?:delete|exec|execdir)\b/.test(value);
  if (/^git(?:\s+-C\s+\S+)?\s+(?:status|diff|log|show|rev-parse|symbolic-ref|merge-base|ls-(?:files|tree|remote)|show-ref|for-each-ref|cat-file|check-ignore|reflog|blame|describe|tag|submodule\s+status|worktree\s+list)\b/.test(value)) return true;
  if (/^git(?:\s+-C\s+\S+)?\s+branch(?:\s+(?:--show-current|--list|-a|-r|-v)(?:\s+\S+)*)?\s*$/.test(value)) return true;
  if (/^git(?:\s+-C\s+\S+)?\s+remote\s*$/.test(value)) return true;
  if (/^git(?:\s+-C\s+\S+)?\s+remote\s+(?:get-url|show|-v)(?:\s+\S+)*\s*$/.test(value)) return true;
  if (/^git(?:\s+-C\s+\S+)?\s+config\s+--(?:get(?:-all|-regexp)?|list|show-origin)\b/.test(value)) return true;
  if (/^gh\s+(?:pr\s+(?:view|list|status)|repo\s+view|api\s+--method\s+GET)\b/.test(value)) return true;
  if (/^(?:task\s+(?:--list|-l)|(?:corepack\s+)?(?:pnpm|npm)\s+(?:--version|list|why)|mise\s+(?:tasks|ls)|which|command\s+-v)\b/.test(value)) return true;
  if (/^node\s+(?:\.pi-harness\/)?scripts\/projects\.mjs\s+(?:list|status)\b/.test(value)) return true;
  return false;
}
export function isReadOnlyPhaseCommand(command: string): boolean {
  const loop = command.trim().match(/^for\s+[A-Za-z_][A-Za-z0-9_]*\s+in\s+[^;]+;\s*do\s+([\s\S]+?);\s*done$/);
  if (loop) return isReadOnlyPhaseCommand(loop[1]!.replace(/"?\$[A-Za-z_][A-Za-z0-9_]*"?/g, "projects/example"));
  return command.split(/&&|\|\||;|\|/).every(simpleReadOnly);
}
export function isPlanPhaseCommand(command: string): boolean {
  return command.split(/&&|\|\||;|\|/).every((part) => simpleReadOnly(part) || /^git(?:\s+-C\s+(?:\.\/)?(?:projects\/[A-Za-z0-9._-]+|\.))?\s+(?:checkout\s+-b|switch\s+-c|branch)\s+(?:build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)\/[A-Za-z0-9._/-]+$/.test(part.trim()));
}
