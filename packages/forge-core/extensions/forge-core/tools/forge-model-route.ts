import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { formatRouteResolution, formatRoutes, loadModelRoutes, parseModelArg, resolveModelRoute, sampleModelRoutes } from "../models/routes.js";

const Roles = ["default", "quick", "explore", "plan", "implement", "review", "commit"] as const;
const Actions = ["show", "switch", "sample"] as const;

export function registerForgeModelRouteTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_model_route",
    label: "Forge Model Route",
    description:
      "Inspect or apply role-based model routing. Reads optional pipeline/model-routes.json or .forge/model-routes.json. " +
      "Never stores secrets; only provider/model identifiers are used.",
    promptSnippet: "Inspect or switch role-based model routing for Forge roles",
    promptGuidelines: [
      "Use forge_model_route action=show to inspect role model routes before delegating role-specific sub-agents.",
      "Use forge_model_route action=switch only when the user wants the active session model changed for a role.",
      "Use forge_model_route action=sample to show a safe example pipeline/model-routes.json; do not write secrets.",
    ],
    parameters: Type.Object({
      action: Type.Optional(StringEnum(Actions as unknown as string[])),
      role: Type.Optional(StringEnum(Roles as unknown as string[])),
      model: Type.Optional(Type.String({ description: "Explicit model string override, e.g. provider/model-id." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const action = (params.action ?? "show") as typeof Actions[number];
      const role = params.role ?? "default";

      if (action === "sample") {
        const sample = JSON.stringify(sampleModelRoutes(), null, 2);
        return {
          content: [{ type: "text", text: `Sample pipeline/model-routes.json:\n\n${sample}\n\nStore provider/model identifiers only. Do not put API keys in this file.` }],
          details: { sample: sampleModelRoutes() },
        };
      }

      const { routes, sources } = loadModelRoutes(ctx.cwd);
      const routeInfo = resolveModelRoute({
        cwd: ctx.cwd,
        role,
        explicitModel: params.model,
        modelRegistry: ctx.modelRegistry,
        currentModel: ctx.model,
      });
      const currentModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "unknown";
      const configured = formatRoutes(routes);

      if (action === "show") {
        return {
          content: [{
            type: "text",
            text: [
              "Forge model routes",
              "═".repeat(40),
              `Sources: ${sources.length ? sources.join(", ") : "none — using current model defaults"}`,
              `Current model: ${currentModel}`,
              "",
              configured,
              "",
              `Resolved role '${routeInfo.role}': ${formatRouteResolution(routeInfo)}`,
            ].join("\n"),
          }],
          details: { sources, currentModel, routes, resolved: routeInfo },
        };
      }

      const model = routeInfo.selectedModel;
      if (!model) {
        return {
          content: [{ type: "text", text: `No capable model resolved for role '${role}' (${routeInfo.reason}). Current model remains ${currentModel}.` }],
          details: { switched: false, reason: routeInfo.reason, currentModel, resolved: routeInfo },
        };
      }

      const switched = routeInfo.resolution === "fallback_current" && ctx.model
        ? true
        : await pi.setModel(model);
      if (routeInfo.thinkingLevel) {
        pi.setThinkingLevel(routeInfo.thinkingLevel);
      }

      const nextModel = switched ? `${model.provider}/${model.id}` : currentModel;
      const requested = routeInfo.requestedModelArg ? parseModelArg(routeInfo.requestedModelArg, routeInfo.route?.provider) : undefined;
      return {
        content: [{
          type: "text",
          text: switched
            ? `Switched Forge role '${role}' to ${nextModel}${routeInfo.thinkingLevel ? ` with thinking=${routeInfo.thinkingLevel}` : ""} via ${routeInfo.resolution}.`
            : `Could not switch to ${routeInfo.modelArg ?? nextModel}; credentials may be unavailable. Current model remains ${currentModel}.`,
        }],
        details: { switched, previousModel: currentModel, currentModel: nextModel, requested, resolved: routeInfo },
      };
    },
  });
}
