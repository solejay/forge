import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const DEFAULT_WARN_THRESHOLD = 120_000;
const DEFAULT_CRITICAL_THRESHOLD = 170_000;

export function registerContextMonitor(pi: ExtensionAPI) {
  let lastWarningAt = 0;

  pi.on("turn_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const usage = ctx.getContextUsage?.();
    if (!usage?.tokens) return;

    const warnThreshold = readThreshold("FORGE_CONTEXT_WARN_TOKENS", DEFAULT_WARN_THRESHOLD);
    const criticalThreshold = readThreshold("FORGE_CONTEXT_CRITICAL_TOKENS", DEFAULT_CRITICAL_THRESHOLD);
    const now = Date.now();

    if (usage.tokens >= criticalThreshold && now - lastWarningAt > 120_000) {
      lastWarningAt = now;
      ctx.ui.notify(
        `Forge context warning: ${usage.tokens} tokens. Run /forge-handoff to continue in a fresh session.`,
        "warning",
      );
    } else if (usage.tokens >= warnThreshold && now - lastWarningAt > 300_000) {
      lastWarningAt = now;
      ctx.ui.notify(
        `Forge context is getting long (${usage.tokens} tokens). Consider /forge-handoff soon.`,
        "info",
      );
    }
  });
}

function readThreshold(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
