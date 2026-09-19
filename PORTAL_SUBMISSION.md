# Redemption Guard — GenLayer Portal submission

## One line

A treasury can only take new exposure to a stablecoin after independent GenLayer validators read the issuer's own redemption evidence and agree, under a frozen policy, that ordinary redemptions are working.

## Product

Redemption Guard monitors two stablecoins. Anyone can submit 1–3 HTTPS evidence URLs for an asset. GenLayer validators fetch those pages themselves, apply a frozen treasury policy, and must agree on exactly one status: `ELIGIBLE`, `RESTRICTED`, or `INSUFFICIENT_EVIDENCE`. The agreed status is written on-chain, and a deterministic `request_exposure` method records new exposure **only** when that latest status is `ELIGIBLE` and any recovery cooldown has elapsed. A new `ELIGIBLE` result after `RESTRICTED` is visible immediately but reopens the gate one hour later. Anything else, including no assessment at all, reverts.

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
| **Deterministic contract logic** | Owner-only registration of at most 2 assets with their issuer domains; validation of URLs (1–3, `https://`, ≤ 300 chars, public host, unique), amounts (positive integers), and IDs; the rule that a decisive status must cite a usable source on the registered issuer domain; persistence; the one-hour `RESTRICTED` → `ELIGIBLE` recovery cooldown; the exposure gate. |
| **External evidence** | Issuer pages over public HTTPS. Validators fetch them directly; 4xx, oversized (> 1 MB), or non-text sources are unusable, and 5xx or network errors abort the transaction as `[TRANSIENT]`. |
| **GenLayer judgment** | `gl.vm.run_nondet` leader/validator (GenVM v0.3's name for `run_nondet_unsafe`). The leader fetches and judges; each validator re-fetches, re-judges, and agrees only if its **status** matches. Prose may differ. LLM errors always disagree, forcing rotation. |

## The consequential state transition

`assess_asset` → (consensus) → `latest_assessment[asset] = id` → `request_exposure` succeeds **iff** `assessments[id].status == "ELIGIBLE"` and `gate_open_at` is not in the future, otherwise reverts `[EXPECTED] EXPOSURE_BLOCKED`.

## Live links

- App: https://redemption-guard.vercel.app
- Contract on GenLayer Studio Next (chain 61997): [`0x7D77A1742Ba479c1EEBE867CB1EAbCc1acF44231`](https://explorer-studio-dev.genlayer.com/address/0x7D77A1742Ba479c1EEBE867CB1EAbCc1acF44231)
- Deploy tx: [`0xfffd01e8…61459`](https://explorer-studio-dev.genlayer.com/tx/0xfffd01e881d5b49fb3a12c68005dc3e184ec5ce061735d0938835bff1cc61459)
- Synthetic reviewer fixtures (public HTTPS, fetched by validators):
  - Operational (NWUSD): https://redemption-guard.vercel.app/evidence/northwind-redemptions-operational.html
  - Suspended (HLUSD): https://redemption-guard.vercel.app/evidence/halcyon-redemptions-suspended.html
  - Ambiguous (HLUSD): https://redemption-guard.vercel.app/evidence/halcyon-status-unclear.html

## Three proof transactions (Studio Next, all FINALIZED, 5 initial validators each)

Produced by `npm run deploy:demo` on 2026-09-19 and re-verified from chain with `npm run verify:proof`.

| Flow | Assessment tx (status) | Exposure tx (result) |
|---|---|---|
| **1. RESTRICTED → blocked** (HLUSD, suspension notice) | [`0x3721189d…04933f`](https://explorer-studio-dev.genlayer.com/tx/0x3721189d542d0e518f8d010c0b9564439d97493bec0febd700dbdc027b04933f) — `RESTRICTED`, `REDEMPTIONS_SUSPENDED`, 3 agree / 5 | [`0xd4c00b65…4503d2`](https://explorer-studio-dev.genlayer.com/tx/0xd4c00b658764014df3cc0f81992d6e2ac6e8289ef21c4035e6e49678df4503d2) — `FINISHED_WITH_ERROR`: `[EXPECTED] EXPOSURE_BLOCKED: HLUSD latest assessment #1 is RESTRICTED` |
| **2. INSUFFICIENT_EVIDENCE → blocked** (HLUSD, ambiguous update) | [`0xe9f707ee…584be1`](https://explorer-studio-dev.genlayer.com/tx/0xe9f707ee943c63470d22a802d0259110ee7bcfa9a7e5a04efb675a0a57584be1) — `INSUFFICIENT_EVIDENCE`, `SOURCE_AMBIGUOUS` + `NO_REDEMPTION_INFORMATION`, 3 agree / 5 | [`0xd9292430…4512e`](https://explorer-studio-dev.genlayer.com/tx/0xd9292430bb74717867e1e7df5ca3c5358273f37882bd0cf139d697b75fd4512e) — `FINISHED_WITH_ERROR`: `…latest assessment #2 is INSUFFICIENT_EVIDENCE` |
| **3. ELIGIBLE → permitted** (NWUSD, operational notice) | [`0x712c3cfe…f2aa9`](https://explorer-studio-dev.genlayer.com/tx/0x712c3cfeba7ec3a81a0cc70d0f5db168cbb90464272d929479fc5b9de53f2aa9) — `ELIGIBLE`, `REDEMPTIONS_OPERATIONAL`, 3 agree / 5 | [`0xa18a7ebf…619e5`](https://explorer-studio-dev.genlayer.com/tx/0xa18a7ebf173be29cd2a8fd88899ee78cf0d2eed7beb5b636a434c8ad856191e5) — `FINISHED_WITH_RETURN`: exposure #1, 250,000 units, count 0 → 1 |

For each flow, the resulting state was read back (latest assessment status and exposure count). Full records: `deployments/demo-proof.json`.

Additional genuine transactions against the same deployment:

- **Smoke test** (`npm run test:studio`): HLUSD re-assessed → `INSUFFICIENT_EVIDENCE` #4 [`0x6e9be8a5…9e8498`](https://explorer-studio-dev.genlayer.com/tx/0x6e9be8a5e6a95834af10f8dd38ef48b3a7afcbd6069a38f1a5c9c762939e8498), then blocked exposure [`0x307eebe4…99006`](https://explorer-studio-dev.genlayer.com/tx/0x307eebe432fd36deb022572b01ada4405b2b8229d838926ac43ee85a3bf99006). Both state checks passed.
- **Browser E2E through the real UI and Transaction Kit** (`npm run test:ui`, injected throwaway wallet): blocked HLUSD request [`0x2b17a8c0…ee995`](https://explorer-studio-dev.genlayer.com/tx/0x2b17a8c007d130d23d04c82d761657009c54ffea5c6cf37d68860daf8ceee995), NWUSD assessment → `ELIGIBLE` #5 [`0xe64f92b3…c336a3`](https://explorer-studio-dev.genlayer.com/tx/0xe64f92b3ffc463bd3e6677980854542eb9dc92b18530ae476a49f0eeabc336a3), permitted 75,000-unit exposure [`0x53cf9ec6…f3b6f`](https://explorer-studio-dev.genlayer.com/tx/0x53cf9ec674986f43dfefcf3218e486479ee4e2e04eac299fb4eeb98ab47f3b6f). No page errors; all three state confirmations passed.

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
+ **Open assessment.** Anyone can trigger `assess_asset`, so a caller could submit only a favorable authoritative page and omit a newer suspension notice. The authoritative-domain rule, staleness window, independent validator re-fetch, and one-hour recovery cooldown limit instant reopening, but a production version should gate who can assess, require a minimum source set, or add an appeal/dispute window.
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
