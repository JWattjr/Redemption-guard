# Redemption Guard

**GenLayer validators read a stablecoin issuer's redemption evidence themselves, judge it against a frozen treasury policy, and must agree on one status. Only an agreed `ELIGIBLE` opens the exposure gate.**

- Live app: https://redemption-guard.vercel.app
- Contract (Studio Next, chain 61997): [`0xf0c2BeA9ccb6ff576a775baED471B02Cbf513862`](https://explorer-studio-dev.genlayer.com/address/0xf0c2BeA9ccb6ff576a775baED471B02Cbf513862)
- Submission write-up: [PORTAL_SUBMISSION.md](PORTAL_SUBMISSION.md) · Design: [ARCHITECTURE.md](ARCHITECTURE.md)

> Authorization prototype. Not financial advice. No tokens, custody, swaps, price feeds, database, accounts, or backend. NWUSD and HLUSD are fictional assets, and the three evidence pages are labeled synthetic reviewer fixtures.

## What it does

Every assessment returns exactly one status under this frozen policy (stored as a contract constant):

> New exposure is eligible only when authoritative evidence clearly refers to the correct asset and indicates that ordinary redemptions remain operational. Return RESTRICTED when authoritative evidence reports an active suspension, material delay, broad restriction, or equivalent redemption impairment. Return INSUFFICIENT_EVIDENCE when sources are missing, ambiguous, stale, contradictory, non-authoritative, or cannot be tied confidently to the asset.

| Status | `request_exposure` |
|---|---|
| `ELIGIBLE` | Recorded on-chain |
| `RESTRICTED` | Reverts `[EXPECTED] EXPOSURE_BLOCKED…` |
| `INSUFFICIENT_EVIDENCE` | Reverts |
| no assessment | Reverts |

## Repository

```
contracts/redemption_guard.py     the intelligent contract (GenVM v0.3 runner, pinned)
tests/direct/                     26 direct-mode tests (web + LLM mocked, validator logic exercised)
scripts/deploy.ts                 deploy + register the two assets + verify state
scripts/seed-demo.ts              the three proof flows, read back from chain
scripts/smoke-studio.ts           full-consensus smoke test on Studio Next
scripts/e2e-ui.ts                 browser E2E through the real UI + Transaction Kit
scripts/verify-proof.ts           re-read proof transactions (lifecycle, votes, revert reason)
frontend/                         Next.js 16 dashboard (TypeScript)
frontend/public/evidence/         the three synthetic evidence fixtures
deployments/                      studio-next.json, demo-proof.json (generated, committed)
docs/screenshots/                 desktop, mobile, and E2E screenshots
```

## Pinned toolchain (one release-candidate family)

| Piece | Version |
|---|---|
| GenVM runner (contract line 1) | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` (the v0.3 runner used across Studio Next; see [available runners](https://sdk.genlayer.com/main/executors/v0.3/python-sdk/available-runners.html)) |
| GenVM bundle for direct tests | `v0.6.0-rc5` (the bundle Studio `v0.123.0-rc.7` ships) |
| GenLayer CLI | `genlayer@0.40.0-rc.3` (has the built-in `studio-dev` network) |
| GenLayerJS | `genlayer-js@2.0.0-rc.1` (`studioDevnet`, chain 61997) |
| Transaction Kit | `@genlayer/transaction-kit@0.1.0-rc.2`, `@genlayer/transaction-kit-react@0.1.0-rc.2` (pinned to genlayer-js 2.0.0-rc.1) |
| Python tooling | `genlayer-test==0.30.0rc2`, `genvm-linter==0.11.1rc2`, `genlayer-py==0.19.0rc2` |
| Frontend | Next.js 16.3.5, React 19.3.0, TypeScript 5.9.3 |

All npm versions are exact (`.npmrc save-exact`), and `package-lock.json` is committed. Python pins are in `requirements.txt`.

## Setup

```bash
npm ci
```

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/Scripts/python.exe -r requirements.txt
```

(On macOS/Linux use `.venv/bin/python`.)

## Verify

```bash
genvm-lint check contracts/redemption_guard.py
```

```bash
python -m pytest tests/direct -q
```

```bash
npm run lint && npm run typecheck && npm run build
```

```bash
npm run test:studio
```

On Windows, set `PYTHONIOENCODING=utf-8` for `genvm-lint`, which prints a Unicode check mark. `tests/direct/conftest.py` has two small documented shims for known `genlayer-test 0.30.0rc2` defects: Windows temp-file deletion, and mocked LLM JSON handed to the v0.3 std lib as an object rather than as text.

## Deploy and seed (Studio Next may reset)

One command redeploys the contract, registers both assets, runs all three proof flows, and writes the generated files the frontend reads:

```bash
npm run deploy:demo
```

It needs no key. On first run it creates a Studio-Next-only deployer key in the gitignored `.env`, never prints it, and funds it through Studio Next's `sim_fundAccount` faucet RPC. Afterwards, rebuild and redeploy the frontend so it picks up the new `frontend/lib/deployment.generated.json`:

```bash
cd frontend && vercel deploy --prod
```

The evidence fixtures must be reachable over public HTTPS before deploying. The scripts check this and stop if they are not. Their host (`FIXTURE_BASE_URL`, default `https://redemption-guard.vercel.app`) is registered on-chain as the demo assets' issuer domain.

## Studio Next notes

- RPC `https://studio-dev.genlayer.com/api`, chain 61997, explorer `https://explorer-studio-dev.genlayer.com`.
- Writes need explicit fees. The scripts use `estimateTransactionFeesForWrite` (simulation) and fall back to `estimateTransactionFees`. The UI uses Transaction Kit's fee review.
- The RPC allows about 30 requests per minute per client. The dashboard makes one aggregated read (`get_dashboard`) every 30 s, pauses polling while a transaction is tracked, and spaces and retries its RPC calls. The scripts back off on rate limits.
- `gen_dbg_traceTransaction` is not served, so revert reasons are decoded from `consensus_data.leader_receipt[0].result` (a result-code byte followed by the payload).
