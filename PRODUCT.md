# Redemption Guard — product truth

Derived from README.md, ARCHITECTURE.md and PORTAL_SUBMISSION.md (no invented facts).

## What it is
An authorization prototype on GenLayer Studio Next (chain 61997). It monitors two stablecoins.
Anyone submits 1–3 public HTTPS evidence URLs for an asset. GenLayer validators fetch those pages
themselves, judge them against a frozen treasury policy stored as a contract constant, and must
agree on exactly one status: ELIGIBLE, RESTRICTED, or INSUFFICIENT_EVIDENCE. The agreed status is
written on-chain. A deterministic `request_exposure` records new exposure only when the latest
status is ELIGIBLE and any recovery cooldown has elapsed; anything else reverts.

## Unique mechanism
Consensus judgment of unstructured issuer prose is the gate. The status is not decoration: it is
the only input the exposure gate reads.

## Audience and scene
Treasury and risk operators, plus GenLayer Portal reviewers. The scene is a monitoring desk:
somebody checking whether an asset is safe to touch before money moves, and being told no.

## Non-negotiable truth
- No tokens, custody, swaps, price feeds, database, accounts, or backend.
- NWUSD and HLUSD are fictional; the three evidence pages are labeled synthetic reviewer fixtures.
- The frozen policy text, legal disclosure, addresses, hashes and seeded records are verbatim and
  may not be reworded.
- Every status must read through icon and text, never colour alone.
- Studio Next is a release-candidate network and may reset.

## Constraints
Next.js 16 + React 19, no heavy UI or animation dependency, reads via an account-free client,
writes via injected EIP-1193 wallet through GenLayer Transaction Kit.

## Brand commitments
No pixel or bitmap lettering: the user removed it after seeing it rendered. Must read as cool and
serious, not cute, and must be clearly distinct from the sibling project MandateGate (warm cream
ground, pastel lavender/mint, pixel wordmark, rounded bubbly cards, star doodles).
