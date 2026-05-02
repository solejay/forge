#!/usr/bin/env tsx
/**
 * Script shim for users who want to mine outside pi.
 * Preferred interface inside pi: forge_crucible tool or /crucible-mine command.
 */
import { readSignalRecords } from "../extensions/forge-crucible/signal/store.js";
import { mineSignals } from "../extensions/forge-crucible/crucible/mine.js";

const cwd = process.argv[2] ?? process.cwd();
const { records, invalidLines } = await readSignalRecords(cwd);
const result = await mineSignals(cwd, records);
console.log(`Wrote ${result.proposals.length} proposal(s) to ${result.outputPath}`);
if (invalidLines > 0) console.log(`Ignored ${invalidLines} invalid line(s).`);
