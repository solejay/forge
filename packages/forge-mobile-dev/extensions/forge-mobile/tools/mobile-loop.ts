/**
 * mobile-loop.ts — Build → simulator → screenshot → verify tool
 *
 * Wraps scripts/ios-mobile-loop.sh and scripts/android-mobile-loop.sh
 * into a single tool the LLM can call. Returns the screenshot as an
 * image so the model can visually verify the UI.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function registerMobileLoopTool(pi: ExtensionAPI) {
  const extensionDir = typeof __dirname !== "undefined"
    ? __dirname
    : resolve(fileURLToPath(import.meta.url), "..");
  const scriptsDir = resolve(extensionDir, "../../../scripts");

  pi.registerTool({
    name: "mobile_loop",
    label: "Mobile Loop",
    description:
      "Build the app, install and launch on simulator/emulator, take a screenshot, " +
      "and capture logs. Returns the screenshot image for visual verification against " +
      "the visual checklist. Use after any UI change to verify the result looks correct.",
    promptSnippet: "Build, run on simulator, screenshot, and visually verify mobile UI changes",
    promptGuidelines: [
      "Run mobile_loop after implementing or fixing any mobile UI to verify visually.",
      "Check the returned screenshot against the visual checklist criteria (safe area, typography, touch targets, platform conventions).",
      "If issues are found in the screenshot, fix them and re-run mobile_loop. Max 3 retry cycles before escalating.",
      "Do not assume the UI is correct without running mobile_loop — always verify visually.",
    ],
    parameters: Type.Object({
      platform: StringEnum(["ios", "android"]),
      scheme: Type.Optional(Type.String({ description: "Xcode scheme name (iOS). Auto-detected if omitted." })),
      device: Type.Optional(
        Type.String({ description: 'Simulator/emulator device name. Defaults to "iPhone 16" (iOS).' }),
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const script =
        params.platform === "ios"
          ? resolve(scriptsDir, "ios-mobile-loop.sh")
          : resolve(scriptsDir, "android-mobile-loop.sh");

      if (!existsSync(script)) {
        throw new Error(`Script not found: ${script}`);
      }

      const args = ["bash", script];
      if (params.scheme) {
        args.push("--scheme", params.scheme);
      } else {
        args.push("--auto");
      }
      if (params.device) {
        args.push("--device", params.device);
      }

      onUpdate?.({
        content: [{ type: "text", text: `Building and launching on ${params.platform} simulator...` }],
      });

      const result = await pi.exec(args[0], args.slice(1), {
        signal,
        cwd: ctx.cwd,
        timeout: 180_000, // 3 minute timeout for builds
      });

      const output = result.stdout || "";
      const stderr = result.stderr || "";

      // Build failed
      if (result.code !== 0) {
        const errorOutput = stderr || output;
        throw new Error(
          `Mobile loop failed (exit ${result.code}):\n${errorOutput}\n\n` +
            "Extract the error, fix it, and re-run mobile_loop.",
        );
      }

      // Build succeeded — read screenshot
      const screenshotPath = "/tmp/forge_screen.png";
      const content: Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; mediaType: "image/png"; data: string } }> = [
        { type: "text", text: output },
      ];

      if (existsSync(screenshotPath)) {
        try {
          const screenshot = readFileSync(screenshotPath);
          content.push({
            type: "image",
            source: {
              type: "base64",
              mediaType: "image/png",
              data: screenshot.toString("base64"),
            },
          });
        } catch {
          content.push({
            type: "text",
            text: "[Warning: Could not read screenshot at /tmp/forge_screen.png]",
          });
        }
      }

      // Read captured logs if available
      const logsPath = "/tmp/forge_app.log";
      if (existsSync(logsPath)) {
        try {
          const logs = readFileSync(logsPath, "utf-8").trim();
          if (logs.length > 0) {
            content.push({
              type: "text",
              text: `\n[App Logs]\n${logs}`,
            });
          }
        } catch {
          // Skip log read errors
        }
      }

      return {
        content,
        details: {
          platform: params.platform,
          screenshotPath,
          exitCode: result.code,
        },
      };
    },
  });
}
