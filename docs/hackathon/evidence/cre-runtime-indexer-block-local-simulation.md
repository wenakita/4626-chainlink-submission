# CRE Simulation Evidence — runtime-indexer-block (local-simulation)

Command run from `cre/cre-workflows`:

```bash
cre workflow simulate runtime-indexer-block \
  --target local-simulation \
  --non-interactive \
  --trigger-index 0 \
  --http-payload @test-block.json
```

Captured output excerpt:

```text
Workflow compiled
2026-03-04T14:30:21Z [SIMULATION] Simulator Initialized
2026-03-04T14:30:21Z [SIMULATION] Running trigger trigger=http-trigger@1.0.0-alpha
2026-03-04T14:30:21Z [USER LOG] Processed block payload block=9704813 uniqueTransactions=1 matchedTransactions=1

Workflow Simulation Result:
{
  "blockNumber": 9704813,
  "blockHash": "0xf49c1958f057aae44d4636511744fd5f66e0a1572c68c3b6f89c6460b87b3d08",
  "matchedTransactions": 1,
  "idempotencyKey": "ae8d06db41ddc4e90c112e996839e012aea59c93b1cea1223e66a3e76bdce238",
  "sink": "disabled"
}
```
