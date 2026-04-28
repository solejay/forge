import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { ensureForgeState, writeForgeState } from "../state/store.js";

const ArtifactKeys = [
  "prd",
  "design_brief",
  "style_guide",
  "copy_deck",
  "backend_api_spec",
  "screens",
  "screen_prompts",
] as const;

export function registerForgeRecordArtifactTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_record_artifact",
    label: "Forge Record Artifact",
    description: "Record a design or engineering handoff artifact in pipeline/state.json.",
    promptSnippet: "Record a generated artifact path in Forge world state",
    promptGuidelines: [
      "Use forge_record_artifact whenever a pipeline artifact is generated or refreshed.",
      "Use forge_record_artifact to make design artifacts discoverable by mobile engineering agents.",
    ],
    parameters: Type.Object({
      key: StringEnum(ArtifactKeys as unknown as string[]),
      path: Type.String({ description: "Artifact path relative to project root, e.g. pipeline/style-guide.json" }),
      append: Type.Optional(Type.Boolean({ description: "Append to array artifacts like screens/screen_prompts. Defaults to true for arrays." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const state = await ensureForgeState(ctx.cwd);
      const key = params.key as keyof typeof state.artifacts;
      const current = state.artifacts[key];

      if (Array.isArray(current)) {
        const next = params.append === false ? [params.path] : Array.from(new Set([...current, params.path]));
        state.artifacts[key] = next;
      } else {
        state.artifacts[key] = params.path;
      }

      await writeForgeState(ctx.cwd, state);

      return {
        content: [{ type: "text", text: `Recorded artifact: ${params.key} → ${params.path}` }],
        details: { key: params.key, path: params.path, artifacts: state.artifacts },
      };
    },
  });
}
