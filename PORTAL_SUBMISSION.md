# Redemption Guard — GenLayer Portal submission

## One line

A treasury can only take new exposure to a stablecoin after independent GenLayer validators read the issuer's own redemption evidence and agree, under a frozen policy, that ordinary redemptions are working.

## Product

Redemption Guard monitors two stablecoins. Anyone can submit 1–3 HTTPS evidence URLs for an asset. GenLayer validators fetch those pages themselves, apply a frozen treasury policy, and must agree on exactly one status: `ELIGIBLE`, `RESTRICTED`, or `INSUFFICIENT_EVIDENCE`. The agreed status is written on-chain, and a deterministic `request_exposure` method records new exposure **only** when that latest status is `ELIGIBLE`. Anything else, including no assessment at all, reverts.

It is an authorization prototype. There are no tokens, custody, swaps, or price feeds, and no database, accounts, or backend.

## Why this genuinely requires GenLayer

- **The input is prose, not data.** Redemption notices are unstructured issuer statements ("suspended until further notice", "under review", "processing normally"). No oracle feed or regex turns them into an authorization decision reliably.
- **The decision is consequential and must not belong to one party.** If the frontend, a backend, or a single LLM call decided the status, whoever runs it could open the gate. Here the status is final only when a majority of validators, each re-fetching the evidence and re-judging it independently, agree on it.
- **The judgment directly gates a state transition.** The consensus output is not decoration. It is the only input `request_exposure` reads. Remove GenLayer and the gate has nothing to evaluate.
- **Fail-closed by construction.** Ambiguous, stale, missing, contradictory, or non-issuer evidence cannot open the gate, and validator disagreement produces no status at all.

## Boundary

| Layer | Responsibility |
|---|---|
| **Frontend** | Wallet, URL entry, Transaction Kit fee review and signing, lifecycle display, reading back contract state to confirm outcomes. It sends **only URLs** and never a conclusion. |
| **Deterministic contract logic** | Owner-only registration of at most 2 assets with their issuer domains; validation of URLs (1–3, `https://`, ≤ 300 chars, public host, unique), amounts (positive integers), and IDs; the rule that a decisive status must cite a usable source on the registered issuer domain; persistence; the `ELIGIBLE`-only exposure gate. |
| **External evidence** | Issuer pages over public HTTPS. Validators fetch them directly; 4xx, oversized (> 1 MB), or non-text sources are unusable, and 5xx or network errors abort the transaction as `[TRANSIENT]`. |
| **GenLayer judgment** | `gl.vm.run_nondet` leader/validator (GenVM v0.3's name for `run_nondet_unsafe`). The leader fetches and judges; each validator re-fetches, re-judges, and agrees only if its **status** matches. Prose may differ. LLM errors always disagree, forcing rotation. |

## The consequential state transition

`assess_asset` → (consensus) → `latest_assessment[asset] = id` → `request_exposure` succeeds **iff** `assessments[id].status == "ELIGIBLE"`, otherwise reverts `[EXPECTED] EXPOSURE_BLOCKED: <asset> latest assessment #<id> is <status>`.

## Live links

- App: https://redemption-guard.vercel.app
- Contract on GenLayer Studio Next (chain 61997): [`0xf0c2BeA9ccb6ff576a775baED471B02Cbf513862`](https://explorer-studio-dev.genlayer.com/address/0xf0c2BeA9ccb6ff576a775baED471B02Cbf513862)
- Deploy tx: [`0xc0f2cad7…12a8a`](https://explorer-studio-dev.genlayer.com/tx/0xc0f2cad746f53518c520e95a8d5be13d27c0a900400c3277f99b64eefe512a8a)
- Synthetic reviewer fixtures (public HTTPS, fetched by validators):
  - Operational (NWUSD): https://redemption-guard.vercel.app/evidence/northwind-redemptions-operational.html
  - Suspended (HLUSD): https://redemption-guard.vercel.app/evidence/halcyon-redemptions-suspended.html
  - Ambiguous (HLUSD): https://redemption-guard.vercel.app/evidence/halcyon-status-unclear.html

## Three proof transactions (Studio Next, all FINALIZED, 5 initial validators each)

Produced by `npm run seed` on 2026-09-18 and re-verified from chain with `npm run verify:proof`.

| Flow | Assessment tx (status) | Exposure tx (result) |
|---|---|---|
| **1. RESTRICTED → blocked** (HLUSD, suspension notice) | [`0xb14651cc…eeeda6`](https://explorer-studio-dev.genlayer.com/tx/0xb14651ccf41027d050b338779492b4ec9490272915996810808d3117fceeeda6) — `RESTRICTED`, `REDEMPTIONS_SUSPENDED`, 3 agree / 5 | [`0xbd69447f…008beb`](https://explorer-studio-dev.genlayer.com/tx/0xbd69447f39d443694cbe38cc5ebd1ce5ef9b167aa94e06c79250e23e7a008beb) — `FINISHED_WITH_ERROR`: `[EXPECTED] EXPOSURE_BLOCKED: HLUSD latest assessment #1 is RESTRICTED` |
| **2. INSUFFICIENT_EVIDENCE → blocked** (HLUSD, ambiguous update) | [`0x21eca7d4…63b80f`](https://explorer-studio-dev.genlayer.com/tx/0x21eca7d420ed24e8c82dcbc2514f578ed489fe19388ed948a250ec82af63b80f) — `INSUFFICIENT_EVIDENCE`, `SOURCE_AMBIGUOUS` + `NO_REDEMPTION_INFORMATION`, 3 agree / 5 | [`0xc9bf0f15…6d004b9`](https://explorer-studio-dev.genlayer.com/tx/0xc9bf0f15a697da3ee9211ac3797f65e03386e54f8562dd0be1e3df8e86d004b9) — `FINISHED_WITH_ERROR`: `…latest assessment #2 is INSUFFICIENT_EVIDENCE` |
| **3. ELIGIBLE → permitted** (NWUSD, operational notice) | [`0x39764b1b…441c3d`](https://explorer-studio-dev.genlayer.com/tx/0x39764b1b659ff611c1941b7a61048cf0530943d726dbc96e17d76083fa441c3d) — `ELIGIBLE`, `REDEMPTIONS_OPERATIONAL`, 3 agree / 5 | [`0x3c9938eb…eb65`](https://explorer-studio-dev.genlayer.com/tx/0x3c9938eb8a39a81d7cb0acca2d962eac2c30171b572d0bbefa9430e7bee0eb65) — `FINISHED_WITH_RETURN`: exposure #1, 250,000 units, count 0 → 1 |

For each flow, the resulting state was read back (latest assessment status and exposure count). Full records: `deployments/demo-proof.json`.

Additional genuine transactions against the same contract:

- **Browser E2E through the real UI and Transaction Kit** (`npm run test:ui`, injected test wallet): blocked HLUSD request [`0x99292da7…3083c`](https://explorer-studio-dev.genlayer.com/tx/0x99292da77060a35ef6b1e882055e13f58f37c2990dba0bbdf2e68a7977a3083c), NWUSD assessment → `ELIGIBLE` #4 [`0x0f32e6a8…e4981`](https://explorer-studio-dev.genlayer.com/tx/0x0f32e6a8da716e11465abde0ac6b56fe96fb807293e94100e651ac989a5e4981), permitted 75,000-unit exposure [`0xc4299d20…f068c2`](https://explorer-studio-dev.genlayer.com/tx/0xc4299d20b939fe605bf6eea7be7f2a5250b7e324221bfa7fdadecd0492f068c2).
- **Smoke test** (`npm run test:studio`): HLUSD re-assessed → `INSUFFICIENT_EVIDENCE` #5 [`0xb888207c…ce6076`](https://explorer-studio-dev.genlayer.com/tx/0xb888207cda7c1847142891aff0eba9eddf71cf9339bebe7fe346ff8a3dce6076), then blocked exposure [`0x4eb8afdc…fa8b4`](https://explorer-studio-dev.genlayer.com/tx/0x4eb8afdc6a6abed3e1ba802cacea9a764ec630d88da9d1dc876241d7140fa8b4).

An earlier deployment (`0xc013C164…2070`) ran the same three flows with the same outcomes before the aggregated `get_dashboard` view was added.

## 60-second reviewer demo

1. **0–10 s.** Open https://redemption-guard.vercel.app. Without connecting, you see live chain state: NWUSD `ELIGIBLE` with the gate **Open**, HLUSD `INSUFFICIENT_EVIDENCE` with the gate **Closed**, the frozen policy, and the on-chain activity.
2. **10–20 s.** Scroll to **Proof transactions**. Three flows, each with an explorer link. The two blocked requests show the contract's own revert reason.
3. **20–35 s.** Connect a wallet. The app adds or switches to Studio Next (61997). Click **Get Studio Next test GEN for fees**. In **2 · Request exposure**, choose **HLUSD**, then **Request exposure**, then **Approve & sign**. Result: *Exposure blocked for HLUSD*, `FINISHED_WITH_ERROR`, contract state unchanged.
4. **35–55 s.** In **1 · Submit evidence**, click the **Suspended · HLUSD** fixture (or paste any live HTTPS URL), then **Run consensus assessment**. Validators fetch the page and agree, which takes about 1–2 minutes. The result card shows status, reasoning, reason codes, evidence links, tx id, lifecycle, execution result, validator votes, and a state check.
5. **55–60 s.** Choose **NWUSD** and request exposure: *Exposure recorded*, and the count increases.

## Honest limitations

- **Studio Next is a release-candidate network and may reset.** If it does, the contract address and proof links above stop resolving. See the reset steps below.
- **Synthetic assets and fixtures.** NWUSD and HLUSD are fictional, and their "issuer domain" is the app's own domain, where the three labeled fixtures live. Live URLs are accepted, but evidence about any other asset is correctly judged `INSUFFICIENT_EVIDENCE` because it cannot be tied to these assets.
- **Open assessment.** Anyone can trigger `assess_asset`, so a caller could submit only a favorable authoritative page and omit a newer suspension notice. The authoritative-domain rule, staleness window, and the requirement that validators re-read what is cited limit this, but a production version should gate who can assess, require a minimum source set, or add an appeal/dispute window.
- **Domain-based authority.** Authority means a registered issuer hostname. It does not verify signatures, and a compromised issuer site would be trusted.
- **LLM variance.** Borderline evidence can split validators. The design fails closed (no status recorded, gate unchanged), but it can cost a retry.
- **UI results appear at "decided".** The dashboard shows results at `ACCEPTED` for responsiveness, labels them "not final", and confirms them through state reads. The explorer shows the eventual `FINALIZED`.
- **Rate limits.** Studio Next allows about 30 RPC requests per minute per client. The app throttles and retries, but a reviewer with several tabs open may briefly see a "retrying" notice.
- **Tooling defects worked around:** `genlayer-test 0.30.0rc2` direct mode has a Windows temp-file bug and pre-parses mocked LLM JSON. Both have small shims in `tests/direct/conftest.py`. Studio Next doesn't serve `gen_dbg_traceTransaction`, so revert reasons are decoded from the leader receipt.

## Studio Next reset instructions

```bash
npm ci
```

```bash
npm run deploy:demo
```

This verifies chain 61997 and the public fixtures, creates and funds a local Studio-Next-only key if needed (never printed; `.env` is gitignored), deploys, registers both assets, runs the three proof flows, and writes `deployments/*.json` plus `frontend/lib/*.generated.json`. Then redeploy the frontend so it reads the new address:

```bash
cd frontend && vercel deploy --prod
```

Optional checks: `npm run test:studio` (full-consensus smoke test) and `npm run test:ui` (browser E2E; needs a local `next start` on port 3217).
