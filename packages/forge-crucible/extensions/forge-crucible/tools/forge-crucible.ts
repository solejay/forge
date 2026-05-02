import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { mineSignals } from "../crucible/mine.js";
import { readSignalRecords } from "../signal/store.js";

export function registerForgeCrucibleTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_crucible",
    label: "Forge Crucible",
    description: "Mine Forge Crucible signal logs and write human-reviewable proposals to pipeline/crucible-proposals.md.",
    promptSnippet: "Mine Forge self-improvement signals into route, skill, drift, duration, and handoff proposals",
    promptGuidelines: [
      "Use forge_crucible only after checking crucible_status or when the user asks to mine self-improvement signals.",
      "forge_crucible writes proposals only; it must not silently apply changes.",
    ],
    parameters: Type.Object({
      minSamples: Type.Optional(Type.Number({ description: "Minimum records per group before a proposal is emitted. Defaults to 3." })),
      passRateThreshold: Type.Optional(Type.Number({ description: "Verification pass-rate threshold from 0 to 1. Defaults to 0.7." })),
      driftThreshold: Type.Optional(Type.Number({ description: "Drift signal count threshold. Defaults to 2." })),
      durationThresholdMinutes: Type.Optional(Type.Number({ description: "Long-task threshold in minutes. Defaults to 45." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { records, invalidLines } = await readSignalRecords(ctx.cwd);
      const result = await mineSignals(ctx.cwd, records, {
        minSamples: params.minSamples,
        passRateThreshold: params.passRateThreshold,
        driftThreshold: params.driftThreshold,
        durationThresholdMinutes: params.durationThresholdMinutes,
      });

      return {
        content: [{
          type: "text",
          text: [
            `Wrote ${result.proposals.length} Forge Crucible proposal(s) to pipeline/crucible-proposals.md.`,
            invalidLines > 0 ? `Ignored ${invalidLines} invalid signal log line(s).` : null,
            "",
            "Review the file and mark proposals with [APPLY] before running forge_anneal.",
          ].filter(Boolean).join("\n"),
        }],
        details: { proposalCount: result.proposals.length, outputPath: result.outputPath, invalidLines },
      };
    },
  });
}
