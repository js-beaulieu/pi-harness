export type Phase = "plan" | "code" | "review" | "done";
export type WorkflowState = { id: string; sessionId: string; subject: string; phase: Phase; createdAt: string; updatedAt: string; projects: string[]; branches: Record<string, string>; pullRequests: Record<string, number>; checks: { ciPassed: boolean; codeIndexed: boolean }; notes: string[] };

export function slugify(value: string): string { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "workflow"; }
export function branchName(subject: string): string { return `${/\b(fix|bug|hotfix|patch|regression)\b/i.test(subject) ? "fix" : "feat"}/${slugify(subject)}`; }
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
  if (!value || /[`$]|\$\(|<<|(?<!\d)>[^&]/.test(value)) return false;
  if (/^(?:pwd|ls|rg|grep|sed -n|cat|head|tail|stat|test|find|sort|echo|printf)\b/.test(value)) return !/\s-(?:delete|exec|execdir)\b/.test(value);
  if (/^git(?:\s+-C\s+(?:\.\/)?(?:projects\/[A-Za-z0-9._-]+|\.))?\s+(?:status|diff|log|show|branch|rev-parse|remote|fetch)\b/.test(value)) return true;
  if (/^gh\s+(?:pr\s+(?:view|list|status)|repo\s+view)\b/.test(value)) return true;
  if (/^(?:corepack\s+pnpm\s+)?node\s+(?:\.pi-harness\/)?scripts\/projects\.mjs\s+(?:list|status)\b/.test(value)) return true;
  return false;
}
export function isReadOnlyPhaseCommand(command: string): boolean { return command.split(/&&|\|\||;|\|/).every(simpleReadOnly); }
export function isPlanPhaseCommand(command: string): boolean {
  return command.split(/&&|\|\||;|\|/).every((part) => simpleReadOnly(part) || /^git(?:\s+-C\s+(?:\.\/)?(?:projects\/[A-Za-z0-9._-]+|\.))?\s+(?:checkout\s+-b|switch\s+-c|branch)\s+(?:feat|fix)\/[A-Za-z0-9._/-]+$/.test(part.trim()));
}
