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
| AI-assisted CRE workflow where deterministic logic remains authoritative | Deterministic checks and alert generation in `cre/cre-workflows/payout-integrity/main.ts`; advisory AI classification in `frontend/api/_handlers/cre/keeper/_aiAssess.ts`; fallback normalization in `cre/utils/payoutIntegrityAi.ts` |
| Solana operational workflow path is demonstrated | Solana monitor implementation `cre/actions/keepr-solana-price-monitor.action.ts`, workflow `cre/workflows/keepr-solana-price-monitor.workflow.ts`, operator command path `/cre solana` in `frontend/server/agent/eliza/plugins/cre/index.ts`, and test proof `cre/tests/keepr-solana-price-monitor.test.ts` |
| Tests covering new behavior | `cre/tests/payoutIntegrityAi.test.ts`, `frontend/api/__tests__/creKeeperAiAssess.test.ts` |
| Public video walkthrough (3-5 min) | Script in `docs/hackathon/video-script.md` |
| Public source code path | Preparation runbook in `docs/hackathon/public-source-packaging.md` |
| README includes links to files using Chainlink | `cre/README.md` section: **Files Using Chainlink** |

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
```

Raw CLI logs are captured as `*.log` during execution; committed submission snapshots are in:
- `docs/hackathon/evidence/cre-payout-integrity-local-simulation.md`
- `docs/hackathon/evidence/cre-keepr-queue-local-simulation.md`

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
