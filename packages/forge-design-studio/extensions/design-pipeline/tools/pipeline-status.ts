/**
 * pipeline-status.ts — Check which pipeline artifacts exist
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function registerPipelineStatusTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "pipeline_status",
    label: "Pipeline Status",
    description:
      "Check the design pipeline status: which artifacts exist, what's missing, " +
      "and what step to run next. Scans the pipeline/ directory.",
    promptSnippet: "Check design pipeline progress and missing artifacts",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
      const checks = [
        { file: "pipeline/prd.md", label: "PRD", step: "Input" },
        { file: "pipeline/feature-registry.md", label: "Feature Registry", step: "Input (optional)" },
        { file: "pipeline/design-brief.json", label: "Design Brief", step: "Step 2" },
        { file: "pipeline/style-guide.json", label: "Style Guide", step: "Step 3" },
        { file: "pipeline/copy-deck.json", label: "Copy Deck", step: "Step 4" },
        { file: "pipeline/backend-api-spec.json", label: "Backend API Spec", step: "Step 7" },
      ];

      const results: string[] = [];
      let passed = 0;
      let total = checks.length;

      for (const check of checks) {
        const exists = await pi.exec("test", ["-f", check.file], {
          signal,
          cwd: ctx.cwd,
          timeout: 5_000,
        });
        const ok = exists.code === 0;
        if (ok) passed++;
        results.push(`${ok ? "✅" : "❌"} ${check.label} (${check.step}) — ${check.file}`);
      }

      // Check screen prompts
      const promptCount = await pi.exec("bash", ["-c",
        "find pipeline/screen-prompts -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' '"
      ], { signal, cwd: ctx.cwd, timeout: 5_000 });
      const prompts = parseInt(promptCount.stdout?.trim() || "0", 10);
      results.push(`${prompts > 0 ? "✅" : "❌"} Screen Prompts (Step 5) — ${prompts} prompts`);

      // Check rendered screens
      const screenCount = await pi.exec("bash", ["-c",
        "find pipeline/screens -name '*.png' -type f 2>/dev/null | wc -l | tr -d ' '"
      ], { signal, cwd: ctx.cwd, timeout: 5_000 });
      const screens = parseInt(screenCount.stdout?.trim() || "0", 10);
      results.push(`${screens > 0 ? "✅" : "❌"} Rendered Screens (Step 6) — ${screens} screens`);

      // Determine next step
      let nextStep = "Start with: create pipeline/prd.md";
      const hasFile = async (f: string) => {
        const r = await pi.exec("test", ["-f", f], { signal, cwd: ctx.cwd, timeout: 5_000 });
        return r.code === 0;
      };

      if (!await hasFile("pipeline/prd.md")) {
        nextStep = "Create pipeline/prd.md with your product requirements";
      } else if (!await hasFile("pipeline/design-brief.json")) {
        nextStep = "Run design-brief-generator skill (Step 2)";
      } else if (!await hasFile("pipeline/style-guide.json")) {
        nextStep = "Run style-guide-maker skill (Step 3)";
      } else if (!await hasFile("pipeline/copy-deck.json")) {
        nextStep = "Run microcopy skill (Step 4)";
      } else if (prompts === 0) {
        nextStep = "Run screen-prompt-generator skill (Step 5)";
      } else if (screens === 0) {
        nextStep = "Render screens via nano-banana skill (Step 6)";
      } else if (!await hasFile("pipeline/backend-api-spec.json")) {
        nextStep = "Generate backend API spec (Step 7)";
      } else {
        nextStep = "Run design-qa skill to validate, then present Gate checkpoint";
      }

      const forgeStatePath = resolve(ctx.cwd, "pipeline/state.json");
      const forgeStateSummary = existsSync(forgeStatePath)
        ? summarizeForgeState(readFileSync(forgeStatePath, "utf8"))
        : "Forge state: missing — forge-core will create pipeline/state.json on startup or when forge_status runs";

      const output =
        `Design Pipeline Status\n` +
        `${"═".repeat(50)}\n\n` +
        results.join("\n") +
        `\n\n${"─".repeat(50)}\n` +
        `Artifacts: ${passed}/${total} JSON files\n` +
        `Prompts: ${prompts} | Screens: ${screens}\n\n` +
        `${forgeStateSummary}\n\n` +
        `Next: ${nextStep}`;

      return {
        content: [{ type: "text", text: output }],
        details: { passed, total, prompts, screens, nextStep },
      };
    },
  });
}

function summarizeForgeState(raw: string): string {
  try {
    const state = JSON.parse(raw) as {
      current_task?: { title?: string | null; status?: string; verification?: { status?: string } };
    };
    const task = state.current_task;
    return [
      "Forge state: present — pipeline/state.json",
      `Current task: ${task?.title ?? "none"}`,
      `Task status: ${task?.status ?? "unknown"}`,
      `Verification: ${task?.verification?.status ?? "unknown"}`,
    ].join("\n");
  } catch {
    return "Forge state: present but unreadable — pipeline/state.json needs repair";
  }
}
