import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { ensureForgeState, writeForgeState } from "../state/store.js";
import type { GoalStatus } from "../state/schema.js";

const GoalActions = ["set", "status", "pause", "resume", "complete", "unmet", "clear"] as const;

export function registerForgeGoalTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_goal",
    label: "Forge Goal",
    description: "Manage the active Forge goal stored in pipeline/state.json.",
    promptSnippet: "Manage the active Forge goal in pipeline/state.json",
    promptGuidelines: [
      "Use forge_goal action=set for long-running objectives that should persist across turns or handoffs.",
      "Use forge_goal action=status before continuing goal-directed work.",
      "Only use forge_goal action=complete after a completion audit with concrete evidence.",
      "Do not store secrets, private logs, full transcripts, or API keys in goal objectives, notes, or audits.",
    ],
    parameters: Type.Object({
      action: StringEnum(GoalActions as unknown as string[]),
      objective: Type.Optional(Type.String({ description: "Goal objective for action=set." })),
      tokenBudget: Type.Optional(Type.Number({ description: "Optional token budget for the goal." })),
      timeBudgetSeconds: Type.Optional(Type.Number({ description: "Optional time budget in seconds for the goal." })),
      audit: Type.Optional(Type.String({ description: "Completion audit evidence. Required for action=complete." })),
      note: Type.Optional(Type.String({ description: "Optional short progress note or reason." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const state = await ensureForgeState(ctx.cwd);
      const now = new Date().toISOString();
      const action = params.action as typeof GoalActions[number];

      if (action === "status") {
        return {
          content: [{ type: "text", text: formatGoalStatus(state.goal) }],
          details: state.goal,
        };
      }

      if (action === "set") {
        const objective = params.objective?.trim();
        if (!objective) {
          return {
            content: [{ type: "text", text: "forge_goal action=set requires a non-empty objective." }],
            details: state.goal,
          };
        }

        state.goal = {
          objective,
          status: "pursuing",
          started_at: now,
          updated_at: now,
          token_budget: normalizePositiveNumber(params.tokenBudget),
          tokens_used: null,
          time_budget_seconds: normalizePositiveNumber(params.timeBudgetSeconds),
          completed_audit: null,
          notes: params.note ? [params.note] : [],
        };
      } else if (action === "pause") {
        state.goal.status = "paused";
        state.goal.updated_at = now;
        appendNote(state.goal.notes, params.note ?? "Goal paused.");
      } else if (action === "resume") {
        if (!state.goal.objective) {
          return {
            content: [{ type: "text", text: "No Forge goal is available to resume." }],
            details: state.goal,
          };
        }
        state.goal.status = "pursuing";
        state.goal.updated_at = now;
        appendNote(state.goal.notes, params.note ?? "Goal resumed.");
      } else if (action === "complete") {
        const audit = params.audit?.trim();
        if (!audit) {
          return {
            content: [{ type: "text", text: "forge_goal action=complete requires an audit with concrete evidence." }],
            details: state.goal,
          };
        }
        state.goal.status = "complete";
        state.goal.updated_at = now;
        state.goal.completed_audit = audit;
        appendNote(state.goal.notes, params.note ?? "Goal completed after audit.");
      } else if (action === "unmet") {
        state.goal.status = "unmet";
        state.goal.updated_at = now;
        appendNote(state.goal.notes, params.note ?? "Goal marked unmet.");
      } else if (action === "clear") {
        state.goal = {
          objective: null,
          status: "idle",
          started_at: null,
          updated_at: now,
          token_budget: null,
          tokens_used: null,
          time_budget_seconds: null,
          completed_audit: null,
          notes: params.note ? [params.note] : [],
        };
      }

      await writeForgeState(ctx.cwd, state);

      return {
        content: [{ type: "text", text: formatGoalStatus(state.goal) }],
        details: state.goal,
      };
    },
  });
}

function formatGoalStatus(goal: {
  objective: string | null;
  status: GoalStatus;
  started_at: string | null;
  token_budget: number | null;
  tokens_used: number | null;
  time_budget_seconds: number | null;
  completed_audit: string | null;
  notes: string[];
}): string {
  return [
    "Forge Goal",
    "═".repeat(50),
    `Status: ${goal.status}`,
    `Objective: ${goal.objective ?? "none"}`,
    `Started: ${goal.started_at ?? "n/a"}`,
    `Tokens: ${goal.tokens_used ?? "n/a"}${goal.token_budget ? ` / ${goal.token_budget}` : ""}`,
    `Time budget: ${goal.time_budget_seconds ? `${goal.time_budget_seconds}s` : "none"}`,
    `Completion audit: ${goal.completed_audit ? "present" : "missing"}`,
    `Notes: ${goal.notes.length ? goal.notes.join("; ") : "none"}`,
  ].join("\n");
}

function normalizePositiveNumber(value: number | undefined): number | null {
  return Number.isFinite(value) && value !== undefined && value > 0 ? value : null;
}

function appendNote(notes: string[], note: string) {
  const trimmed = note.trim();
  if (trimmed) notes.push(trimmed);
}
