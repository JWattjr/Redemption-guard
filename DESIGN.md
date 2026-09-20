---
name: Redemption Guard
description: A public service board for money — posted status, read across a concourse.
colors:
  enamel: "#0e1622"
  chassis: "#18212f"
  chassis-2: "#1f2a3a"
  board: "#0a111a"
  rule: "#2b3646"
  rule-soft: "#212c3b"
  ink: "#eef2f7"
  ink-2: "#b6c2d2"
  ink-3: "#8a97a9"
  sodium: "#f0a93b"
  sodium-lit: "#ffbe55"
  sodium-dim: "#7a5a26"
  signal-go: "#35c77a"
  signal-stop: "#ff6f56"
  signal-hold: "#f0a93b"
  idle: "#7c8799"
  go-ground: "#102a1f"
  stop-ground: "#2d1712"
  hold-ground: "#2a1f0e"
  idle-ground: "#1b2534"
  link: "#7fb2ff"
  focus: "#f0a93b"
  board-ink: "#eef2f7"
  board-ink-2: "#b6c2d2"
  board-ink-3: "#8a97a9"
  board-rule: "#2b3646"
  board-row-selected: "#16243a"
  board-flap-face: "#060c14"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0.05em"
  headline:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  subtitle:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-small:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.16em"
  strip:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.12em"
  mono:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
    fontFeature: "tabular-nums"
rounded:
  none: "0px"
spacing:
  hair: "4px"
  tight: "8px"
  snug: "12px"
  base: "16px"
  panel: "18px"
  gap: "26px"
  shell: "28px"
components:
  button:
    backgroundColor: "{colors.chassis-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "42px"
  button-primary:
    backgroundColor: "{colors.sodium}"
    textColor: "{colors.board}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.sodium-lit}"
    textColor: "{colors.board}"
  button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
  posted-eligible:
    backgroundColor: "{colors.go-ground}"
    textColor: "{colors.signal-go}"
    typography: "{typography.strip}"
    rounded: "{rounded.none}"
    padding: "4px 9px"
  posted-restricted:
    backgroundColor: "{colors.stop-ground}"
    textColor: "{colors.signal-stop}"
    typography: "{typography.strip}"
    rounded: "{rounded.none}"
    padding: "4px 9px"
  posted-insufficient:
    backgroundColor: "{colors.hold-ground}"
    textColor: "{colors.signal-hold}"
    typography: "{typography.strip}"
    rounded: "{rounded.none}"
    padding: "4px 9px"
  posted-none:
    backgroundColor: "{colors.idle-ground}"
    textColor: "{colors.idle}"
    typography: "{typography.strip}"
    rounded: "{rounded.none}"
    padding: "4px 9px"
  panel:
    backgroundColor: "{colors.chassis}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "18px"
  board-row:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.none}"
    padding: "16px"
  gate-flap:
    backgroundColor: "{colors.board-flap-face}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "40px"
    width: "148px"
  input:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.none}"
    padding: "10px 12px"
    height: "44px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
    padding: "0 11px"
    height: "38px"
  picker-item:
    backgroundColor: "{colors.chassis-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    padding: "0 13px"
    height: "38px"
  picker-item-active:
    backgroundColor: "{colors.sodium}"
    textColor: "{colors.board}"
  stencil:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    typography: "{typography.label}"
---

# Design System: Redemption Guard

## Overview

**Creative North Star: "The Concourse Status Board"**

This is a public service board for money. The ground is enamel midnight, the panels are steel chassis, and the one object that matters — the board — is a recessed matte plane carrying one dense row per asset. A reader standing back from the screen should get the answer before they get the interface: which asset is boarding, which is held. Everything else on the page stays small, even, and subordinate.

There is one committed ground. `color-scheme: dark` is unconditional and there is no light ambient: a service board is dark in any hall. Anything mounted on the board carries its own board-fixed inks (the `board-*` tokens) so it never follows the surrounding surface — which is why the row, the gate cell, the policy plaque and the evidence inputs read identically wherever they sit.

The world is cool and serious, never cute. It refuses rounded status cards on a pale ground, and it refuses pixel or bitmap lettering outright; the signage voice is Barlow Condensed 700 tracked caps, the condensed grotesque real flap boards use. Colour never carries meaning alone: every status reads as a verbatim contract word, an authored icon, and a line form.

**Key Characteristics:**
- Enamel-midnight ground, steel chassis panels, one recessed matte board
- Square corners (0px radius), 1px hairline rules, no gradients, no glow
- Sodium amber as the single accent; three signal hues reserved for state
- Condensed 700 tracked caps for board display lettering; mono for hashes, amounts, addresses
- Status carried three ways: word, icon, line form
- Motion limited to the split-flap throw and one busy spinner, both inside `prefers-reduced-motion: no-preference`

## Colors

A cold midnight palette lit by one sodium lamp, with three signal hues that appear only as posted state.

### Primary
- **Sodium Amber** (`colors.sodium`): the single accent. Board display glyphs (tickers, gate labels, step numerals), the primary action fill, station top rules, the focus ring, list markers, text selection. **Lit Sodium** (`colors.sodium-lit`) is its hover-only brightening; **Dim Sodium** (`colors.sodium-dim`) is the unlit reserve.

### Secondary
- **Signal Green** (`colors.signal-go`): ELIGIBLE only — posted badge ink, row lamp, gate-open lettering, recorded proof legs.
- **Signal Red** (`colors.signal-stop`): RESTRICTED, contract reverts, field errors, gate-closed lettering.
- **Signal Hold** (`colors.signal-hold`): INSUFFICIENT_EVIDENCE, cooldown notices, warning alerts. It shares sodium's value deliberately: hold is the unresolved state, lit by the same lamp.
- **Idle Grey** (`colors.idle`): nothing posted yet.

Each signal pairs with its own near-black ground (`go-ground`, `stop-ground`, `hold-ground`, `idle-ground`), never a pastel tint.

### Tertiary
- **Link Blue** (`colors.link`): hyperlinks only, the one hue outside the signal set.

### Neutral
- **Enamel Midnight** (`colors.enamel`): page ground and the document theme colour.
- **Steel Chassis** (`colors.chassis`): panels, plates, board frame, header badges. **Chassis Raised** (`colors.chassis-2`) is the default control fill.
- **Matte Board** (`colors.board`): the recessed plane — rows, inputs, gate check, policy plaque, step numerals.
- **Rule** and **Soft Rule** (`colors.rule`, `colors.rule-soft`): 1px hairlines; soft for internal list dividers.
- **Enamel White → Dim → Faint** (`colors.ink`, `colors.ink-2`, `colors.ink-3`): the three-step text ramp, mirrored board-side by `board-ink`, `board-ink-2`, `board-ink-3`.

### Named Rules
**The One Lamp Rule.** Sodium amber is the only accent. If a surface needs a second accent, it needs less content, not another hue.

**The Board-Fixed Ink Rule.** Anything mounted on the matte board uses the `board-*` tokens, never the page inks. The board does not follow the surface around it.

**The Three-Way Status Rule.** A status is never carried by colour alone. It reads as the verbatim contract token (ELIGIBLE / RESTRICTED / INSUFFICIENT_EVIDENCE), an authored icon, and a line form — solid bar for ELIGIBLE, dashed for INSUFFICIENT_EVIDENCE, hatched-struck for RESTRICTED. All three survive greyscale.

## Typography

**Display Font:** Barlow Condensed 700, tracked caps — the board's own lettering
**Body Font:** Barlow 400/500/600
**Label/Mono Font:** Spline Sans Mono for hashes, amounts, addresses, reason codes

**Character:** A signage grotesque over a plain working sans. The condensed 700 caps are loud only where the board speaks; everywhere else the type is small, even, and quiet, so the board keeps the room.

### Hierarchy
- **Display** (700, 40px/0.95, +0.05em): the asset ticker on a board row; 34px below 720px. Nothing else uses this size.
- **Headline** (700, 30px/1, +0.06em, uppercase): the service name. Its 24px cut carries gate-check labels and proof tickers, its 19px cut the station numerals, its 17px cut (+0.14em) the split-flap lettering.
- **Title** (600, 20px): the board's section heading. **Subtitle** (600, 16px): station and plate headings.
- **Body** (400, 15px/1.55): prose. Lede paragraphs run 14px capped at 68ch; long reasoning blocks cap at 78ch.
- **Label** (600, 11px, +0.14–0.16em, uppercase): stencil IDs, definition terms, field labels, column headers. **Strip** (500, 12–12.5px, +0.10–0.14em, uppercase): issuer lines, posted badges, network badge, domain marks.
- **Mono** (400–500, 12–13px, tabular figures): hashes, addresses, amounts, reason codes, posted timestamps, the asset picker.

### Named Rules
**The No Bitmap Rule.** No pixel, bitmap, or decorative display face, ever. The signage voice is condensed grotesque caps; a pixel face was built once and removed on sight.

**The Tracked Caps Rule.** Uppercase is always tracked (+0.05em minimum, +0.16em for the smallest stencil labels) and always condensed or strip weight. Untracked uppercase does not exist here.

**The Figures Rule.** Any number that can change — amounts, exposure units, timestamps, IDs — is set in mono with tabular figures so it does not shift between reads.

## Layout

A centred shell at 1280px maximum with 28px side padding (16px below 720px). The page is a two-column grid: main column plus a fixed 340px rail, 28px gutter, each column stacking its contents at 26px.

The main column reads top to bottom as one service: the board, then the two stations side by side below it (22px gutter). The stations are tied to the board by a **service route** — a 1px horizontal rule spanning the inner half of the station row, with 26px vertical drops into the board above and each station below. Every segment is orthogonal.

A board row is a four-column grid (asset, status, gate, data) at 12px/18px gaps and 16px padding, with a notes band spanning full width above a 1px board rule.

Spacing rhythm is a small even set — 4, 8, 12, 16, 18, 26, 28px — with 6/7/9/10/14 for tight inline gaps inside components. Controls hold a 38–44px height band; touch targets rise to 44px below 720px.

Two breakpoints. At 1120px the rail drops under the main column and re-forms as two columns, the board's column headers hide, and rows collapse to two columns with the data strip spanning full width. At 720px everything is single column, the service header stacks left-aligned, footer actions go full width, and the ticker steps down.

## Elevation & Depth

Flat by commitment. No drop shadows, no glows, no gradients, no block or offset shadows anywhere in the resting system. Depth is tonal and structural: the enamel ground sits behind steel chassis panels, which frame a darker recessed board, which in turn holds the near-black flap face. Four tonal planes, each separated by a 1px hairline rule, do all the work a shadow would.

The one inset usage is structural rather than atmospheric: a selected board row draws a 1px inset ring in the board rule colour. That is a hairline, not a lift.

### Named Rules
**The Tonal Plane Rule.** New surfaces gain depth by stepping to the next tonal ground (enamel → chassis → board → flap face) and adding a 1px rule. Never by adding a shadow.

## Shapes

Square. No element in the system declares a border radius; corners are 0px and the ceiling for any future exception is 4px. Every boundary is a 1px hairline in `rule` (or `board-rule` on the board); the only heavier strokes are the 2px sodium top rule that marks a station and the 2px status-coloured top rule on an outcome panel.

The form vocabulary is rectangular throughout: square status lamps and LEDs (7–8px), square step numerals and outcome glyphs (30×30), rectangular flap cells, rectangular badges. Disabled controls switch their hairline to dashed rather than losing it. Icons are authored 16px SVG on a single 1.7px stroke weight, always shipped beside a text label — no glyph font, no icon package.

## Components

### Buttons
- **Shape:** square (0px), 1px hairline, 42px tall, 16px side padding, Barlow 600/13px.
- **Primary:** sodium fill with board-dark text; hover brightens to lit sodium. **Warn:** hold fill, same treatment.
- **Hover / Focus:** default buttons shift their border to sodium on hover and press 1px down on active; focus is the global 2px sodium outline at 3px offset.
- **Secondary / Ghost / Disabled:** raised chassis fill for default; transparent for ghost, with a 42px square icon-only variant; disabled goes transparent with faint ink and a dashed border. On the board, buttons re-ink to the board set and hover to hold amber.

### Chips
- **Style:** transparent, 1px hairline, 38px tall, with an 8px square LED at the left in the signal colour for its state (operational / suspended / unclear) and a faint asset label.
- **State:** hover lifts text to full ink and the border to sodium.

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** chassis for panels, plates and the board frame; matte board for anything recessed.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Border:** 1px rule; a station panel adds a 2px sodium top rule, a proof panel a 2px neutral one.
- **Internal Padding:** 18px panels and board, 16px plates and rows, 14px recessed blocks.

### Inputs / Fields
- **Style:** matte board fill, board hairline, 44px minimum height, 13.5px text, amber caret, faint placeholder.
- **Focus:** 2px sodium outline at 2px offset plus a sodium border; segmented controls inset their outline by 4px.
- **Error / Disabled:** border switches to signal red with a 12.5px red message under the field, full width in the grid.

### Navigation
There is no site navigation. Wayfinding is signage: a tracked-caps service header (mark, service name, subtitle) on the left, network badge and wallet state on the right, above a 1px rule. Station identity is carried by a numbered square (700/19px on the matte board) plus a stencil ID strip in the panel head.

### The Split-Flap Gate Cell
The signature component. A 148×40px cell on a near-black face with a board hairline and a 1px dark seam across its centre line, holding 700/17px tracked caps reading GATE OPEN (signal green) or GATE CLOSED (signal red). An absolutely positioned leaf hinged at its top edge rotates from 0 to -92 degrees over 260ms on a decelerating curve.

The leaf is keyed on gate state, so the throw replays **only when the gate actually changes** — not on every render, poll, or re-fetch. A board that flaps at rest is a broken board.

### The State Bar
A 48×10 line form printed beside every posted status: a solid bar for ELIGIBLE, four dashes for INSUFFICIENT_EVIDENCE, a dimmed bar struck by six vertical hatches for RESTRICTED, and a thin half-opacity line when nothing is posted. It scales to 132px on a board row, 80px on a proof, 46px in the activity log.

## Do's and Don'ts

### Do:
- **Do** keep the ground dark; `color-scheme: dark` is unconditional and there is no light ambient to design for.
- **Do** mount board content on the `board-*` ink and rule tokens so it stays legible regardless of surrounding surface.
- **Do** carry every status three ways — verbatim contract word, authored icon, and state-bar line form.
- **Do** set every hairline at 1px `rule`, reserving 2px strokes for the sodium station rule and the status-coloured outcome rule.
- **Do** keep uppercase tracked and condensed (+0.05em to +0.16em) and set changing numbers in mono with tabular figures.
- **Do** step tonal planes (enamel → chassis → board → flap face) to build depth.
- **Do** keep the service route orthogonal: 1px, 45/90 degrees, no curves or elbows.
- **Do** gate every animation inside `prefers-reduced-motion: no-preference` and key replayed motion on real state change.

### Don't:
- **Don't** add drop shadows, glows, or gradients; depth is tonal planes plus hairlines.
- **Don't** round a corner past 4px, and prefer 0px — the system declares no radius at all today.
- **Don't** use a pixel, bitmap, or decorative display face; the board speaks in condensed grotesque caps.
- **Don't** introduce a second accent hue. Sodium amber is the lamp; green, red, hold and idle are state, not decoration.
- **Don't** use pastel fills or tinted washes behind a status; each signal has its own near-black ground.
- **Don't** animate anything but the flap throw and the busy spinner, and never replay the flap on a re-render.
- **Don't** ship an icon from a font or package; icons are authored 16px SVG on a 1.7px stroke and always accompany a label.
- **Don't** let a second element compete with the board for the first viewport; everything else stays small and even.
