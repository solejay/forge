---
name: crucible-status
description: Check Forge Crucible signal-log health and self-improvement readiness. Use when the user asks for crucible status, signal summary, harness learning status, or whether enough data exists to mine proposals.
version: 0.1.0
---

# Crucible Status

Run `crucible_status` and explain what the signal log says.

## Interpretive Guide

- Fewer than 5 task records: too little data for trustworthy proposals.
- 5–20 task records: useful directional signals, but treat confidence carefully.
- 20+ task records: good enough for recurring route/skill/drift patterns.
- High drift count: planning contract or specialist skill gap likely.
- Low verification pass rate: route/model, plan quality, or review gate may need adjustment.
- Many late handoffs: add proactive context hygiene checkpoints.

## Rules

- Do not mine unless the user asks or status clearly suggests it as a next step.
- Do not apply anything from status alone.
- Keep the summary concise and operational.
