---
version: 1
slug: "frontend-components-dashboard-tsx"
primary_target: "frontend/components/Dashboard.tsx"
related_targets: ["frontend/components/parts.tsx","frontend/app/globals.css"]
---

Scope: the single dashboard route (`frontend/app/page.tsx` → `components/Dashboard.tsx`). Visitor mode: Operate.

Audience: treasury/risk operators and GenLayer Portal reviewers at a monitoring desk, deciding whether an asset is safe to touch and being told no. Task: read the two assets' agreed status, submit 1-3 evidence URLs for consensus, request exposure, and see the contract accept or reject it. Proof/content: live Studio Next chain state, three seeded proof transactions, the frozen policy verbatim. Constraints: statuses ELIGIBLE / RESTRICTED / INSUFFICIENT_EVIDENCE and the legal disclosure are verbatim; status must read by icon+text, never colour alone; no heavy UI or animation dependency; the browser E2E drives `.asset__ticker`, `.netbadge--ok`, `.faucet`, the `#assess-title` / `#exposure-title` sections, radios named NWUSD/HLUSD, `section.outcome`, `#outcome-title`, `dialog.txdialog`, and buttons named Connect wallet / Run consensus assessment / Request exposure / Close.

## Direction contract

THESIS: A public service board for money. One asset, one row, one status, readable across a concourse - the surface owns *posted status*, not a dashboard of cards. It refuses the category default of rounded status cards on a pale ground, and it refuses the cute pixel-game reading the incumbent build drifted into.

OWN-WORLD: Enamel midnight ground (#0e1622) with steel chassis panels (#18212f) and hairline rules; a recessed matte board (#0a111a); sodium amber (#f0a93b) for board glyphs, signal green (#35c77a) for ELIGIBLE, signal red (#ff6f56) for RESTRICTED, amber for INSUFFICIENT_EVIDENCE; enamel white (#eef2f7) type. Barlow Condensed 700 tracked caps as the board's display lettering (tickers, gate cells, step numerals) and 500/600 for strip labels - the condensed grotesque real flap boards use, no pixel or bitmap face; Barlow for prose; Spline Sans Mono for hashes, amounts and addresses. Square corners (<=4px), no pastel fills, no glow, no gradients. One committed ground: there is no light ambient - a service board is dark in any hall.

STORY: The operator reads the board first and knows in one glance which asset is boarding and which is held. They understand the status was posted by validators against a frozen policy, submit evidence at station 1, request exposure at station 2, and watch the contract post the result back to the board.

FIRST VIEWPORT: A full-width steel-framed status board under a tracked-caps service header (service name left, network and wallet right, a live "posted" line). Inside it, one dense row per asset: condensed ticker at 40px, issuer beneath in condensed caps, posted status as word+icon+state-bar, gate state as a flip-dot GATE OPEN / GATE CLOSED cell, then assessed time and approved exposure in mono. The frozen policy hangs beside the board as an enamel plaque. Stations 1 and 2 sit directly below the board, numbered, with the primary action bottom-right of each station.

FORM: Concourse split-flap departure board; candidate 5 of my ordered grounded list; seed key 3e224900.

RAISE (from the midnight transit diagram, competitive): service-state vocabulary rigour and 45/90-degree rule discipline - every state is a posted service word, every rule orthogonal.
RAISE (from the emission-line rail, competitive): state carried in line form, not hue - a solid bar for ELIGIBLE, dashed for INSUFFICIENT_EVIDENCE, hatched-struck for RESTRICTED, so the three statuses survive greyscale.
RAISE (from the Miura sheet, declined): aerospace spec-mono IDs - every panel carries a small stencil ID strip.
RAISE (from the calendar pad, declined): one dominant paid-for object over dense fine print - the board dominates the first viewport, everything else is small and even.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
