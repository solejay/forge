import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { formatSignalSummary, readSignalRecords, summarizeSignals } from "../signal/store.js";

export function registerCrucibleStatusTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "crucible_status",
    label: "Crucible Status",
    description: "Summarize pipeline/signal-log.jsonl and pending Forge Crucible self-improvement state.",
    promptSnippet: "Show Forge Crucible signal log summary and self-improvement status",
    promptGuidelines: [
      "Use crucible_status before mining or annealing to understand available signal volume and quality.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const { records, invalidLines } = await readSignalRecords(ctx.cwd);
      const summary = summarizeSignals(records);
      return {
        content: [{ type: "text", text: formatSignalSummary(summary, invalidLines) }],
        details: { summary, invalidLines },
      };
    },
  });
}
