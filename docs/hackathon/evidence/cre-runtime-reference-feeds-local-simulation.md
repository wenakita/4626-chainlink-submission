# CRE Simulation Evidence — runtime-reference-feeds (local-simulation)

Command run from `cre/cre-workflows`:

```bash
cre workflow simulate runtime-reference-feeds \
  --target local-simulation \
  --non-interactive \
  --trigger-index 0
```

Captured output excerpt:

```text
Workflow compiled
2026-03-04T14:30:28Z [SIMULATION] Simulator Initialized
2026-03-04T14:30:28Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0
2026-03-04T14:30:28Z [USER LOG] Reference feeds snapshot feeds=1 mvrFeeds=1 digest=340e65b826d0

Workflow Simulation Result:
{
  "chainName": "ethereum-mainnet-base-1",
  "feeds": 1,
  "mvrFeeds": 1,
  "digest": "340e65b826d0b48f6b3e215829de7edef8a5d554992e254bcc6fd0731148cbba",
  "sink": "disabled"
}
```
