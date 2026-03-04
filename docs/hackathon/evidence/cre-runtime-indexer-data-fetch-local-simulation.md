# CRE Simulation Evidence — runtime-indexer-data-fetch (local-simulation)

Command run from `cre/cre-workflows`:

```bash
cre workflow simulate runtime-indexer-data-fetch \
  --target local-simulation \
  --non-interactive \
  --trigger-index 0
```

Captured output excerpt:

```text
Workflow compiled
2026-03-04T14:30:24Z [SIMULATION] Simulator Initialized
2026-03-04T14:30:24Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0
2026-03-04T14:30:24Z [USER LOG] Indexer fetch complete source=mock digest=32b39078c46c

Workflow Simulation Result:
{
  "endpoint": "mock://graphql",
  "source": "mock",
  "digest": "32b39078c46cc1572cd796c28b82c61371d53809ac14f5b92e993121fc3d209a",
  "sink": "disabled"
}
```
