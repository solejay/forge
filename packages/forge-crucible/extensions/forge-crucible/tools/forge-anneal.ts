import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { annealApprovedProposals } from "../crucible/anneal.js";
import { appendSignalRecord } from "../signal/store.js";
import { buildSignalRecord } from "../signal/build.js";
import { readForgeStateIfPresent } from "../signal/forge-state.js";

export function registerForgeAnnealTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_anneal",
    label: "Forge Anneal",
    description: "Apply Forge Crucible proposals that were explicitly marked [APPLY] in pipeline/crucible-proposals.md.",
    promptSnippet: "Apply explicitly approved Forge Crucible proposals and record an anneal signal",
    promptGuidelines: [
      "Use forge_anneal only after the user has reviewed pipeline/crucible-proposals.md and marked proposals with [APPLY].",
      "forge_anneal must not apply unchecked proposals; unchecked proposals are skipped.",
      "Review files changed by forge_anneal before claiming harness self-improvement is complete.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const result = await annealApprovedProposals(ctx.cwd);

      const state = await readForgeStateIfPresent(ctx.cwd);
      const record = buildSignalRecord({
        state,
        kind: "anneal",
        currentModel: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : null,
        toolsInvoked: ["forge_anneal"],
        notes: `applied=${result.applied.length}; skipped=${result.skipped.length}`,
        source: "anneal",
      });
      await appendSignalRecord(ctx.cwd, record);

      const appliedLines = result.applied.length
        ? result.applied.map((item) => `- ${item.id} (${item.type}): ${item.action}${item.path ? ` — ${item.path}` : ""}`)
        : ["- none"];
      const skippedLines = result.skipped.slice(0, 12).map((item) => `- ${item.id}: ${item.reason}`);

      return {
        content: [{
          type: "text",
          text: [
            "Forge anneal complete.",
            "",
            "Applied:",
            ...appliedLines,
            "",
            "Skipped:",
            ...(skippedLines.length ? skippedLines : ["- none"]),
            result.skipped.length > skippedLines.length ? `- … ${result.skipped.length - skippedLines.length} more skipped` : null,
            "",
            "Recorded anneal signal in pipeline/signal-log.jsonl.",
          ].filter(Boolean).join("\n"),
        }],
        details: result,
      };
    },
  });
}
