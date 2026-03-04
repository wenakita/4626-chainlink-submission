# CRE Simulation Evidence — runtime-orchestrator cron trigger (local-simulation)

Command run from `cre/cre-workflows`:

```bash
cre workflow simulate runtime-orchestrator \
  --target local-simulation \
  --non-interactive \
  --trigger-index 0
```

Captured output excerpt:

```text
Workflow compiled
2026-03-04T14:30:32Z [SIMULATION] Simulator Initialized
2026-03-04T14:30:32Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0

Workflow Simulation Result:
{
  "workflow": "runtime-orchestrator",
  "trigger": "cron",
  "reason": "checkpoint_advanced",
  "previousCheckpoint": 0,
  "latestBlockNumber": 9704813,
  "nextCheckpoint": 9704813,
  "matchedTransactions": 1,
  "shouldAct": true,
  "idempotencyKey": "runtime-orchestrator:slot:29544390",
  "sink": "disabled"
}
```
