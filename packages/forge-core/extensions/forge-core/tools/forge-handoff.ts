import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { buildHandoffPacket, formatHandoffPacket } from "../handoff/packet.js";
import { ensureForgeState, writeForgeState } from "../state/store.js";

const Actions = ["snapshot", "record", "queue"] as const;

export function registerForgeHandoffTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_handoff",
    label: "Forge Handoff",
    description:
      "Create a concise handoff packet from pipeline/state.json for a fresh session. " +
      "Does not store secrets or full transcripts.",
    promptSnippet: "Create a Forge handoff snapshot for context-rot management",
    promptGuidelines: [
      "Use forge_handoff action=snapshot when context is getting long and you need a clean handoff packet.",
      "Use forge_handoff action=record to add a handoff event to pipeline/state.json history without storing transcripts.",
      "Use /forge-handoff for actual fresh interactive session creation; tools cannot call ctx.newSession directly.",
    ],
    parameters: Type.Object({
      action: Type.Optional(StringEnum(Actions as unknown as string[])),
      goal: Type.Optional(Type.String({ description: "Goal for the fresh session." })),
      record: Type.Optional(Type.Boolean({ description: "Record handoff event in pipeline/state.json history. Defaults to false for snapshot, true for record/queue." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const action = (params.action ?? "snapshot") as typeof Actions[number];
      const state = await ensureForgeState(ctx.cwd);
      const packet = buildHandoffPacket(state, params.goal);
      const shouldRecord = params.record ?? action !== "snapshot";

      if (shouldRecord) {
        state.history.handoffs.push({
          at: new Date().toISOString(),
          from: "current-session",
          to: action === "queue" ? "queued-fresh-session" : "handoff-snapshot",
          summary: `${packet.title}${params.goal ? ` — ${params.goal}` : ""}`,
        });
        await writeForgeState(ctx.cwd, state);
      }

      const formatted = formatHandoffPacket(packet);

      if (action === "queue") {
        pi.sendUserMessage(packet.next_prompt, { deliverAs: "followUp" });
        return {
          content: [{ type: "text", text: `Queued handoff prompt as a follow-up user message.\n\n${formatted}` }],
          details: { packet, recorded: shouldRecord, queued: true },
        };
      }

      return {
        content: [{ type: "text", text: formatted }],
        details: { packet, recorded: shouldRecord, queued: false },
      };
    },
  });
}
