import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SIGNAL_LOG_PATH, type CrucibleSignalRecord, type CrucibleSummary } from "./types.js";

export function getSignalLogPath(cwd: string): string {
  return resolve(cwd, SIGNAL_LOG_PATH);
}

export async function appendSignalRecord(cwd: string, record: CrucibleSignalRecord): Promise<void> {
  const path = getSignalLogPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(record) + "\n", "utf8");
}

export async function readSignalRecords(cwd: string): Promise<{ records: CrucibleSignalRecord[]; invalidLines: number }> {
  const path = getSignalLogPath(cwd);
  if (!existsSync(path)) return { records: [], invalidLines: 0 };

  const raw = await readFile(path, "utf8");
  const records: CrucibleSignalRecord[] = [];
  let invalidLines = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as CrucibleSignalRecord;
      if (parsed && parsed.schema_version === 1 && parsed.ts) {
        records.push(parsed);
      } else {
        invalidLines += 1;
      }
    } catch {
      invalidLines += 1;
    }
  }

  return { records, invalidLines };
}

export async function writeSignalRecords(cwd: string, records: CrucibleSignalRecord[]): Promise<void> {
  const path = getSignalLogPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join("\n");
  await writeFile(path, body ? `${body}\n` : "", "utf8");
}

export function summarizeSignals(records: CrucibleSignalRecord[]): CrucibleSummary {
  const taskRecords = records.filter((record) => record.kind === "task");
  return {
    total_records: records.length,
    task_records: taskRecords.length,
    verification_passed: taskRecords.filter((record) => record.verification_passed === true).length,
    verification_failed: taskRecords.filter((record) => record.verification_passed === false).length,
    drifted: taskRecords.filter((record) => record.drift_detected || record.drift_count > 0).length,
    handoffs: records.filter((record) => record.handoff_triggered || record.kind === "handoff").length,
    worktrees: taskRecords.filter((record) => record.worktree_used).length,
    anneals: records.filter((record) => record.kind === "anneal").length,
    latest_ts: records.map((record) => record.ts).sort().at(-1) ?? null,
  };
}

export function formatSignalSummary(summary: CrucibleSummary, invalidLines = 0): string {
  const verificationObserved = summary.verification_passed + summary.verification_failed;
  const passRate = verificationObserved > 0
    ? Math.round((summary.verification_passed / verificationObserved) * 100)
    : null;

  return [
    "Forge Crucible Signals",
    "═".repeat(50),
    `Log: ${SIGNAL_LOG_PATH}`,
    `Total records: ${summary.total_records}`,
    `Task records: ${summary.task_records}`,
    `Verification pass rate: ${passRate === null ? "n/a" : `${passRate}%`} (${summary.verification_passed} passed, ${summary.verification_failed} failed, ${summary.task_records - verificationObserved} pending/unknown)`,
    `Drifted tasks: ${summary.drifted}`,
    `Handoffs: ${summary.handoffs}`,
    `Worktree-backed tasks: ${summary.worktrees}`,
    `Anneals applied: ${summary.anneals}`,
    `Latest signal: ${summary.latest_ts ?? "none"}`,
    invalidLines > 0 ? `Invalid JSONL lines ignored: ${invalidLines}` : null,
  ].filter(Boolean).join("\n");
}
