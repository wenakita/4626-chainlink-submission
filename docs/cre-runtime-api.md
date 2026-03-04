# CRE Runtime Integration API (App <-> CRE)

This document defines the minimal app bridge contract for CRE orchestration workflows.

## Authentication

- Base auth: `Authorization: Bearer <KEEPR_API_KEY>`
- Hardened auth (enable strict mode with `CRE_RUNTIME_ENFORCE_HMAC=true`):
  - `x-cre-timestamp`: Unix epoch milliseconds
  - `x-cre-nonce`: unique nonce
  - `x-cre-signature`: hex HMAC-SHA256 over `${timestamp}.${nonce}.${stableJsonBody}`
- Transitional compatibility override (not recommended for production):
  - `CRE_RUNTIME_ALLOW_UNSIGNED_WHEN_HMAC_CONFIGURED=true`

Replay protection:
- Nonce tracking table: `cre_runtime_replay_nonces`
- Duplicate nonce returns `409`.

## Endpoint: ingest workflow outputs

- Path: `POST /api/cre/runtime/ingest`
- Handler: `frontend/api/_handlers/cre/runtime/_ingest.ts`
- Purpose: Receive workflow outputs (block summaries, metric snapshots, feed snapshots).
- Policy: Allowed `(workflow, kind)` pairs are:
  - `runtime-indexer-block:block`
  - `runtime-indexer-data-fetch:metrics`
  - `runtime-reference-feeds:feeds`

Request body:

```json
{
  "workflow": "runtime-indexer-block",
  "kind": "block",
  "idempotencyKey": "sha256(...)",
  "payload": {
    "blockNumber": 9704813,
    "matchedTransactions": 1
  },
  "source": "cre-runtime-indexer-block"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "stored": true,
    "inserted": true,
    "idempotencyKey": "..."
  }
}
```

Readback:
- `GET /api/cre/runtime/ingest?kind=block&workflow=runtime-indexer-block&limit=100`
- Returns latest persisted records for orchestration reads.

## Endpoint: persist decisions / optional queue enqueue

- Path: `POST /api/cre/runtime/decisions`
- Handler: `frontend/api/_handlers/cre/runtime/_decisions.ts`
- Purpose: Persist orchestration decision payloads and optionally enqueue app actions.
- Policy: allowed workflow is currently `runtime-orchestrator`.

Request body:

```json
{
  "workflow": "runtime-orchestrator",
  "idempotencyKey": "runtime-orchestrator:slot:123",
  "decision": {
    "shouldAct": true,
    "latestBlockNumber": 9705000
  },
  "enqueueAction": {
    "vaultAddress": "0x1111111111111111111111111111111111111111",
    "groupId": "group-1",
    "actionType": "notify",
    "action": {
      "command": "ping"
    },
    "dedupeKey": "dedupe-1"
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "stored": true,
    "inserted": true,
    "idempotencyKey": "runtime-orchestrator:slot:123",
    "actionId": 123
  }
}
```

## Endpoint: app -> CRE HTTP trigger dispatch

- Path: `POST /api/cre/runtime/trigger`
- Handler: `frontend/api/_handlers/cre/runtime/_trigger.ts`
- Purpose: Send authenticated JSON-RPC request to CRE HTTP trigger gateway.
- Optional trigger workflow allowlist:
  - `CRE_RUNTIME_ALLOWED_TRIGGER_WORKFLOW_IDS=<comma-separated-64-hex-ids>`

Request body:

```json
{
  "workflowId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "requestId": "req-manual-1",
  "input": {
    "checkpointKey": "manual-recovery",
    "latestBlockNumber": 9705000
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "accepted": true,
    "requestId": "req-manual-1",
    "statusCode": 200,
    "gatewayUrl": "https://01.gateway.zone-a.cre.chain.link",
    "response": {
      "jsonrpc": "2.0",
      "result": {
        "status": "ACCEPTED"
      }
    }
  }
}
```

Required env for trigger dispatch:
- `CRE_GATEWAY_URL`
- `CRE_HTTP_TRIGGER_PRIVATE_KEY` (or `CRE_TRIGGER_SIGNER_PRIVATE_KEY`)

## Storage model

Tables (created by `frontend/server/_lib/cre/runtimeSchema.ts`):

- `cre_runtime_records`
  - idempotent key: `(workflow, kind, idempotency_key)`
  - payload storage for workflow outputs
- `cre_runtime_decisions`
  - idempotent key: `(workflow, idempotency_key)`
  - decision payload + status
- `cre_runtime_replay_nonces`
  - one-time nonce usage for replay protection

## Operational notes

- Use deterministic idempotency keys from workflow content digests.
- Keep decision payloads concise; avoid exceeding CRE response payload limits.
- Use `GET /api/cre/runtime/ingest?kind=block&limit=1` for orchestrator checkpoint progression.
