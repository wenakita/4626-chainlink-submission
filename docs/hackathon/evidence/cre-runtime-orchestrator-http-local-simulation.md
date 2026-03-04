# CRE Simulation Evidence — runtime-orchestrator HTTP trigger (local-simulation)

Command run from `cre/cre-workflows`:

```bash
cre workflow simulate runtime-orchestrator \
  --target local-simulation \
  --non-interactive \
  --trigger-index 1 \
  --http-payload @http_trigger_payload.json
```

Captured output excerpt:

```text
Workflow compiled
2026-03-04T14:30:36Z [SIMULATION] Simulator Initialized
2026-03-04T14:30:36Z [SIMULATION] Running trigger trigger=http-trigger@1.0.0-alpha

Workflow Simulation Result:
{
  "workflow": "runtime-orchestrator",
  "trigger": "http",
  "reason": "operator-recovery",
  "previousCheckpoint": 0,
  "latestBlockNumber": 9705000,
  "nextCheckpoint": 9705000,
  "matchedTransactions": 3,
  "shouldAct": true,
  "idempotencyKey": "runtime-orchestrator:manual-recovery",
  "sink": "disabled"
}
```
