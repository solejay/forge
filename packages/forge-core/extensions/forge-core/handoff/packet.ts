import type { ForgeState } from "../state/schema.js";
import { FORGE_STATE_PATH } from "../state/store.js";

export interface HandoffPacket {
  title: string;
  created_at: string;
  state_path: string;
  project: ForgeState["project"];
  task: {
    id: string | null;
    title: string | null;
    status: string;
    classification: ForgeState["current_task"]["classification"];
    original_classification: ForgeState["current_task"]["original_classification"];
    plan: ForgeState["current_task"]["plan"];
    progress: ForgeState["current_task"]["progress"];
    verification: ForgeState["current_task"]["verification"];
    drift: ForgeState["current_task"]["drift"];
  };
  artifacts: ForgeState["artifacts"];
  next_prompt: string;
}

export function buildHandoffPacket(state: ForgeState, goal?: string): HandoffPacket {
  const task = state.current_task;
  const nextPrompt = buildNextPrompt(state, goal);

  return {
    title: `Forge handoff — ${task.title ?? "current task"}`,
    created_at: new Date().toISOString(),
    state_path: FORGE_STATE_PATH,
    project: state.project,
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
      classification: task.classification,
      original_classification: task.original_classification,
      plan: task.plan,
      progress: task.progress,
      verification: task.verification,
      drift: task.drift,
    },
    artifacts: state.artifacts,
    next_prompt: nextPrompt,
  };
}

export function formatHandoffPacket(packet: HandoffPacket): string {
  const task = packet.task;
  const artifactLines = Object.entries(packet.artifacts).map(([key, value]) => {
    if (Array.isArray(value)) return `- ${key}: ${value.length} item(s)`;
    return `- ${key}: ${value ?? "missing"}`;
  });

  return [
    `# ${packet.title}`,
    "",
    `Created: ${packet.created_at}`,
    `State: ${packet.state_path}`,
    "",
    "## Current Task",
    `- ID: ${task.id ?? "none"}`,
    `- Title: ${task.title ?? "none"}`,
    `- Status: ${task.status}`,
    `- Classification: ${task.classification.type ?? "unknown"} / ${task.classification.complexity ?? "unknown"}`,
    "",
    "## Plan",
    task.plan.summary ?? "No plan summary.",
    "",
    ...task.plan.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Progress",
    `- Current step: ${task.progress.current_step ?? "none"}`,
    `- Completed: ${task.progress.completed_steps.length ? task.progress.completed_steps.join("; ") : "none"}`,
    `- Blocked: ${task.progress.blocked ? "yes" : "no"}`,
    task.progress.blockers.length ? `- Blockers: ${task.progress.blockers.join("; ")}` : "- Blockers: none",
    "",
    "## Verification",
    `- Status: ${task.verification.status}`,
    ...task.verification.checks.map((check) => `- ${check.status.toUpperCase()}: ${check.name}${check.evidence ? ` — ${check.evidence}` : ""}`),
    task.verification.failures.length ? `- Failures: ${task.verification.failures.join("; ")}` : "- Failures: none",
    "",
    "## Drift",
    `- Detected: ${task.drift.detected ? "yes" : "no"}`,
    `- Escalation required: ${task.drift.escalation_required ? "yes" : "no"}`,
    task.drift.signals.length ? `- Signals: ${task.drift.signals.join("; ")}` : "- Signals: none",
    "",
    "## Artifacts",
    ...artifactLines,
    "",
    "## Fresh Session Prompt",
    packet.next_prompt,
  ].join("\n");
}

function buildNextPrompt(state: ForgeState, goal?: string): string {
  const task = state.current_task;
  const completed = task.progress.completed_steps.length
    ? task.progress.completed_steps.map((step) => `- ${step}`).join("\n")
    : "- none";
  const success = task.plan.success_criteria.length
    ? task.plan.success_criteria.map((criterion) => `- ${criterion}`).join("\n")
    : "- none recorded";

  return [
    "Continue from this Forge handoff using `pipeline/state.json` as shared world state.",
    "Do not assume access to the previous conversation; use the summary below and inspect files as needed.",
    "",
    `Task: ${task.title ?? "none"}`,
    `Status: ${task.status}`,
    `Plan summary: ${task.plan.summary ?? "none"}`,
    "",
    "Completed steps:",
    completed,
    "",
    `Current step: ${task.progress.current_step ?? "none"}`,
    "",
    "Success criteria:",
    success,
    "",
    `Verification: ${task.verification.status}`,
    `Drift: ${task.drift.detected ? "detected" : "none"}${task.drift.escalation_required ? " — escalation required" : ""}`,
    "",
    goal ? `New session goal: ${goal}` : "New session goal: continue the current Forge task safely.",
    "",
    "First action: run `forge_status`, then proceed from the current step. If scope has changed, replan before editing.",
  ].join("\n");
}
