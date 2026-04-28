import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { ensureForgeState, summarizeForgeState } from "./state/store.js";
import { registerForgeStatusTool } from "./tools/forge-status.js";
import { registerForgeUpdateStateTool } from "./tools/forge-update-state.js";
import { registerForgeRecordArtifactTool } from "./tools/forge-record-artifact.js";
import { registerForgeWorktreeDelegateTool } from "./tools/forge-worktree-delegate.js";
import { registerForgeReviewWorktreeTool } from "./tools/forge-review-worktree.js";
import { registerForgeModelRouteTool } from "./tools/forge-model-route.js";
import { registerForgeHandoffTool } from "./tools/forge-handoff.js";
import { registerForgeDriftDecisionTool } from "./tools/forge-drift-decision.js";
import { registerForgeDoctorTool } from "./tools/forge-doctor.js";
import { registerContextShield } from "./hooks/context-shield.js";
import { registerDriftRuntime } from "./hooks/drift-runtime.js";
import { registerContextMonitor } from "./hooks/context-monitor.js";
import { buildHandoffPacket } from "./handoff/packet.js";

export default function forgeCore(pi: ExtensionAPI) {
  registerForgeStatusTool(pi);
  registerForgeUpdateStateTool(pi);
  registerForgeRecordArtifactTool(pi);
  registerForgeWorktreeDelegateTool(pi);
  registerForgeReviewWorktreeTool(pi);
  registerForgeModelRouteTool(pi);
  registerForgeHandoffTool(pi);
  registerForgeDriftDecisionTool(pi);
  registerForgeDoctorTool(pi);
  registerContextShield(pi);
  registerDriftRuntime(pi);
  registerContextMonitor(pi);

  pi.on("session_start", async (_event, ctx) => {
    const state = await ensureForgeState(ctx.cwd);

    if (ctx.hasUI) {
      const task = state.current_task;
      if (task.status !== "idle") {
        ctx.ui.setStatus("forge-core", `🔥 ${task.status}: ${task.title ?? "task"}`);
      } else {
        ctx.ui.setStatus("forge-core", "🔥 Forge ready");
      }
    }
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const state = await ensureForgeState(ctx.cwd);
    const task = state.current_task;
    const hasPlan = Boolean(task.plan.summary || task.plan.steps.length > 0);

    const artifactHints: string[] = [];
    if (state.artifacts.style_guide) artifactHints.push(`style guide: ${state.artifacts.style_guide}`);
    if (state.artifacts.copy_deck) artifactHints.push(`copy deck: ${state.artifacts.copy_deck}`);
    if (state.artifacts.backend_api_spec) artifactHints.push(`backend API spec: ${state.artifacts.backend_api_spec}`);
    if (state.artifacts.screens.length > 0) artifactHints.push(`screens: ${state.artifacts.screens.length} recorded`);

    let prompt = event.systemPrompt +
      "\n\n## Forge Harness Contract\n" +
      "- Use `pipeline/state.json` as shared world state for this project.\n" +
      "- For meaningful tasks, create/update a plan contract before broad execution.\n" +
      "- Verify work against success criteria before claiming completion.\n" +
      "- If task scope/type changes, pause and ask the user rather than silently expanding scope.\n" +
      "- Never store secrets, API keys, full transcripts, or private logs in `pipeline/state.json`.\n";

    if (task.status !== "idle" || hasPlan) {
      prompt +=
        "\n### Current Forge State\n" +
        `Task: ${task.title ?? "none"}\n` +
        `Status: ${task.status}\n` +
        `Plan summary: ${task.plan.summary ?? "none"}\n` +
        `Current step: ${task.progress.current_step ?? "none"}\n` +
        `Completed steps: ${task.progress.completed_steps.join(", ") || "none"}\n` +
        `Verification: ${task.verification.status}\n`;
    }

    if (artifactHints.length > 0) {
      prompt +=
        "\n### Forge Artifacts Available\n" +
        artifactHints.map((hint) => `- ${hint}`).join("\n") +
        "\nUse these artifacts as source of truth when relevant.\n";
    }

    return {
      systemPrompt: prompt,
      message: {
        customType: "forge-core-status",
        content: `Forge state loaded from pipeline/state.json${task.status !== "idle" ? ` — ${task.status}` : ""}`,
        display: false,
      },
    };
  });

  pi.registerCommand("forge-status", {
    description: "Show Forge world state from pipeline/state.json",
    handler: async (_args, ctx) => {
      const state = await ensureForgeState(ctx.cwd);
      if (ctx.hasUI) ctx.ui.notify(summarizeForgeState(state), "info");
      else console.log(summarizeForgeState(state));
    },
  });

  pi.registerCommand("forge-plan", {
    description: "Start a Forge planning pass for the current task",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage(
        "Use the forge-plan skill. Create or update the plan contract in pipeline/state.json before executing.",
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("forge-review", {
    description: "Run a Forge review against the plan contract",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage(
        "Use the forge-review skill. Review the work against pipeline/state.json success criteria and update verification status.",
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("forge-doctor", {
    description: "Run Forge package installation and harness health diagnostics",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage("Run forge_doctor and summarize the Forge package health report.", { deliverAs: "followUp" });
    },
  });

  pi.registerCommand("forge-handoff", {
    description: "Create a fresh session seeded with Forge world state",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        console.log("/forge-handoff requires interactive mode. Use forge_handoff action=snapshot in print mode.");
        return;
      }

      const goal = args?.trim() || undefined;
      const state = await ensureForgeState(ctx.cwd);
      const packet = buildHandoffPacket(state, goal);
      const currentSessionFile = ctx.sessionManager.getSessionFile();
      const editedPrompt = await ctx.ui.editor("Edit Forge handoff prompt", packet.next_prompt);
      if (editedPrompt === undefined) {
        ctx.ui.notify("Forge handoff cancelled", "info");
        return;
      }

      state.history.handoffs.push({
        at: new Date().toISOString(),
        from: currentSessionFile ?? "current-session",
        to: "fresh-session",
        summary: `${packet.title}${goal ? ` — ${goal}` : ""}`,
      });
      await writeForgeState(ctx.cwd, state);

      const result = await ctx.newSession({
        parentSession: currentSessionFile,
        withSession: async (replacementCtx) => {
          replacementCtx.ui.setEditorText(editedPrompt);
          replacementCtx.ui.notify("Forge handoff ready. Submit when ready.", "info");
        },
      });

      if (result.cancelled) {
        ctx.ui.notify("Forge handoff session creation cancelled", "info");
      }
    },
  });

  pi.registerMessageRenderer("forge-core-status", (message, _options, theme) => {
    return new Text(theme.fg("accent", "🔥 ") + theme.fg("muted", String(message.content)), 0, 0);
  });

  pi.registerMessageRenderer("forge-drift-escalation", (message, _options, theme) => {
    return new Text(theme.fg("warning", "⚠️ Forge drift escalation\n") + theme.fg("muted", String(message.content)), 0, 0);
  });
}
