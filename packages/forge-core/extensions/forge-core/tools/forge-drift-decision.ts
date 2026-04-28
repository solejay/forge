import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { ensureForgeState, writeForgeState } from "../state/store.js";

const Decisions = ["continue", "replan", "stop", "clear"] as const;

export function registerForgeDriftDecisionTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_drift_decision",
    label: "Forge Drift Decision",
    description: "Record a human/agent decision for a Forge drift escalation and update blocked state safely.",
    promptSnippet: "Resolve or record a Forge drift escalation decision",
    promptGuidelines: [
      "Use forge_drift_decision after the user chooses continue, replan, or stop on a drift escalation.",
      "Use forge_drift_decision decision=continue to unblock and proceed with accepted drift.",
      "Use forge_drift_decision decision=replan to return to planning with drift evidence preserved.",
      "Use forge_drift_decision decision=clear only when drift was a false positive and should be cleared.",
    ],
    parameters: Type.Object({
      decision: StringEnum(Decisions as unknown as string[]),
      reason: Type.Optional(Type.String({ description: "Short reason for the decision." })),
      clearSignals: Type.Optional(Type.Boolean({ description: "Clear drift signals. Defaults true only for decision=clear." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const state = await ensureForgeState(ctx.cwd);
      const decision = params.decision as typeof Decisions[number];
      const clearSignals = params.clearSignals ?? decision === "clear";

      state.current_task.drift.human_decision = params.reason ? `${decision}: ${params.reason}` : decision;

      if (decision === "continue") {
        state.current_task.status = "in_progress";
        state.current_task.progress.blocked = false;
        state.current_task.progress.blockers = state.current_task.progress.blockers.filter(
          (blocker) => !blocker.includes("Forge drift detection"),
        );
        state.current_task.drift.escalation_required = false;
      } else if (decision === "replan") {
        state.current_task.status = "planning";
        state.current_task.progress.blocked = false;
        state.current_task.progress.blockers = state.current_task.progress.blockers.filter(
          (blocker) => !blocker.includes("Forge drift detection"),
        );
        state.current_task.drift.escalation_required = false;
      } else if (decision === "stop") {
        state.current_task.status = "blocked";
        state.current_task.progress.blocked = true;
        state.current_task.progress.blockers = Array.from(new Set([
          ...state.current_task.progress.blockers,
          "Forge drift detection requires human decision before continuing.",
        ]));
        state.current_task.drift.escalation_required = true;
      } else if (decision === "clear") {
        state.current_task.status = state.current_task.status === "blocked" ? "in_progress" : state.current_task.status;
        state.current_task.progress.blocked = false;
        state.current_task.progress.blockers = state.current_task.progress.blockers.filter(
          (blocker) => !blocker.includes("Forge drift detection"),
        );
        state.current_task.drift.detected = false;
        state.current_task.drift.escalation_required = false;
        state.current_task.drift.reclassification = null;
      }

      if (clearSignals) {
        state.current_task.drift.signals = [];
        if (decision !== "stop") state.current_task.drift.detected = false;
        if (decision !== "stop") state.current_task.drift.reclassification = null;
      }

      await writeForgeState(ctx.cwd, state);

      return {
        content: [{
          type: "text",
          text: `Recorded Forge drift decision: ${decision}\nStatus: ${state.current_task.status}\nBlocked: ${state.current_task.progress.blocked ? "yes" : "no"}\nEscalation required: ${state.current_task.drift.escalation_required ? "yes" : "no"}`,
        }],
        details: { decision, state: state.current_task.drift, status: state.current_task.status },
      };
    },
  });
}
