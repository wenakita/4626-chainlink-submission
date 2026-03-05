# Submission Form Copy (Chainlink Hackathon)

Use this document as copy-paste source text for the final submission form.

## Project Name

Converge | A Chainlink Hackathon Submission

## Public Repository

<https://github.com/4626fun/convergence-chainlink-hackathon>

## Public Demo Video (3-5 min)

TBD

## Tracks

- DeFi & Tokenization
- CRE & AI

## One-Sentence Description

Converge uses Chainlink CRE to orchestrate deterministic, value-protecting protocol operations across onchain state, external APIs, and AI-assisted risk checks.

## Problem Statement

4626 operates value-critical vault flows where onchain state, offchain services, and operator actions must stay consistent.  
Without deterministic automation, teams face missed keeper actions, duplicate execution under retries, stale pricing assumptions, and delayed response to payout misconfiguration risk.

## Why This Secures Value

- Chainlink CRE enforces deterministic offchain orchestration with replay-safe workflow logic.
- Chainlink Data Feeds + MVR provide accurate, reliable, hard-to-manipulate oracle references.
- Chainlink VRF 2.5 provides tamper-proof randomness with cryptographic proof tied to request lifecycle.
- Idempotency keys, durable checkpoints, and authenticated bridge endpoints reduce double-execution and tampering risk.

## Chainlink Products Used

- **Chainlink Runtime Environment (CRE)**  
  Used for workflow orchestration (`payout-integrity`, `keepr-queue`, and runtime ingestion/orchestrator flows).
- **Chainlink Data Feeds + MVR**  
  Used in `runtime-reference-feeds` to read verified reference data for deterministic decisions.
- **Chainlink VRF 2.5**  
  Used in lottery contracts for fair and verifiable winner selection.

## What We Built for This Submission

- CRE workflow integrations that combine blockchain reads with external API and AI-assisted analysis.
- Runtime ingest/decision bridge endpoints with replay protection and idempotent persistence.
- Deterministic simulation evidence bundle for webhook, cron, feed-reader, and orchestrator workflows.
- Hackathon-focused docs (requirement mapping, A-I writeup, runbook, and video script).

## Required CRE Workflow + External Integration Proof

Primary required proof workflow:
- `cre/cre-workflows/payout-integrity/main.ts`  
  Integrates EVM reads + HTTP bridge + AI advisory endpoint.

Additional CRE workflow proof:
- `cre/cre-workflows/keepr-queue/main.ts`
- `cre/cre-workflows/runtime-indexer-block/main.ts`
- `cre/cre-workflows/runtime-indexer-data-fetch/main.ts`
- `cre/cre-workflows/runtime-reference-feeds/main.ts`
- `cre/cre-workflows/runtime-orchestrator/main.ts`

## Exact Simulation Commands

Run from `cre/cre-workflows`:

```bash
set -a && source .env && set +a
node ../scripts/hackathon/mock-cre-api-server.mjs

cre workflow simulate ./payout-integrity --target local-simulation
cre workflow simulate ./keepr-queue --target local-simulation
cre workflow simulate runtime-indexer-block --target local-simulation --non-interactive --trigger-index 0 --http-payload @test-block.json
cre workflow simulate runtime-indexer-data-fetch --target local-simulation --non-interactive --trigger-index 0
cre workflow simulate runtime-reference-feeds --target local-simulation --non-interactive --trigger-index 0
cre workflow simulate runtime-orchestrator --target local-simulation --non-interactive --trigger-index 0
cre workflow simulate runtime-orchestrator --target local-simulation --non-interactive --trigger-index 1 --http-payload @http_trigger_payload.json
```

## Simulation Evidence Links

- `docs/hackathon/evidence/cre-payout-integrity-local-simulation.md`
- `docs/hackathon/evidence/cre-keepr-queue-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-indexer-block-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-indexer-data-fetch-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-reference-feeds-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-orchestrator-cron-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-orchestrator-http-local-simulation.md`

