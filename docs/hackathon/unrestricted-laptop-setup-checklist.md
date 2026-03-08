# Unrestricted Laptop Setup Checklist

Use this on a machine with normal outbound internet access.

## Goal

Get the required Chainlink CRE simulations running locally for the hackathon submission:

- `payout-integrity`
- `keepr-queue`

## 1) Install the official Chainlink CRE CLI

Follow the official Chainlink install steps until both commands work:

```bash
which cre
cre version
```

If `cre version` fails, stop and finish CLI installation before continuing.

## 2) Log in

```bash
cre login
```

## 3) Clone the repo

```bash
git clone https://github.com/4626fun/convergence-chainlink-hackathon.git
cd convergence-chainlink-hackathon
```

## 4) Install repo dependencies

```bash
npm --prefix cre install
```

## 5) Create env files

```bash
cp cre/cre-workflows/.env.example cre/cre-workflows/.env
cp cre/secrets.example.env cre/.env
cp frontend/.env.example frontend/.env.local
```

## 6) Paste env values

Use:

- `docs/hackathon/submission-env-vars-and-secrets.actual.local.md`

Paste:

- Category A into `cre/cre-workflows/.env`
- Category B into `cre/.env`
- Category C into `frontend/.env.local` only if needed

## 7) Start the mock API server

Open Terminal 1:

```bash
cd cre/cre-workflows
set -a && source .env && set +a
node ../scripts/hackathon/mock-cre-api-server.mjs
```

Leave it running.

## 8) Run the required CRE simulations

Open Terminal 2:

```bash
cd cre/cre-workflows
set -a && source .env && set +a
cre workflow simulate ./payout-integrity --target local-simulation
cre workflow simulate ./keepr-queue --target local-simulation
```

## 9) Optional full runtime simulation set

```bash
cd cre/cre-workflows
set -a && source .env && set +a

cre workflow simulate runtime-indexer-block --target local-simulation --non-interactive --trigger-index 0 --http-payload @test-block.json
cre workflow simulate runtime-indexer-data-fetch --target local-simulation --non-interactive --trigger-index 0
cre workflow simulate runtime-reference-feeds --target local-simulation --non-interactive --trigger-index 0
cre workflow simulate runtime-orchestrator --target local-simulation --non-interactive --trigger-index 0
cre workflow simulate runtime-orchestrator --target local-simulation --non-interactive --trigger-index 1 --http-payload @http_trigger_payload.json
```

## 10) Success checklist

- [ ] `cre version` works
- [ ] `cre login` succeeds
- [ ] mock server starts on `http://127.0.0.1:8789`
- [ ] `payout-integrity` simulation completes
- [ ] `keepr-queue` simulation completes

## 11) If it fails

- `cre: command not found`
  - The official CRE CLI is not installed or not in `PATH`.
- clone fails with proxy / 403
  - The machine does not have normal outbound access.
- `npx cre` fails
  - Do not use npm fallback; install the official CLI instead.
