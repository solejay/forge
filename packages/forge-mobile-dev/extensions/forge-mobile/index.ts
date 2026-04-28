/**
 * forge-mobile — Mobile engineering harness for pi
 *
 * A comprehensive mobile development extension that provides:
 *
 * - Intelligent routing: Detects iOS/Android keywords in prompts and injects
 *   platform-specific context + agent personas into the system prompt
 * - File protection: Blocks direct .pbxproj edits with safe alternatives
 * - Post-edit linting: Runs SwiftLint/ktlint after Swift/Kotlin file changes
 * - Agent personas: ios-engineer, ios-debugger, android-engineer, android-debugger
 *   injected via system prompt or spawned as sub-agents
 * - Build→screenshot→verify loop: mobile_loop tool for visual verification
 * - Project discovery: Auto-detect scheme, bundle ID, architecture, etc.
 *
 * Companion skills (loaded separately by pi):
 *   mobile-loop, mobile-split, crash-triage, swiftui-review, mobile-deploy,
 *   mobile-doctor, testflight-ops, feature-scaffold, performance-audit,
 *   code-signing-doctor, accessibility-audit
 *
 * @see https://github.com/yourorg/forge-mobile-dev
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { scorePrompt, buildRoutingContext } from "./routing.js";
import { registerGuards } from "./guards.js";
import { registerAgents } from "./agents.js";
import { registerMobileLoopTool } from "./tools/mobile-loop.js";
import { registerProjectDiscoverTool } from "./tools/project-discover.js";

export default function forgeMobile(pi: ExtensionAPI) {
  // ─── 1. Input routing (replaces mobile-keyword-detector.mjs) ─────────
  // Analyze every user prompt for mobile keywords and inject routing
  // context so the agent knows which skills/personas to use.

  pi.on("input", async (event, _ctx) => {
    const scores = scorePrompt(event.text);
    const routingContext = buildRoutingContext(scores);

    if (!routingContext) {
      return { action: "continue" as const };
    }

    // Append routing context to the user's prompt
    return {
      action: "transform" as const,
      text: event.text + "\n\n" + routingContext,
    };
  });

  // ─── 2. File guards + lint (replaces pbxproj-guard.mjs + lint-guard.mjs)
  registerGuards(pi);

  // ─── 3. Agent personas + delegation tool ──────────────────────────────
  registerAgents(pi);

  // ─── 4. Custom tools ──────────────────────────────────────────────────
  registerMobileLoopTool(pi);
  registerProjectDiscoverTool(pi);

  // ─── 5. Commands ──────────────────────────────────────────────────────

  pi.registerCommand("mobile-doctor", {
    description: "Diagnose mobile toolchain and extension issues",
    handler: async (_args, ctx) => {
      pi.sendUserMessage(
        "Run the mobile-doctor skill to diagnose my mobile development setup. " +
          "Check that Xcode, simulators, SwiftLint, and other tools are available.",
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("mobile-loop", {
    description: "Build, screenshot, and visually verify on simulator",
    handler: async (args, ctx) => {
      const platform = args?.trim() || "ios";
      pi.sendUserMessage(
        `Run mobile_loop for platform "${platform}" to build, install on simulator, ` +
          "take a screenshot, and verify the UI looks correct.",
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("discover-project", {
    description: "Auto-detect mobile project configuration",
    handler: async (args, ctx) => {
      const platform = args?.trim() || "auto";
      pi.sendUserMessage(
        `Run discover_mobile_project with platform="${platform}" to detect the project setup.`,
        { deliverAs: "followUp" },
      );
    },
  });

  // ─── 6. Session startup ───────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const handoff = detectDesignHandoff(ctx.cwd);
    if (handoff.length > 0) {
      ctx.ui.setWidget("forge-design-handoff", [
        "🎨 Forge design handoff detected",
        ...handoff.map((line) => `  ${line}`),
      ]);
    }

    // Try to detect platform from cwd and show status
    try {
      const iosCheck = await pi.exec("find", [".", "-maxdepth", "2", "-name", "*.xcodeproj"], { timeout: 5_000 });
      const androidCheck = await pi.exec("find", [".", "-maxdepth", "2", "-name", "build.gradle*"], { timeout: 5_000 });

      const hasIos = (iosCheck.stdout || "").trim().length > 0;
      const hasAndroid = (androidCheck.stdout || "").trim().length > 0;

      if (hasIos && hasAndroid) {
        ctx.ui.setStatus("forge-mobile", "📱 iOS + Android");
      } else if (hasIos) {
        ctx.ui.setStatus("forge-mobile", "📱 iOS");
      } else if (hasAndroid) {
        ctx.ui.setStatus("forge-mobile", "📱 Android");
      }
    } catch {
      // Detection failed — don't show status
    }
  });

  // ─── 7. Design artifact handoff context ───────────────────────────────

  pi.on("before_agent_start", async (event, ctx) => {
    const handoff = detectDesignHandoff(ctx.cwd);
    if (handoff.length === 0) return;

    return {
      systemPrompt:
        event.systemPrompt +
        "\n\n## Forge Design Handoff\n" +
        "Design artifacts were detected in `pipeline/`. Treat them as source of truth for implementation.\n" +
        handoff.map((line) => `- ${line}`).join("\n") +
        "\nUse `pipeline/style-guide.json` for tokens, `pipeline/copy-deck.json` for strings, and `pipeline/screens/` as visual reference.\n",
    };
  });

  // ─── 8. Custom message renderer for routing notifications ─────────────

  pi.registerMessageRenderer("forge-mobile-routing", (message, _options, theme) => {
    const content = theme.fg("accent", "📱 ") + theme.fg("muted", message.content as string);
    return new Text(content, 0, 0);
  });
}

function detectDesignHandoff(cwd: string): string[] {
  const pipelineDir = resolve(cwd, "pipeline");
  const lines: string[] = [];

  const styleGuide = resolve(pipelineDir, "style-guide.json");
  const copyDeck = resolve(pipelineDir, "copy-deck.json");
  const apiSpec = resolve(pipelineDir, "backend-api-spec.json");
  const screensDir = resolve(pipelineDir, "screens");

  if (existsSync(styleGuide)) lines.push("style guide: pipeline/style-guide.json");
  if (existsSync(copyDeck)) lines.push("copy deck: pipeline/copy-deck.json");
  if (existsSync(apiSpec)) lines.push("backend API spec: pipeline/backend-api-spec.json");
  if (existsSync(screensDir)) {
    const screenCount = readdirSync(screensDir).filter((name) => name.endsWith(".png")).length;
    if (screenCount > 0) lines.push(`screens: ${screenCount} PNG(s) in pipeline/screens/`);
  }

  return lines;
}
