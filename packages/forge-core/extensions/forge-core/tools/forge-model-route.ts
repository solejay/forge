import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { formatRoutes, getRouteForRole, loadModelRoutes, routeToModelArg, sampleModelRoutes } from "../models/routes.js";

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
      const routeInfo = getRouteForRole(ctx.cwd, role, params.model);
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
              `Resolved role '${routeInfo.role}': ${routeInfo.modelArg ?? "current model"}`,
            ].join("\n"),
          }],
          details: { sources, currentModel, routes, resolved: routeInfo },
        };
      }

      const modelArg = routeInfo.modelArg;
      if (!modelArg) {
        return {
          content: [{ type: "text", text: `No model configured for role '${role}'. Current model remains ${currentModel}.` }],
          details: { switched: false, reason: "no_model_configured", currentModel, resolved: routeInfo },
        };
      }

      const parsed = parseModelArg(modelArg, routeInfo.route?.provider);
      if (!parsed) {
        return {
          content: [{ type: "text", text: `Could not parse model route '${modelArg}'. Expected provider/model.` }],
          details: { switched: false, reason: "unparseable_model", currentModel, resolved: routeInfo },
        };
      }

      const model = ctx.modelRegistry.find(parsed.provider, parsed.model);
      if (!model) {
        return {
          content: [{ type: "text", text: `Model not found: ${parsed.provider}/${parsed.model}. Current model remains ${currentModel}.` }],
          details: { switched: false, reason: "model_not_found", currentModel, requested: parsed, resolved: routeInfo },
        };
      }

      const switched = await pi.setModel(model);
      if (routeInfo.route?.thinkingLevel) {
        pi.setThinkingLevel(routeInfo.route.thinkingLevel);
      }

      const nextModel = switched ? `${model.provider}/${model.id}` : currentModel;
      return {
        content: [{
          type: "text",
          text: switched
            ? `Switched Forge role '${role}' to ${nextModel}${routeInfo.route?.thinkingLevel ? ` with thinking=${routeInfo.route.thinkingLevel}` : ""}.`
            : `Could not switch to ${parsed.provider}/${parsed.model}; credentials may be unavailable. Current model remains ${currentModel}.`,
        }],
        details: { switched, previousModel: currentModel, currentModel: nextModel, requested: parsed, resolved: routeInfo },
      };
    },
  });
}

export function resolveModelForRole(cwd: string, role?: string, explicitModel?: string): string | null {
  return getRouteForRole(cwd, role, explicitModel).modelArg;
}

function parseModelArg(modelArg: string, providerHint?: string): { provider: string; model: string } | null {
  if (providerHint && !modelArg.includes("/")) return { provider: providerHint, model: modelArg };
  const slash = modelArg.indexOf("/");
  if (slash <= 0 || slash >= modelArg.length - 1) return null;
  return { provider: modelArg.slice(0, slash), model: modelArg.slice(slash + 1) };
}
