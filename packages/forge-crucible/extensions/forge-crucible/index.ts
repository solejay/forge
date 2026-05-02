import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { appendSignalRecord, readSignalRecords, summarizeSignals } from "./signal/store.js";
import { buildSignalRecord } from "./signal/build.js";
import { readForgeStateIfPresent } from "./signal/forge-state.js";
import { registerForgeSignalTool } from "./tools/forge-signal.js";
import { registerForgeCrucibleTool } from "./tools/forge-crucible.js";
import { registerForgeAnnealTool } from "./tools/forge-anneal.js";
import { registerCrucibleStatusTool } from "./tools/crucible-status.js";

export default function forgeCrucible(pi: ExtensionAPI) {
  registerForgeSignalTool(pi);
  registerForgeCrucibleTool(pi);
  registerForgeAnnealTool(pi);
  registerCrucibleStatusTool(pi);

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    const { records } = await readSignalRecords(ctx.cwd);
    const summary = summarizeSignals(records);
    if (summary.total_records > 0) {
      ctx.ui.setStatus("forge-crucible", `♻ ${summary.task_records} signals`);
    } else {
      ctx.ui.setStatus("forge-crucible", "♻ Crucible ready");
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "forge_update_state" && event.toolName !== "forge_handoff" && event.toolName !== "forge_worktree_delegate") return;

    try {
      const state = await readForgeStateIfPresent(ctx.cwd);
      const currentModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : null;
      const record = buildSignalRecord({
        state,
        kind: event.toolName === "forge_handoff" ? "handoff" : "task",
        currentModel,
        toolsInvoked: [event.toolName],
        handoffTriggered: event.toolName === "forge_handoff",
        worktreeUsed: event.toolName === "forge_worktree_delegate",
        source: "event",
      });
      await appendSignalRecord(ctx.cwd, record);
    } catch {
      // Signal logging must never break the primary Forge tool result.
    }
  });

  pi.registerCommand("crucible-status", {
    description: "Show Forge Crucible signal summary",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage("Run crucible_status and summarize the Forge Crucible signal health.", { deliverAs: "followUp" });
    },
  });

  pi.registerCommand("crucible-mine", {
    description: "Mine signal log into human-reviewable proposals",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage("Run crucible_status, then forge_crucible. Summarize pipeline/crucible-proposals.md and do not apply proposals unless I mark them [APPLY].", { deliverAs: "followUp" });
    },
  });

  pi.registerCommand("crucible-anneal", {
    description: "Apply proposals marked [APPLY] in pipeline/crucible-proposals.md",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage("Run forge_anneal. Then inspect the changed files and summarize exactly what was applied and skipped.", { deliverAs: "followUp" });
    },
  });

  pi.registerMessageRenderer("forge-crucible-status", (message, _options, theme) => {
    return new Text(theme.fg("accent", "♻ ") + theme.fg("muted", String(message.content)), 0, 0);
  });
}
