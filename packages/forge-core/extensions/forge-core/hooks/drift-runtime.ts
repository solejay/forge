import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { classifyTask, compareClassification } from "../routing/classifier.js";
import { ensureForgeState, writeForgeState } from "../state/store.js";
import type { Classification, ForgeState } from "../state/schema.js";

interface TurnDriftTracker {
  prompt: string;
  toolCalls: number;
  mutationCalls: number;
  editedPaths: Set<string>;
  textSignals: string[];
  toolSignals: string[];
  riskyToolSignals: string[];
}

const trackers = new Map<string, TurnDriftTracker>();

const SCOPE_EXPANSION_PATTERNS: Array<[RegExp, string]> = [
  [/turns out (we|i) (also )?need/gi, "Scope expansion phrase: turns out we also need..."],
  [/this requires (a )?(larger|bigger|broader) (refactor|rewrite|change)/gi, "Scope expansion phrase: requires larger refactor/rewrite"],
  [/we need to refactor/gi, "Scope expansion phrase: need to refactor"],
  [/i need to refactor/gi, "Scope expansion phrase: need to refactor"],
  [/architectur(al|e) (change|issue|problem)/gi, "Architecture drift phrase detected"],
  [/not just (a )?(bug|fix|typo)/gi, "Task is no longer just the original small scope"],
  [/this is (actually|really) (a )?(feature|refactor|architecture)/gi, "Task type recharacterized mid-flight"],
  [/requires touching multiple (modules|features|layers)/gi, "Multiple-layer scope expansion detected"],
  [/need to change the API/gi, "API contract scope expansion detected"],
  [/need to change the data model/gi, "Data model scope expansion detected"],
];

export function registerDriftRuntime(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const meta = getContextMeta(ctx);
    if (!meta) return;
    const { cwd } = meta;
    const state = await ensureForgeState(cwd);
    const classification = classifyTask(event.prompt);

    const shouldSeedClassification =
      state.current_task.status === "idle" ||
      !state.current_task.classification.type ||
      state.current_task.classification.type === "unknown";

    if (shouldSeedClassification && classification.type && classification.type !== "unknown") {
      state.current_task.classification = classification;
      if (!state.current_task.original_classification) {
        state.current_task.original_classification = { ...classification };
      }
      if (state.current_task.status === "idle") {
        state.current_task.status = "planning";
        state.current_task.title = state.current_task.title ?? inferTitle(event.prompt);
        state.current_task.id = state.current_task.id ?? slugify(state.current_task.title ?? "forge-task");
      }
      await writeForgeState(cwd, state);
    }

    trackers.set(cwd, {
      prompt: event.prompt,
      toolCalls: 0,
      mutationCalls: 0,
      editedPaths: new Set(),
      textSignals: [],
      toolSignals: [],
      riskyToolSignals: [],
    });
  });

  pi.on("tool_call", async (event, ctx) => {
    const meta = getContextMeta(ctx);
    if (!meta) return;
    const { cwd } = meta;
    const tracker = getTracker(cwd);
    tracker.toolCalls += 1;

    if (isToolCallEventType("write", event)) {
      tracker.mutationCalls += 1;
      if (event.input.path) tracker.editedPaths.add(event.input.path);
    } else if (isToolCallEventType("edit", event)) {
      tracker.mutationCalls += 1;
      if (event.input.path) tracker.editedPaths.add(event.input.path);
    } else if (isToolCallEventType("bash", event)) {
      const command = event.input.command ?? "";
      if (isBenignValidationOrSmokeCommand(command)) {
        return;
      }
      if (isPotentiallyBroadCommand(command)) {
        const signal = `Broad shell command used: ${truncate(command, 120)}`;
        tracker.toolSignals.push(signal);
        if (isDestructiveBroadCommand(command)) tracker.riskyToolSignals.push(signal);
      }
    }
  });

  pi.on("message_end", async (event, ctx) => {
    const meta = getContextMeta(ctx);
    if (!meta) return;
    const { cwd } = meta;
    const text = extractMessageText(event.message);
    if (!text) return;

    const tracker = getTracker(cwd);
    tracker.textSignals.push(...detectTextSignals(text));
  });

  pi.on("agent_end", async (_event, ctx) => {
    const meta = getContextMeta(ctx);
    if (!meta) return;
    const { cwd, hasUI, ui } = meta;
    const tracker = trackers.get(cwd);
    if (!tracker) return;

    const state = await ensureForgeState(cwd);
    const original = state.current_task.original_classification ?? state.current_task.classification;
    const currentText = [tracker.prompt, ...tracker.textSignals].join("\n");
    const reclassification = classifyTask(currentText);

    const driftSignals = collectDriftSignals(state, original, reclassification, tracker);
    trackers.delete(cwd);

    if (driftSignals.length === 0) return;

    await recordDriftAndEscalate(pi, { cwd, hasUI, ui }, state, reclassification, driftSignals);
  });
}

function collectDriftSignals(
  state: ForgeState,
  original: Classification | null,
  reclassification: Classification,
  tracker: TurnDriftTracker,
): string[] {
  const signals = new Set<string>();

  const comparison = compareClassification(original, reclassification);
  for (const signal of comparison.signals) signals.add(signal);

  for (const signal of tracker.textSignals) signals.add(signal);
  for (const signal of tracker.toolSignals) signals.add(signal);

  const semanticSignals = new Set([...comparison.signals, ...tracker.textSignals, ...tracker.riskyToolSignals]);
  const hasSemanticDrift = semanticSignals.size > 0;

  if (shouldSuppressMechanicalDrift(state, tracker, hasSemanticDrift)) {
    return Array.from(semanticSignals).slice(0, 12);
  }

  const thresholds = getMechanicalThresholds(state, original);

  if (tracker.editedPaths.size >= thresholds.fileFanout) {
    signals.add(`Mutation fan-out: edited/wrote ${tracker.editedPaths.size} files`);
  }

  if (tracker.mutationCalls >= thresholds.mutationCalls) {
    signals.add(`High mutation count: ${tracker.mutationCalls} write/edit calls`);
  }

  if (thresholds.executionShape > 0 && tracker.mutationCalls > thresholds.executionShape) {
    signals.add(`Execution exceeded planned shape: ${tracker.mutationCalls} mutations for ${state.current_task.plan.steps.length} planned steps`);
  }

  return Array.from(signals).slice(0, 12);
}

async function recordDriftAndEscalate(
  pi: ExtensionAPI,
  ctx: any,
  state: ForgeState,
  reclassification: Classification,
  signals: string[],
) {
  state.current_task.drift = {
    ...state.current_task.drift,
    detected: true,
    signals: Array.from(new Set([...state.current_task.drift.signals, ...signals])),
    reclassification,
    escalation_required: true,
    human_decision: state.current_task.drift.human_decision,
  };
  state.current_task.status = "blocked";
  state.current_task.progress.blocked = true;
  state.current_task.progress.blockers = Array.from(new Set([
    ...state.current_task.progress.blockers,
    "Forge drift detection requires human decision before continuing.",
  ]));

  await writeForgeState(ctx.cwd, state);

  const summary = buildEscalationSummary(state, reclassification, signals);

  if (!ctx.hasUI || !ctx.ui) {
    return;
  }

  const choice = await ctx.ui.select("Forge drift detected — choose next action", [
    "continue — accept drift and proceed",
    "replan — update plan contract first",
    "stop — keep blocked until I decide",
  ]);

  const nextState = await ensureForgeState(ctx.cwd);
  if (choice?.startsWith("continue")) {
    nextState.current_task.status = "in_progress";
    nextState.current_task.progress.blocked = false;
    nextState.current_task.progress.blockers = nextState.current_task.progress.blockers.filter(
      (blocker) => !blocker.includes("Forge drift detection"),
    );
    nextState.current_task.drift.escalation_required = false;
    nextState.current_task.drift.human_decision = "continue";
    await writeForgeState(ctx.cwd, nextState);
    safeSendMessage(pi, { customType: "forge-drift-escalation", content: summary + "\n\nHuman decision: continue.", display: true });
  } else if (choice?.startsWith("replan")) {
    nextState.current_task.status = "planning";
    nextState.current_task.drift.human_decision = "replan";
    await writeForgeState(ctx.cwd, nextState);
    safeSendUserMessage(
      pi,
      "Forge drift was detected. Use the forge-plan skill to update the plan contract before continuing.\n\n" + summary,
    );
  } else {
    nextState.current_task.drift.human_decision = "stop";
    await writeForgeState(ctx.cwd, nextState);
    safeSendMessage(pi, { customType: "forge-drift-escalation", content: summary + "\n\nHuman decision: stop. Task remains blocked.", display: true });
  }
}

function getContextMeta(ctx: any): { cwd: string; hasUI: boolean; ui?: any } | null {
  try {
    const cwd = String(ctx.cwd ?? "");
    if (!cwd) return null;
    const hasUI = Boolean(ctx.hasUI);
    return { cwd, hasUI, ui: hasUI ? ctx.ui : undefined };
  } catch {
    return null;
  }
}

function safeSendMessage(pi: ExtensionAPI, message: { customType: string; content: string; display: boolean }) {
  try {
    pi.sendMessage(message, { deliverAs: "followUp" });
  } catch {
    // Session may have been replaced or shut down. State is already persisted.
  }
}

function safeSendUserMessage(pi: ExtensionAPI, content: string) {
  try {
    pi.sendUserMessage(content, { deliverAs: "followUp" });
  } catch {
    // Session may have been replaced or shut down. State is already persisted.
  }
}

function getTracker(cwd: string): TurnDriftTracker {
  let tracker = trackers.get(cwd);
  if (!tracker) {
    tracker = { prompt: "", toolCalls: 0, mutationCalls: 0, editedPaths: new Set(), textSignals: [], toolSignals: [], riskyToolSignals: [] };
    trackers.set(cwd, tracker);
  }
  return tracker;
}

function detectTextSignals(text: string): string[] {
  const signals: string[] = [];
  for (const [pattern, reason] of SCOPE_EXPANSION_PATTERNS) {
    if (pattern.test(text)) signals.push(reason);
    pattern.lastIndex = 0;
  }
  return signals;
}

function isPotentiallyBroadCommand(command: string): boolean {
  return /\b(rm\s+-rf|git\s+reset|git\s+clean|find\s+.*-delete|perl\s+-pi|sed\s+-i)\b/.test(command);
}

function isDestructiveBroadCommand(command: string): boolean {
  return /\b(rm\s+-rf|git\s+reset\s+--hard|git\s+clean\s+-[a-zA-Z]*f|find\s+.*-delete)\b/.test(command);
}

function isBenignValidationOrSmokeCommand(command: string): boolean {
  const c = command.toLowerCase();
  if (c.includes("mktemp -d /tmp/forge-") || c.includes("/tmp/forge-")) return true;
  if (c.includes("forge-review-smoke") || c.includes("forge-wt-smoke")) return true;
  if (/\b(npm|pnpm|yarn)\s+(test|run\s+(test|lint|typecheck|check|build))\b/.test(c)) return true;
  if (/\b(xcodebuild|swift\s+test|gradle|\.\/gradlew)\b/.test(c)) return true;
  if (/\bgrep\s+-q\b/.test(c)) return true;
  return false;
}

function shouldSuppressMechanicalDrift(state: ForgeState, tracker: TurnDriftTracker, hasSemanticDrift: boolean): boolean {
  if (hasSemanticDrift) return false;
  if (state.current_task.verification.status === "passed") return true;
  const complexity = state.current_task.classification.complexity ?? state.current_task.original_classification?.complexity;
  const plannedSteps = state.current_task.plan.steps.length;
  return (complexity === "medium" || complexity === "high") && plannedSteps >= 5 && tracker.editedPaths.size <= plannedSteps + 4;
}

function getMechanicalThresholds(state: ForgeState, original: Classification | null): { fileFanout: number; mutationCalls: number; executionShape: number } {
  const complexity = state.current_task.classification.complexity ?? original?.complexity ?? "unknown";
  const plannedSteps = state.current_task.plan.steps.length;
  const baseByComplexity: Record<string, { fileFanout: number; mutationCalls: number }> = {
    trivial: { fileFanout: 3, mutationCalls: 4 },
    low: { fileFanout: 5, mutationCalls: 7 },
    medium: { fileFanout: Math.max(10, plannedSteps + 4), mutationCalls: Math.max(14, plannedSteps * 3) },
    high: { fileFanout: Math.max(16, plannedSteps + 8), mutationCalls: Math.max(24, plannedSteps * 4) },
    unknown: { fileFanout: 6, mutationCalls: 8 },
  };
  const selected = baseByComplexity[complexity ?? "unknown"] ?? baseByComplexity.unknown;
  return {
    ...selected,
    executionShape: plannedSteps > 0 ? Math.max(selected.mutationCalls, plannedSteps * 5) : 0,
  };
}

function extractMessageText(message: any): string {
  if (!message) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((chunk: any) => {
      if (chunk?.type === "text" && typeof chunk.text === "string") return chunk.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function buildEscalationSummary(state: ForgeState, reclassification: Classification, signals: string[]): string {
  return [
    "## Forge Drift Detected",
    "",
    `Task: ${state.current_task.title ?? "unknown"}`,
    `Original: ${state.current_task.original_classification?.type ?? "unknown"} / ${state.current_task.original_classification?.complexity ?? "unknown"}`,
    `Current: ${reclassification.type ?? "unknown"} / ${reclassification.complexity ?? "unknown"}`,
    "",
    "Signals:",
    ...signals.map((signal) => `- ${signal}`),
    "",
    "Choose: continue, replan, or stop.",
  ].join("\n");
}

function inferTitle(prompt: string): string {
  const firstLine = prompt.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "Forge task";
  return truncate(firstLine, 80);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "forge-task";
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}
