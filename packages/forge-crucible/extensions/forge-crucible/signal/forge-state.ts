import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const FORGE_STATE_PATH = "pipeline/state.json";

export async function readForgeStateIfPresent(cwd: string): Promise<Record<string, unknown>> {
  const path = resolve(cwd, FORGE_STATE_PATH);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}
