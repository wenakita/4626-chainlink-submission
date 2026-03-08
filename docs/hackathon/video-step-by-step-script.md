# Video Step-by-Step Script (Say + Show)

Target length: **4 minutes**

## 0:00-0:25 — Intro

### Say

1. "This is 4626, and we're using Chainlink CRE as an orchestration layer for protocol operations."
2. "The problem we solve is secure automation for a multi-chain, multi-strategy protocol where manual ops are brittle."
3. "Today I'll lead with our Solana workflow path, then show the Chainlink CRE simulation proof."

### Show

- `cre/README.md` and point to **Files Using Chainlink**.

## 0:25-1:10 — Solana Workflow Spotlight

### Show

- `cre/workflows/keepr-solana-price-monitor.workflow.ts`
- `cre/actions/keepr-solana-price-monitor.action.ts`
- `frontend/server/agent/eliza/plugins/cre/index.ts` and `/cre solana`

### Say

- "We compare Base oracle versus Solana DLMM pricing."
- "We apply deviation thresholds for alert/recenter/halt decisions."
- "We compute derived metrics like creator-per-1-SOL from both paths."

## 1:10-1:50 — Show Operator UX (`/cre solana`)

### Show

- Run `/cre solana` in operator/chat UI.

### Say

- "Here are Base oracle and Solana DLMM prices."
- "Here are oracle-implied and DLMM-implied creator-per-SOL values."
- "This deviation drives the action recommendation."

## 1:50-2:20 — Explain Fee Route (Solana -> Base)

### Say

1. "Creator transfer fees are harvested on Solana via `flush_fees`."
2. "Those fees bridge to Base to the keeper Twin, then the Twin calls `SolanaBridgeAdapter.receiveFeeFromSolana()`."
3. "The adapter resolves the creator gauge and forwards fees into `CreatorGaugeController.receiveFees()` for distribution."
4. "So Solana is the high-velocity surface, but accounting and distribution settle on Base."

## 2:20-2:45 — Solana Monitor Test Proof (non-mutating)

### Run (from repo root)

```bash
pnpm -C cre exec vitest run tests/keepr-solana-price-monitor.test.ts
```

### Say

1. "This validates the Solana monitor path and derived metric formatting."
2. "It is read-oriented and safe to run in a live demo."

## 2:45-3:20 — Chainlink CRE CLI Simulation Proof (required)

### Run (from `cre/cre-workflows`)

```bash
set -a && source .env && set +a
node ../scripts/hackathon/mock-cre-api-server.mjs

cre workflow simulate ./payout-integrity --target local-simulation
cre workflow simulate ./keepr-queue --target local-simulation
```

### Say

1. "This is the explicit CRE CLI simulation proof for submission."
2. "`payout-integrity` shows deterministic checks plus AI advisory fields."
3. "`keepr-queue` shows successful orchestration metrics."

## 3:20-3:50 — Evidence Bundle + Requirement Mapping

### Show

- `docs/hackathon/evidence/cre-payout-integrity-local-simulation.md`
- `docs/hackathon/evidence/cre-keepr-queue-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-indexer-block-local-simulation.md`
- `docs/hackathon/evidence/cre-runtime-orchestrator-cron-local-simulation.md`
- `docs/hackathon/chainlink-cre-submission.md`
- `docs/hackathon/chainlink-cre-a-to-i.md`

### Say

1. "These are simulation-first proof artifacts for judges."
2. "This checklist maps each requirement to exact files and outputs."
3. "It maps product strengths: CRE for verified offchain compute, Data Feeds for reliable prices, and VRF for tamper-proof randomness."

## 3:50-4:00 — Wrap

### Say

1. "This project demonstrates Solana operational monitoring, plus Chainlink CRE orchestration across onchain reads, external APIs, and AI-assisted analysis."
2. "On rebalancing: today we rebalance within strategies, and the roadmap extends this to cross-strategy rebalance between Ajna, Charm, and idle capital under deterministic controls."
3. "All source and docs are prepared for public submission, with secrets excluded."

