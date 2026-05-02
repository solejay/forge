import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PROPOSALS_PATH, SIGNAL_LOG_PATH, type CrucibleSignalRecord, type MineOptions, type Proposal } from "../signal/types.js";
import { summarizeSignals } from "../signal/store.js";

export const DEFAULT_MINE_OPTIONS: MineOptions = {
  minSamples: 3,
  passRateThreshold: 0.7,
  driftThreshold: 2,
  durationThresholdMinutes: 45,
};

export interface MineResult {
  proposals: Proposal[];
  markdown: string;
  outputPath: string;
}

export async function mineSignals(cwd: string, records: CrucibleSignalRecord[], options: Partial<MineOptions> = {}): Promise<MineResult> {
  const mergedOptions = { ...DEFAULT_MINE_OPTIONS, ...options };
  const proposals = buildProposals(records, mergedOptions);
  const markdown = formatProposalsMarkdown(records, proposals, mergedOptions);
  const outputPath = resolve(cwd, PROPOSALS_PATH);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, "utf8");
  return { proposals, markdown, outputPath };
}

export function buildProposals(records: CrucibleSignalRecord[], options: MineOptions = DEFAULT_MINE_OPTIONS): Proposal[] {
  const taskRecords = records.filter((record) => record.kind === "task");
  const proposals: Proposal[] = [];

  proposals.push(...buildRouteProposals(taskRecords, options));
  proposals.push(...buildSkillGapProposals(taskRecords, options));
  proposals.push(...buildHandoffProposals(taskRecords, options));
  proposals.push(...buildDriftProposals(taskRecords, options));
  proposals.push(...buildDurationProposals(taskRecords, options));

  if (taskRecords.length === 0) {
    proposals.push({
      id: "observation-01",
      type: "observation",
      title: "Collect task signals before mining for changes",
      confidence: "high",
      finding: `No task records were found in ${SIGNAL_LOG_PATH}.`,
      rationale: "Crucible needs real Forge task outcomes before it can recommend route, skill, or prompt changes.",
      apply: "No file changes. Run forge_signal after meaningful tasks complete until at least 20 task records exist.",
      metadata: {},
    });
  }

  return proposals;
}

function buildRouteProposals(records: CrucibleSignalRecord[], options: MineOptions): Proposal[] {
  const groups = groupBy(records.filter((record) => record.verification_passed !== null), (record) => `${record.task_type ?? "unknown"}::${record.model_route ?? "unrouted"}`);
  const proposals: Proposal[] = [];
  let index = 1;

  for (const [key, group] of groups) {
    if (group.length < options.minSamples) continue;
    const passed = group.filter((record) => record.verification_passed === true).length;
    const passRate = passed / group.length;
    if (passRate >= options.passRateThreshold) continue;
    const [taskType, modelRoute] = key.split("::");
    const failed = group.length - passed;
    proposals.push({
      id: `route-${String(index++).padStart(2, "0")}`,
      type: "route",
      title: `Revisit model route for ${taskType} tasks`,
      confidence: confidenceFor(group.length, passRate <= 0.5),
      finding: `${taskType} tasks on route ${modelRoute} passed ${passed}/${group.length} verifications (${Math.round(passRate * 100)}%).`,
      rationale: `Pass rate is below the configured ${Math.round(options.passRateThreshold * 100)}% threshold. This often means the task type needs a stronger planning/implementation/review route or clearer routing guidance.`,
      apply: `Human review: choose a stronger model for role "${taskType}" or map these tasks to plan/implement/review in pipeline/model-routes.json. Anneal can scaffold a conservative route entry if metadata.suggested_role is acceptable.`,
      metadata: { task_type: taskType, model_route: modelRoute, samples: group.length, pass_rate: passRate, suggested_role: taskType },
    });
  }

  return proposals;
}

function buildSkillGapProposals(records: CrucibleSignalRecord[], options: MineOptions): Proposal[] {
  const candidates = records.filter((record) => (record.drift_count >= options.driftThreshold || record.escalation_required) && record.skills_invoked.length === 0);
  const groups = groupBy(candidates, (record) => record.task_type ?? "unknown");
  const proposals: Proposal[] = [];
  let index = 1;

  for (const [taskType, group] of groups) {
    if (group.length < options.minSamples) continue;
    const words = topWords(group.map((record) => record.task_title ?? "").join(" "));
    const skillName = words.length > 0 ? `forge-${words[0]}-${taskType}-specialist` : `forge-${taskType}-specialist`;
    proposals.push({
      id: `skill-${String(index++).padStart(2, "0")}`,
      type: "skill",
      title: `Create a specialist skill for recurring ${taskType} drift`,
      confidence: confidenceFor(group.length, group.some((record) => record.escalation_required)),
      finding: `${group.length} ${taskType} task(s) drifted or escalated without any recorded skill invocation.`,
      rationale: "Forge has skills for known workflows. Repeated drift with no skill signal suggests a missing reusable playbook or trigger phrase.",
      apply: `Scaffold packages/forge-crucible/skills/generated/${skillName}/SKILL.md as a human-editable stub.`,
      metadata: { task_type: taskType, samples: group.length, keywords: words, skill_name: skillName },
    });
  }

  return proposals;
}

function buildHandoffProposals(records: CrucibleSignalRecord[], options: MineOptions): Proposal[] {
  const longHandoffs = records.filter((record) => record.handoff_triggered && (record.duration_minutes ?? 0) >= options.durationThresholdMinutes);
  const groups = groupBy(longHandoffs, (record) => record.task_type ?? "unknown");
  const proposals: Proposal[] = [];
  let index = 1;

  for (const [taskType, group] of groups) {
    if (group.length < options.minSamples) continue;
    const avgDuration = average(group.map((record) => record.duration_minutes ?? 0));
    proposals.push({
      id: `handoff-${String(index++).padStart(2, "0")}`,
      type: "handoff",
      title: `Add proactive handoff nudge for long ${taskType} tasks`,
      confidence: confidenceFor(group.length, avgDuration >= options.durationThresholdMinutes * 1.5),
      finding: `${group.length} ${taskType} task(s) needed handoff after averaging ${Math.round(avgDuration)} minutes.`,
      rationale: "Late handoffs happen after context is already degraded. A proactive nudge can preserve task quality before verification suffers.",
      apply: `Manual patch recommended: add a ${Math.max(15, Math.round(options.durationThresholdMinutes - 5))} minute handoff checkpoint for ${taskType} tasks to Forge guidance.`,
      metadata: { task_type: taskType, samples: group.length, avg_duration_minutes: avgDuration },
    });
  }

  return proposals;
}

function buildDriftProposals(records: CrucibleSignalRecord[], options: MineOptions): Proposal[] {
  const groups = groupBy(records.filter((record) => record.drift_detected || record.drift_count > 0), (record) => record.task_type ?? "unknown");
  const proposals: Proposal[] = [];
  let index = 1;

  for (const [taskType, group] of groups) {
    if (group.length < options.minSamples) continue;
    const escalations = group.filter((record) => record.escalation_required).length;
    proposals.push({
      id: `drift-${String(index++).padStart(2, "0")}`,
      type: "drift",
      title: `Tighten planning contract for drift-prone ${taskType} tasks`,
      confidence: confidenceFor(group.length, escalations > 0),
      finding: `${group.length} ${taskType} task(s) recorded drift; ${escalations} required escalation.`,
      rationale: "Recurring drift means the initial plan or task classification is not constraining execution enough for that task type.",
      apply: `Manual patch recommended: add sharper assumptions, non-goals, and drift escalation examples for ${taskType} tasks to the relevant Forge skill or AGENTS.md.`,
      metadata: { task_type: taskType, samples: group.length, escalations },
    });
  }

  return proposals;
}

function buildDurationProposals(records: CrucibleSignalRecord[], options: MineOptions): Proposal[] {
  const timed = records.filter((record) => typeof record.duration_minutes === "number");
  const groups = groupBy(timed, (record) => record.task_type ?? "unknown");
  const proposals: Proposal[] = [];
  let index = 1;

  for (const [taskType, group] of groups) {
    if (group.length < options.minSamples) continue;
    const avgDuration = average(group.map((record) => record.duration_minutes ?? 0));
    if (avgDuration < options.durationThresholdMinutes) continue;
    proposals.push({
      id: `duration-${String(index++).padStart(2, "0")}`,
      type: "duration",
      title: `Split or delegate long-running ${taskType} tasks earlier`,
      confidence: confidenceFor(group.length, avgDuration >= options.durationThresholdMinutes * 1.5),
      finding: `${taskType} tasks with recorded durations average ${Math.round(avgDuration)} minutes across ${group.length} samples.`,
      rationale: "Tasks that routinely exceed one work block are good candidates for smaller plan contracts, sub-agent delegation, or earlier review gates.",
      apply: `Manual patch recommended: add a split/delegate checkpoint to ${taskType} planning guidance.`,
      metadata: { task_type: taskType, samples: group.length, avg_duration_minutes: avgDuration },
    });
  }

  return proposals;
}

export function formatProposalsMarkdown(records: CrucibleSignalRecord[], proposals: Proposal[], options: MineOptions): string {
  const summary = summarizeSignals(records);
  const taskRecords = records.filter((record) => record.kind === "task");
  const verificationObserved = summary.verification_passed + summary.verification_failed;
  const passRate = verificationObserved > 0 ? Math.round((summary.verification_passed / verificationObserved) * 100) : null;
  const generated = new Date().toISOString();

  const lines: string[] = [
    "# Forge Crucible Proposals",
    "",
    `Generated: ${generated}`,
    `Source log: ${SIGNAL_LOG_PATH}`,
    "",
    "## Summary",
    "",
    `- Total records: ${summary.total_records}`,
    `- Task records: ${summary.task_records}`,
    `- Verification pass rate: ${passRate === null ? "n/a" : `${passRate}%`} (${summary.task_records - verificationObserved} pending/unknown)`,
    `- Drifted tasks: ${summary.drifted}`,
    `- Handoffs: ${summary.handoffs}`,
    `- Anneals applied: ${summary.anneals}`,
    "",
    "## Mining Options",
    "",
    `- Minimum samples: ${options.minSamples}`,
    `- Pass-rate threshold: ${Math.round(options.passRateThreshold * 100)}%`,
    `- Drift threshold: ${options.driftThreshold}`,
    `- Duration threshold: ${options.durationThresholdMinutes} minutes`,
    "",
    "## How to Apply",
    "",
    "Review each proposal. Change `[ ]` to `[APPLY]` only for proposals you want `forge_anneal` to act on.",
    "Anneal is intentionally conservative: route and skill proposals can be scaffolded; prompt/handoff/drift changes remain manual unless explicitly implemented later.",
    "",
    "## Proposals",
    "",
  ];

  if (proposals.length === 0) {
    lines.push("No proposals generated. Keep collecting signals.", "");
  }

  for (const proposal of proposals) {
    lines.push(
      `### [ ] ${proposal.id}: ${proposal.title}`,
      "",
      `- Type: ${proposal.type}`,
      `- Confidence: ${proposal.confidence}`,
      `- Finding: ${proposal.finding}`,
      `- Rationale: ${proposal.rationale}`,
      `- Apply: ${proposal.apply}`,
      "",
      "```json",
      JSON.stringify(proposal.metadata, null, 2),
      "```",
      "",
    );
  }

  lines.push("## Recent Task Signals", "");
  for (const record of taskRecords.slice(-10).reverse()) {
    lines.push(`- ${record.ts} — ${record.task_type ?? "unknown"} — verification=${record.verification_status ?? "n/a"} — drift=${record.drift_count} — ${record.task_title ?? "untitled"}`);
  }
  lines.push("");

  return lines.join("\n");
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function confidenceFor(samples: number, strongSignal: boolean): Proposal["confidence"] {
  if (samples >= 8 && strongSignal) return "high";
  if (samples >= 5 || strongSignal) return "medium";
  return "low";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function topWords(text: string): string[] {
  const stop = new Set(["the", "and", "for", "with", "task", "tasks", "add", "fix", "create", "implement", "update", "forge", "this", "that", "from", "into"]);
  const counts = new Map<string, number>();
  for (const match of text.toLowerCase().matchAll(/[a-z][a-z0-9-]{2,}/g)) {
    const word = match[0].replace(/^-+|-+$/g, "");
    if (stop.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word]) => word);
}
