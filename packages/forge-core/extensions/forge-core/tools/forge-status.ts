import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { ensureForgeState, summarizeForgeState } from "../state/store.js";

export function registerForgeStatusTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_status",
    label: "Forge Status",
    description: "Read pipeline/state.json and summarize current Forge world state, task plan, verification status, drift, and artifacts.",
    promptSnippet: "Show current Forge world state from pipeline/state.json",
    promptGuidelines: [
      "Use forge_status before continuing a multi-step Forge task to understand current world state.",
      "Use forge_status before handing work from design to mobile engineering.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const state = await ensureForgeState(ctx.cwd);
      return {
        content: [{ type: "text", text: summarizeForgeState(state) }],
        details: state,
      };
    },
  });
}
