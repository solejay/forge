import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { appendSignalRecord } from "../signal/store.js";
import { buildSignalRecord } from "../signal/build.js";
import { readForgeStateIfPresent } from "../signal/forge-state.js";

export function registerForgeSignalTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_signal",
    label: "Forge Signal",
    description:
      "Append a privacy-safe self-improvement signal to pipeline/signal-log.jsonl from the current Forge task state.",
    promptSnippet: "Record a Forge Crucible task outcome signal for later self-improvement mining",
    promptGuidelines: [
      "Use forge_signal after meaningful task completion, verification, handoff, or drift resolution so Forge can learn from outcomes.",
      "Do not put secrets, private logs, full transcripts, or large raw outputs in forge_signal notes.",
      "Prefer structured fields like skillsInvoked, toolsInvoked, durationMinutes, worktreeUsed, and handoffTriggered over narrative notes.",
    ],
    parameters: Type.Object({
      kind: Type.Optional(Type.String({ description: "Signal kind: task, tool, handoff, anneal, or note. Defaults to task." })),
      modelRoute: Type.Optional(Type.String({ description: "Logical route used, e.g. plan, implement, review, quick." })),
      durationMinutes: Type.Optional(Type.Number({ description: "Approximate task/session duration in minutes." })),
      skillsInvoked: Type.Optional(Type.Array(Type.String())),
      toolsInvoked: Type.Optional(Type.Array(Type.String())),
      handoffTriggered: Type.Optional(Type.Boolean()),
      worktreeUsed: Type.Optional(Type.Boolean()),
      notes: Type.Optional(Type.String({ description: "Short sanitized note only; no secrets or transcripts." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const state = await readForgeStateIfPresent(ctx.cwd);
      const currentModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : null;
      const kind = isSignalKind(params.kind) ? params.kind : "task";
      const record = buildSignalRecord({
        state,
        kind,
        modelRoute: params.modelRoute ?? null,
        currentModel,
        durationMinutes: params.durationMinutes ?? null,
        skillsInvoked: params.skillsInvoked ?? [],
        toolsInvoked: params.toolsInvoked ?? [],
        handoffTriggered: params.handoffTriggered ?? false,
        worktreeUsed: params.worktreeUsed ?? false,
        notes: params.notes,
        source: "tool",
      });
      await appendSignalRecord(ctx.cwd, record);

      return {
        content: [{
          type: "text",
          text: [
            "Appended Forge Crucible signal.",
            "",
            `Task: ${record.task_title ?? "none"}`,
            `Type: ${record.task_type ?? "unknown"}`,
            `Verification: ${record.verification_status ?? "n/a"}`,
            `Drift count: ${record.drift_count}`,
            `Log: pipeline/signal-log.jsonl`,
          ].join("\n"),
        }],
        details: record,
      };
    },
  });
}

function isSignalKind(value: unknown): value is "task" | "tool" | "handoff" | "anneal" | "note" {
  return value === "task" || value === "tool" || value === "handoff" || value === "anneal" || value === "note";
}
