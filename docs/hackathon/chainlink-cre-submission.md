# Chainlink CRE Submission Checklist

This document maps 4626 implementation artifacts to the Chainlink hackathon requirements for:
- **DeFi & Tokenization**
- **CRE & AI**

Reference templates: [smartcontractkit/cre-templates](https://github.com/smartcontractkit/cre-templates/)

## Requirement Mapping

| Requirement | Evidence in this repo |
|---|---|
| CRE workflow orchestrates blockchain + external system and simulates successfully | `cre/cre-workflows/payout-integrity/main.ts` (EVM reads + HTTP bridge + AI advisory), `cre/cre-workflows/keepr-queue/main.ts` (HTTP orchestration), simulation logs in `docs/hackathon/evidence/` |
| Integrates at least one blockchain with external API/system/LLM/AI | Blockchain reads via `EVMClient` in `cre/cre-workflows/payout-integrity/main.ts`; external API bridge at `frontend/api/_handlers/cre/keeper/_alert.ts`; AI endpoint at `frontend/api/_handlers/cre/keeper/_aiAssess.ts` using `frontend/server/agent/eliza/llm.ts` |
| Successful simulation via CRE CLI | `docs/hackathon/evidence/cre-payout-integrity-local-simulation.md` and `docs/hackathon/evidence/cre-keepr-queue-local-simulation.md` |
| Runtime orchestration simulations (webhook + cron + feeds + checkpoint orchestrator) | `docs/hackathon/evidence/cre-runtime-indexer-block-local-simulation.md`, `docs/hackathon/evidence/cre-runtime-indexer-data-fetch-local-simulation.md`, `docs/hackathon/evidence/cre-runtime-reference-feeds-local-simulation.md`, `docs/hackathon/evidence/cre-runtime-orchestrator-cron-local-simulation.md`, `docs/hackathon/evidence/cre-runtime-orchestrator-http-local-simulation.md` |
| AI-assisted CRE workflow where deterministic logic remains authoritative | Deterministic checks and alert generation in `cre/cre-workflows/payout-integrity/main.ts`; advisory AI classification in `frontend/api/_handlers/cre/keeper/_aiAssess.ts`; fallback normalization in `cre/utils/payoutIntegrityAi.ts` |
| Solana operational workflow path is demonstrated | Solana monitor implementation `cre/actions/keepr-solana-price-monitor.action.ts`, workflow `cre/workflows/keepr-solana-price-monitor.workflow.ts`, operator command path `/cre solana` in `frontend/server/agent/eliza/plugins/cre/index.ts`, and test proof `cre/tests/keepr-solana-price-monitor.test.ts` |
| Tests covering new behavior | `cre/tests/payoutIntegrityAi.test.ts`, `frontend/api/__tests__/creKeeperAiAssess.test.ts` |
| Public video walkthrough (3-5 min) | Script in `docs/hackathon/video-script.md` |
| Public source code path | Preparation runbook in `docs/hackathon/public-source-packaging.md` |
| README includes links to files using Chainlink | `cre/README.md` section: **Files Using Chainlink** |
| Comprehensive A-I plan, threat model, roadmap, and product-by-product strengths | `docs/hackathon/chainlink-cre-a-to-i.md` |

## Problem We Are Solving

4626 is a multi-strategy, multi-chain creator vault protocol. That creates a hard operations problem:

- Onchain state changes continuously (vault idle balances, strategy thresholds, auction graduation, fee routes).
- Cross-system dependencies exist across chains, APIs, and bots.
- Manual operations are error-prone and introduce security and liveness risk (missed actions, duplicated actions, delayed responses).

The core problem is how to run this system with deterministic, auditable, and tamper-resistant automation while preserving decentralization properties.

## Why This Solution Secures Value

- **Capital protection:** CRE workflows continuously enforce risk and settlement checks, reducing stale or missed operations.
- **Payout integrity:** deterministic policy checks detect misconfigurations before value leakage.
- **Price integrity:** Chainlink Data Feeds/MVR reads provide reliable, non-manipulable reference pricing inputs.
- **Fair randomness:** Chainlink VRF 2.5 provides cryptographic proof that lottery randomness was generated from a valid request and not manipulated.
- **Operational integrity:** idempotent keys, checkpointing, replay protection, and deterministic consensus paths reduce double-execution and race-condition risk.

## Chainlink Product Strengths In This Architecture

| Chainlink product | Where used | Product strength | Value to 4626 |
|---|---|---|---|
| **Chainlink Runtime Environment (CRE)** | `cre/cre-workflows/**` (e.g. `runtime-indexer-block`, `runtime-indexer-data-fetch`, `runtime-reference-feeds`, `runtime-orchestrator`) | Verified offchain computation with deterministic workflow execution and capability composition (Cron/HTTP/EVM). | Reliable orchestration layer for complex protocol operations across onchain and offchain systems. |
| **Chainlink Data Feeds + MVR** | `cre/cre-workflows/runtime-reference-feeds/main.ts` | Accurate, reliable, tamper-resistant oracle network data and bundle decoding support. | Prevents strategy/payout logic from relying on manipulable or stale price inputs. |
| **Chainlink VRF 2.5** | `contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol`, `contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`, `contracts/utilities/lottery/CreatorLotteryManager.sol` | Verifiable randomness with cryptographic proof linked to each request. | Fair winner selection and trust-minimized lottery outcomes for creator rewards. |

## Roadmap (Where This Goes Next)

### Current

- Template-first CRE orchestration for push + pull + feed verification + durable checkpoints.
- Deterministic ingestion and decision workflows with replay protection and idempotent persistence.

### Near-term

- Shift more event paths from webhook ingestion to native `LogTrigger` where it improves latency and trust assumptions.
- Expand runtime decision workflows to additional protocol health and risk controls.

### Rebalancing roadmap (answer to “does it rebalance between strategies?”)

- **Today:** automated rebalancing is strategy-specific (for example, Ajna bucket movement and Charm vault rebalance triggers).
- **Next step:** add cross-strategy allocation logic so capital can rebalance **between** strategies (Ajna/Charm/idle) under deterministic policy constraints.
- **Future:** integrate CRE native write receiver contracts to remove remaining bridge boundaries and allow end-to-end verifiable execution paths.

## Track Coverage

### DeFi & Tokenization

- Workflow: `cre/cre-workflows/payout-integrity/main.ts`
- Onchain component: Base smart contract state checks through `EVMClient`
- External systems: HTTP bridge endpoints under `frontend/api/_handlers/cre/**`
- Simulation evidence: `docs/hackathon/evidence/cre-payout-integrity-local-simulation.md`

### CRE & AI

- AI-assisted path: CRE workflow calls `/api/cre/keeper/aiAssess`
- AI runtime: `frontend/server/agent/eliza/llm.ts`
- Deterministic authority preserved: deterministic alert checks still decide alerting pipeline; AI is advisory output only
- Simulation evidence: `docs/hackathon/evidence/cre-payout-integrity-local-simulation.md` includes `aiEnabled`, `aiVerdict`, `aiConfidence`

## Solana-First Demo Path

Primary operator-facing flow for demo:
- `/cre solana` in `frontend/server/agent/eliza/plugins/cre/index.ts`
- Solana monitor action in `cre/actions/keepr-solana-price-monitor.action.ts`
- Solana monitor workflow definition in `cre/workflows/keepr-solana-price-monitor.workflow.ts`

Fee return path (Solana -> Base):
- Solana harvest/withdraw instruction: `programs/creator-share-hook/src/instructions/flush_fees.rs`
- Keeper fee flush action: `cre/actions/keepr-solana-fee-flush.action.ts`
- Base adapter entrypoint: `contracts/utilities/bridge/SolanaBridgeAdapter.sol` (`receiveFeeFromSolana`)
- Gauge intake and distribution: `contracts/governance/CreatorGaugeController.sol` (`receiveFees`)

Non-mutating Solana proof command:

```bash
pnpm -C cre exec vitest run tests/keepr-solana-price-monitor.test.ts
```

This keeps the demo engaging while preserving CRE CLI simulation proof for submission requirements.

## Commands Used (Simulation-First)

Run from `cre/cre-workflows`:

```bash
set -a && source .env && set +a
node ../scripts/hackathon/mock-cre-api-server.mjs

cre workflow simulate ./payout-integrity --target local-simulation \
  | tee ../../docs/hackathon/evidence/cre-payout-integrity-local-simulation.log

cre workflow simulate ./keepr-queue --target local-simulation \
  | tee ../../docs/hackathon/evidence/cre-keepr-queue-local-simulation.log

# Runtime orchestration simulation set
cre workflow simulate runtime-indexer-block --target local-simulation --non-interactive --trigger-index 0 --http-payload @test-block.json \
  | tee ../../docs/hackathon/evidence/cre-runtime-indexer-block-local-simulation.log
cre workflow simulate runtime-indexer-data-fetch --target local-simulation --non-interactive --trigger-index 0 \
  | tee ../../docs/hackathon/evidence/cre-runtime-indexer-data-fetch-local-simulation.log
cre workflow simulate runtime-reference-feeds --target local-simulation --non-interactive --trigger-index 0 \
  | tee ../../docs/hackathon/evidence/cre-runtime-reference-feeds-local-simulation.log
cre workflow simulate runtime-orchestrator --target local-simulation --non-interactive --trigger-index 0 \
  | tee ../../docs/hackathon/evidence/cre-runtime-orchestrator-cron-local-simulation.log
cre workflow simulate runtime-orchestrator --target local-simulation --non-interactive --trigger-index 1 --http-payload @http_trigger_payload.json \
  | tee ../../docs/hackathon/evidence/cre-runtime-orchestrator-http-local-simulation.log
```

Raw CLI logs are captured as `*.log` during execution; committed submission snapshots are in:
- `docs/hackathon/evidence/cre-payout-integrity-local-simulation.md`
- `docs/hackathon/evidence/cre-keepr-queue-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-indexer-block-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-indexer-data-fetch-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-reference-feeds-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-orchestrator-cron-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-orchestrator-http-local-simulation.md`

## Key Simulation Highlights

From `cre-payout-integrity-local-simulation.md`:
- `aiEnabled: true`
- `aiVerdict: "critical"`
- `alertsSent: 2`
- deterministic alert payloads emitted and forwarded via bridge

From `cre-keepr-queue-local-simulation.md`:
- queue orchestration executes cleanly with `processed=0`, `failed=0`

## New Work Added for Submission

To satisfy the “existing project + new component” rule, this submission adds:
- explicit AI advisory step in existing `payout-integrity` CRE workflow
- new CRE-facing AI assessment endpoint and route
- new tests for AI normalization and endpoint behavior
- simulation evidence bundle and submission docs
