/**
 * project-discover.ts — Auto-detect iOS/Android project configuration
 *
 * Wraps scripts/discover-ios-project.sh and discover-android-project.sh
 * into a tool the LLM can call to understand the project setup.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function registerProjectDiscoverTool(pi: ExtensionAPI) {
  const extensionDir = typeof __dirname !== "undefined"
    ? __dirname
    : resolve(fileURLToPath(import.meta.url), "..");
  const scriptsDir = resolve(extensionDir, "../../../scripts");

  pi.registerTool({
    name: "discover_mobile_project",
    label: "Discover Mobile Project",
    description:
      "Auto-detect mobile project configuration: scheme, bundle ID, min OS version, " +
      "package manager, UI framework, and architecture pattern. " +
      "Use at the start of a task to understand the project setup.",
    promptSnippet: "Auto-detect iOS/Android project config (scheme, bundle ID, architecture, etc.)",
    parameters: Type.Object({
      platform: StringEnum(["ios", "android", "auto"]),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const results: string[] = [];

      const detectIos = params.platform === "ios" || params.platform === "auto";
      const detectAndroid = params.platform === "android" || params.platform === "auto";

      if (detectIos) {
        const script = resolve(scriptsDir, "discover-ios-project.sh");
        if (existsSync(script)) {
          const result = await pi.exec("bash", [script], {
            signal,
            cwd: ctx.cwd,
            timeout: 30_000,
          });
          if (result.code === 0 && result.stdout) {
            results.push("[iOS Project Detected]\n" + result.stdout);
          } else if (params.platform === "ios") {
            results.push("[iOS] No iOS project found in current directory.");
          }
        }
      }

      if (detectAndroid) {
        const script = resolve(scriptsDir, "discover-android-project.sh");
        if (existsSync(script)) {
          const result = await pi.exec("bash", [script], {
            signal,
            cwd: ctx.cwd,
            timeout: 30_000,
          });
          if (result.code === 0 && result.stdout) {
            results.push("[Android Project Detected]\n" + result.stdout);
          } else if (params.platform === "android") {
            results.push("[Android] No Android project found in current directory.");
          }
        }
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No mobile project detected in the current directory. " +
                "Look for .xcodeproj/.xcworkspace (iOS) or build.gradle (Android).",
            },
          ],
          details: { detected: false },
        };
      }

      return {
        content: [{ type: "text", text: results.join("\n\n") }],
        details: { detected: true, platforms: results.length },
      };
    },
  });
}
