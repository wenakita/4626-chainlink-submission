# Final Submission Checklist

Use this checklist immediately before pressing submit.

## Submission Artifacts

- [ ] Public repo is accessible: <https://github.com/4626fun/convergence-chainlink-hackathon>
- [ ] `README.md` is hackathon-only and up to date.
- [ ] Public demo video URL is filled in `README.md` (replace `TBD`).
- [ ] Video length is between 3 and 5 minutes.
- [ ] Video is publicly viewable without login/request access.

## Required Requirement Coverage

- [ ] Project description includes use case + stack/architecture.
- [ ] README links to files that use Chainlink.
- [ ] At least one CRE workflow integrates blockchain + external API/system/data source/AI.
- [ ] CRE CLI simulation success is shown in video or evidence docs.
- [ ] Sponsor-specific track requirements are mapped in `docs/hackathon/chainlink-cre-submission.md`.

## Verification Pass

- [ ] Re-ran key simulations from `cre/cre-workflows`:
  - [ ] `cre workflow simulate ./payout-integrity --target local-simulation`
  - [ ] `cre workflow simulate ./keepr-queue --target local-simulation`
  - [ ] Runtime workflow simulations (indexer, feeds, orchestrator)
- [ ] Evidence markdown snapshots match the latest successful output.
- [ ] No secrets/tokens are present in committed docs or logs.

## Submission Form Prep

- [ ] Copy text prepared in `docs/hackathon/submission-form-copy.md`.
- [ ] Repo URL in form points to `4626fun/convergence-chainlink-hackathon`.
- [ ] Video URL in form matches the public video link.
- [ ] Final screenshots or clips clearly show workflow execution and outputs.

## Final Freeze

- [ ] Final commit/tag selected for submission.
- [ ] Any last-minute doc edits pushed to `main`.
- [ ] Quick sanity check of README links completed.

