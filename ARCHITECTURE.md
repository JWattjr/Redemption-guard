# Architecture

## The one consequential state transition

```
reviewer submits 1–3 HTTPS URLs
        │  assess_asset(asset_id, evidence_urls_json)          [anyone]
        ▼
deterministic input checks ── fail → [EXPECTED] revert, no state change
        │
        ▼  gl.vm.run_nondet(leader_fn, validator_fn)
┌──────────────────────── nondeterministic block ─────────────────────────┐
│ leader:    fetch each URL itself (gl.nondet.web.get) → strip HTML →     │
│            prompt with frozen policy + asset profile + tx date →        │
│            parse + normalize JSON → deterministic policy guard          │
│ validators: re-fetch the same URLs, re-judge independently, run the     │
│            same guard, then agree iff their STATUS == leader STATUS     │
└──────────────────────────────────────────────────────────────────────────┘
        │  agreed result only
        ▼
deterministic re-validation → append assessment → latest_assessment[asset] = id
        │
        ▼
request_exposure(asset_id, amount_units)          [anyone, fully deterministic]
   latest status == ELIGIBLE ? record exposure : revert EXPOSURE_BLOCKED
```

No storage write happens inside the nondeterministic block. The only input `request_exposure` reads is the consensus-agreed `latest_assessment`.

## Responsibility boundary

| Layer | Owns | Does not own |
|---|---|---|
| Frontend (Next.js) | Wallet connection, URL entry and client-side format hints, the Transaction Kit fee review and signing, lifecycle display, reading state back to confirm outcomes | Any judgment. It never sends a status, a summary, or page content to the contract. |
| Deterministic contract code | Owner-only registration (max 2 assets), URL, amount, and ID validation, the authoritative-domain rule, persistence, and the exposure gate | Interpreting prose |
| External evidence | Raw issuer pages served over public HTTPS | Trust. Validators fetch pages themselves, and only registered issuer domains count as authoritative. |
| GenLayer judgment (LLM + consensus) | Mapping evidence to exactly one of `ELIGIBLE`, `RESTRICTED`, or `INSUFFICIENT_EVIDENCE` under the frozen policy | Final say on authority: the deterministic guard can only downgrade a decisive status, never upgrade one |

## Consensus design

- **Mechanism:** `gl.vm.run_nondet(leader_fn, validator_fn)`. In GenVM executor v0.3 this is the renamed `run_nondet_unsafe` custom leader/validator primitive (migration guide: *old `run_nondet_unsafe` → `run_nondet`*). No `strict_eq` is used anywhere.
- **Comparison:** each validator independently re-fetches the sources, calls its own LLM, and applies the same normalization. It votes *agree* only if its **status** equals the leader's. Reasoning prose, reason codes, and supporting-URL choices can differ.
- **Not a format check:** the validator also rejects malformed leader payloads (unknown status or codes, supporting URLs not in the submission), but agreement is decided by its own independent re-judgment. The direct test `test_validator_rejects_forged_leader_payload` feeds a well-formed but wrong leader answer and expects disagreement.
- **Error classes** (prefix on `gl.vm.UserError`):

| Class | Examples | Validator rule |
|---|---|---|
| `[EXPECTED]` | invalid URLs, unknown asset, unauthorized, blocked exposure | deterministic; outside the nondet block |
| `[EXTERNAL]` | reserved for deterministic external refusals | agree only on an exact message match |
| `[TRANSIENT]` | network exception, HTTP 5xx or 429 on a source | agree if the validator is also transient; tx fails with no state change |
| `[LLM_ERROR]` | non-object output, missing or invalid status, empty reasoning (after 2 attempts) | always disagree, which forces leader rotation |

  Permanent source failures (4xx, oversize > 1 MB, non-text content, empty) are not errors. The source is marked unusable, and if no source is usable the result is deterministically `INSUFFICIENT_EVIDENCE / SOURCE_UNAVAILABLE` without calling the LLM.
- **Deterministic policy guard:** if the model says `ELIGIBLE` or `RESTRICTED` but none of its cited supporting URLs is a usable source on the asset's registered issuer domain, the status becomes `INSUFFICIENT_EVIDENCE` with `NON_AUTHORITATIVE_SOURCE`. Because this runs inside both the leader and the validators, the compared status already includes it.
- **Staleness:** the prompt carries the transaction's date (deterministic `gl.message.raw["datetime"]`, captured before the nondet block) and a 90-day window.
- **Prompt injection:** source text is fenced and labeled as data. The model is told to ignore instructions inside it, and the guard limits what a crafted page can achieve on a non-issuer domain.

## Storage

All persistent fields use GenVM storage types (`DynArray`, `TreeMap`, `u256`, `Address`). There are no Python `dict` or `list` fields and no floats.

| Field | Type | Purpose |
|---|---|---|
| `owner` | `Address` | registration authority |
| `asset_ids` | `DynArray[str]` | registration order (max 2) |
| `assets` | `TreeMap[str, str]` | JSON profile: name, issuer, authoritative domains |
| `assessments` | `DynArray[str]` | JSON assessment records; id = index + 1 |
| `latest_assessment` | `TreeMap[str, u256]` | asset → latest assessment id (the gate input) |
| `exposures` | `DynArray[str]` | JSON exposure records (amount as a decimal string) |
| `exposure_units` | `TreeMap[str, u256]` | total approved units per asset |
| `status_counts` | `TreeMap[str, u256]` | summary counters |

## Public interface

| Method | Kind | Notes |
|---|---|---|
| `register_asset(asset_id, name, issuer, authoritative_domains_json)` | write | owner only; ≤ 2 assets; unique `^[A-Z0-9]{2,12}$`; 1–3 hostnames |
| `assess_asset(asset_id, evidence_urls_json) → status` | write | 1–3 unique `https://` URLs, ≤ 300 chars, public DNS host, no userinfo |
| `request_exposure(asset_id, amount_units) → id` | write | integer 1…10^30; latest status must be `ELIGIBLE` |
| `get_dashboard(limit)` | view | everything the UI needs in one call |
| `get_policy`, `get_owner`, `get_assets`, `get_asset`, `get_assessment`, `get_latest_assessment`, `get_recent_assessments`, `get_exposure_requests`, `get_summary` | view | |

## Frontend

- Reads use an account-free `createClient({ chain: studioDevnet })`, with one `get_dashboard` call every 30 s.
- Writes use the injected EIP-1193 wallet through `createTransactionKit` and `GenLayerTransactionPanel`: fee estimate, review, sign, then tracking until *decided*.
- **Success is never inferred from lifecycle alone.** After the panel finishes, the app (1) reads the raw transaction for `txExecutionResultName`, validator votes, and the decoded revert reason, then (2) re-reads contract state to confirm that the assessment id advanced or the exposure count grew. Non-final lifecycles (`ACCEPTED`) are labeled "not final".
- The wallet is switched to or added as chain 61997 on connect. A wrong network disables writes and shows a banner. A Studio Next test-GEN faucet button covers fees.

## Testing layers

| Layer | Command | What it proves |
|---|---|---|
| Lint | `genvm-lint check contracts/redemption_guard.py` | GenVM rules, runner header, schema loads |
| Direct | `pytest tests/direct` (26 tests) | registration, limits, access control, URL validation, duplicates, source failures, malformed LLM output, all three outcomes, permitted and blocked exposure, validator agree/disagree/error paths |
| Full consensus | `npm run test:studio` | real validators fetch the public fixture and agree; blocked exposure reverts on-chain |
| Proof flows | `npm run seed` | the three required flows, read back from chain |
| Browser E2E | `npm run test:ui` | the UI → Transaction Kit → Studio Next → state confirmation, for blocked, assessment, and permitted flows |
