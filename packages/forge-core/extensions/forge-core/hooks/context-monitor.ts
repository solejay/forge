import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ensureForgeState, writeForgeState } from "../state/store.js";

const DEFAULT_WARN_THRESHOLD = 120_000;
const DEFAULT_CRITICAL_THRESHOLD = 170_000;

export function registerContextMonitor(pi: ExtensionAPI) {
  let lastWarningAt = 0;

  pi.on("turn_end", async (_event, ctx) => {
    const cwd = ctx.cwd;
    const hasUI = ctx.hasUI;
    const ui = hasUI ? ctx.ui : null;
    const usage = ctx.getContextUsage?.();
    if (usage?.tokens) {
      await updateGoalBudget(cwd, usage.tokens);
    }

    if (!hasUI || !ui || !usage?.tokens) return;

    const warnThreshold = readThreshold("FORGE_CONTEXT_WARN_TOKENS", DEFAULT_WARN_THRESHOLD);
    const criticalThreshold = readThreshold("FORGE_CONTEXT_CRITICAL_TOKENS", DEFAULT_CRITICAL_THRESHOLD);
    const now = Date.now();

    if (usage.tokens >= criticalThreshold && now - lastWarningAt > 120_000) {
      lastWarningAt = now;
      ui.notify(
        `Forge context warning: ${usage.tokens} tokens. Run /forge-handoff to continue in a fresh session.`,
        "warning",
      );
    } else if (usage.tokens >= warnThreshold && now - lastWarningAt > 300_000) {
      lastWarningAt = now;
      ui.notify(
        `Forge context is getting long (${usage.tokens} tokens). Consider /forge-handoff soon.`,
        "info",
      );
    }
  });
}

async function updateGoalBudget(cwd: string, tokensUsed: number) {
  const state = await ensureForgeState(cwd);
  const goal = state.goal;
  if (goal.status !== "pursuing") return;

  goal.tokens_used = tokensUsed;
  goal.updated_at = new Date().toISOString();

  if (goal.token_budget && tokensUsed >= goal.token_budget) {
    goal.status = "budget_limited";
    if (!goal.notes.some((note) => note.includes("Token budget reached"))) {
      goal.notes.push(`Token budget reached at ${tokensUsed} tokens.`);
    }
  }

  await writeForgeState(cwd, state);
}

function readThreshold(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
