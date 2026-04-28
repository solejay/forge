import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { ensureForgeState, writeForgeState } from "../state/store.js";
import type { Classification, Complexity, TaskStatus, VerificationStatus } from "../state/schema.js";

const TaskStatusEnum = ["idle", "planning", "in_progress", "blocked", "reviewing", "done", "cancelled"] as const;
const VerificationStatusEnum = ["not_started", "running", "passed", "failed"] as const;
const ComplexityEnum = ["trivial", "low", "medium", "high", "unknown"] as const;

export function registerForgeUpdateStateTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_update_state",
    label: "Forge Update State",
    description: "Update pipeline/state.json with task classification, plan, progress, verification, drift, or project metadata.",
    promptSnippet: "Update Forge world state in pipeline/state.json",
    promptGuidelines: [
      "Use forge_update_state after creating a plan contract for a meaningful task.",
      "Use forge_update_state after completing a step or verification check so future agents can resume from pipeline/state.json.",
      "Do not store secrets, API keys, private logs, or full conversation transcripts in forge_update_state.",
    ],
    parameters: Type.Object({
      project: Type.Optional(Type.Object({
        name: Type.Optional(Type.String()),
        type: Type.Optional(Type.String()),
        platforms: Type.Optional(Type.Array(Type.String())),
      })),
      task: Type.Optional(Type.Object({
        id: Type.Optional(Type.String()),
        title: Type.Optional(Type.String()),
        status: Type.Optional(StringEnum(TaskStatusEnum as unknown as string[])),
        classification: Type.Optional(Type.Object({
          type: Type.Optional(Type.String()),
          complexity: Type.Optional(StringEnum(ComplexityEnum as unknown as string[])),
          confidence: Type.Optional(Type.Number()),
          scores: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        })),
        plan: Type.Optional(Type.Object({
          summary: Type.Optional(Type.String()),
          steps: Type.Optional(Type.Array(Type.String())),
          success_criteria: Type.Optional(Type.Array(Type.String())),
          risks: Type.Optional(Type.Array(Type.String())),
          assumptions: Type.Optional(Type.Array(Type.String())),
        })),
        progress: Type.Optional(Type.Object({
          current_step: Type.Optional(Type.String()),
          completed_steps: Type.Optional(Type.Array(Type.String())),
          blocked: Type.Optional(Type.Boolean()),
          blockers: Type.Optional(Type.Array(Type.String())),
        })),
        verification: Type.Optional(Type.Object({
          status: Type.Optional(StringEnum(VerificationStatusEnum as unknown as string[])),
          checks: Type.Optional(Type.Array(Type.Object({
            name: Type.String(),
            status: StringEnum(["not_started", "passed", "failed", "skipped"] as const as unknown as string[]),
            evidence: Type.Optional(Type.String()),
          }))),
          failures: Type.Optional(Type.Array(Type.String())),
          last_review: Type.Optional(Type.String()),
        })),
        drift: Type.Optional(Type.Object({
          detected: Type.Optional(Type.Boolean()),
          signals: Type.Optional(Type.Array(Type.String())),
          reclassification: Type.Optional(Type.Object({
            type: Type.Optional(Type.String()),
            complexity: Type.Optional(StringEnum(ComplexityEnum as unknown as string[])),
            confidence: Type.Optional(Type.Number()),
            scores: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
          })),
          escalation_required: Type.Optional(Type.Boolean()),
          human_decision: Type.Optional(Type.String()),
        })),
      })),
      completeCurrentTask: Type.Optional(Type.Boolean({ description: "Move current task into history.completed_tasks after marking it done." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const state = await ensureForgeState(ctx.cwd);

      if (params.project) {
        state.project = {
          ...state.project,
          ...definedOnly(params.project),
        };
      }

      if (params.task) {
        const task = params.task;
        if (task.id !== undefined) state.current_task.id = task.id;
        if (task.title !== undefined) state.current_task.title = task.title;
        if (task.status !== undefined) state.current_task.status = task.status as TaskStatus;

        if (task.classification) {
          const next: Classification = {
            ...state.current_task.classification,
            ...definedOnly(task.classification),
            complexity: task.classification.complexity as Complexity ?? state.current_task.classification.complexity,
          };
          state.current_task.classification = next;
          if (!state.current_task.original_classification && next.type) {
            state.current_task.original_classification = { ...next };
          }
        }

        if (task.plan) {
          state.current_task.plan = {
            ...state.current_task.plan,
            ...definedOnly(task.plan),
          };
        }

        if (task.progress) {
          state.current_task.progress = {
            ...state.current_task.progress,
            ...definedOnly(task.progress),
          };
        }

        if (task.verification) {
          state.current_task.verification = {
            ...state.current_task.verification,
            ...definedOnly(task.verification),
            status: task.verification.status as VerificationStatus ?? state.current_task.verification.status,
          };
        }

        if (task.drift) {
          state.current_task.drift = {
            ...state.current_task.drift,
            ...definedOnly(task.drift),
          };
        }
      }

      if (params.completeCurrentTask) {
        state.current_task.status = "done";
        state.history.completed_tasks.push(state.current_task);
        state.current_task = {
          ...state.current_task,
          id: null,
          title: null,
          status: "idle",
          progress: { current_step: null, completed_steps: [], blocked: false, blockers: [] },
          verification: { status: "not_started", checks: [], failures: [], last_review: null },
          drift: { detected: false, signals: [], reclassification: null, escalation_required: false, human_decision: null },
        };
      }

      await writeForgeState(ctx.cwd, state);

      return {
        content: [{ type: "text", text: `Updated pipeline/state.json\n\nCurrent task: ${state.current_task.title ?? "none"}\nStatus: ${state.current_task.status}` }],
        details: state,
      };
    },
  });
}

function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}
