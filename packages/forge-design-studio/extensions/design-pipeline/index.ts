/**
 * design-pipeline — Design studio extension for pi
 *
 * Provides:
 * - Input routing: detects design keywords → suggests design-app skill
 * - pipeline_status tool: scan pipeline/ directory, report progress
 * - /design-status command: show pipeline status
 * - /design-app command: kick off the pipeline
 * - Session startup: detect pipeline/ directory, show status widget
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { scoreDesignPrompt, buildDesignRoutingContext } from "./routing.js";
import { registerPipelineStatusTool } from "./tools/pipeline-status.js";

export default function designPipeline(pi: ExtensionAPI) {
  // ─── 1. Input routing ─────────────────────────────────────────────────

  pi.on("input", async (event, _ctx) => {
    const scores = scoreDesignPrompt(event.text);
    const context = buildDesignRoutingContext(scores);

    if (!context) {
      return { action: "continue" as const };
    }

    return {
      action: "transform" as const,
      text: event.text + "\n\n" + context,
    };
  });

  // ─── 2. Tools ─────────────────────────────────────────────────────────

  registerPipelineStatusTool(pi);

  // ─── 3. Commands ──────────────────────────────────────────────────────

  pi.registerCommand("design-status", {
    description: "Show design pipeline status — which artifacts exist, what's next",
    handler: async (_args, ctx) => {
      pi.sendUserMessage(
        "Run pipeline_status to check the design pipeline progress.",
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("design-app", {
    description: "Start the full design pipeline from PRD to rendered screens",
    handler: async (_args, ctx) => {
      pi.sendUserMessage(
        "Start the design-app pipeline. First check pipeline_status, " +
          "then follow the design-app skill steps in order.",
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("design-brief", {
    description: "Generate design brief from PRD + Dribbble inspiration",
    handler: async (_args, ctx) => {
      pi.sendUserMessage(
        "Run the design-brief-generator skill to create pipeline/design-brief.json from the PRD.",
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("style-guide", {
    description: "Create the style guide / design token system",
    handler: async (_args, ctx) => {
      pi.sendUserMessage(
        "Run the style-guide-maker skill to create pipeline/style-guide.json.",
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("screen-prompts", {
    description: "Generate nano-banana prompts for all screens",
    handler: async (_args, ctx) => {
      pi.sendUserMessage(
        "Run the screen-prompt-generator skill to create prompts for all screens in pipeline/screen-prompts/.",
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("design-qa", {
    description: "Review all rendered screens against quality standards",
    handler: async (_args, ctx) => {
      pi.sendUserMessage(
        "Run the design-qa skill to review every screen in pipeline/screens/ against the visual design standards.",
        { deliverAs: "followUp" },
      );
    },
  });

  // ─── 4. Session startup ───────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    try {
      const prdCheck = await pi.exec("test", ["-f", "pipeline/prd.md"], { timeout: 3_000 });
      const hasPrd = prdCheck.code === 0;

      if (hasPrd) {
        // Count artifacts
        const countResult = await pi.exec("bash", ["-c",
          "ls pipeline/*.json 2>/dev/null | wc -l | tr -d ' '"
        ], { timeout: 3_000 });
        const artifactCount = parseInt(countResult.stdout?.trim() || "0", 10);

        const screenResult = await pi.exec("bash", ["-c",
          "find pipeline/screens -name '*.png' -type f 2>/dev/null | wc -l | tr -d ' '"
        ], { timeout: 3_000 });
        const screenCount = parseInt(screenResult.stdout?.trim() || "0", 10);

        if (screenCount > 0) {
          ctx.ui.setStatus("design-pipeline", `🎨 ${screenCount} screens rendered`);
        } else if (artifactCount > 0) {
          ctx.ui.setStatus("design-pipeline", `🎨 Pipeline: ${artifactCount} artifacts`);
        } else {
          ctx.ui.setStatus("design-pipeline", "🎨 PRD found — run /design-app");
        }
      }
    } catch {
      // No pipeline directory — don't show status
    }
  });

  // ─── 5. Message renderer ──────────────────────────────────────────────

  pi.registerMessageRenderer("design-pipeline-routing", (message, _options, theme) => {
    const content = theme.fg("accent", "🎨 ") + theme.fg("muted", message.content as string);
    return new Text(content, 0, 0);
  });
}
