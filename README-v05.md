# Trade Wars

**Current release: v0.5 · Build 15 — Trader's Toolkit & Supply Chains**

A responsive, single-player global trading game. All news, commodity prices,
policy actions, contracts and supply-chain effects are authored simulations,
not live reporting, forecasts or investment guidance. Runtime is plain HTML,
CSS and JavaScript. No service or API keys are needed.

## Play and run

Live: https://theneighborrr.github.io/trade-wars/

For local development run `python -m http.server 8080` from this directory and
open http://localhost:8080. Use an HTTP server rather than opening index.html
with file://; the application uses native ES modules.

## v0.5 features

- Exact whole-lot quantity entry, smart-stop slider, and separate Buy Max / Sell
  All sizing controls. Sizing does not execute a trade. Buy stays above Sell.
- Live previews: cash after purchase, weighted new average cost, proceeds,
  remaining inventory and realized sale P/L. Receipts and full activity journal;
  CSV journal export and JSON campaign export.
- All markets / My holdings filter. Price history from the start of the recorded
  run, a current average-buy line, local/global series toggle and daily values.
  Local movement compares the same hub across consecutive sessions; travel is
  not mislabeled as a global price move.
- Expandable Solar / Grid Infrastructure: Modules, Inverters, Transformers,
  Battery Cells. The parent is a non-tradable equal-weight, base-100 global
  reference index. Inverter / transformer costs incorporate prior-session input
  movements; coefficients are game rules, not empirical economic estimates.
- Seeded multi-day conditions: developing, active, easing, resolved. Some
  proposed events are averted. Condition premiums build and unwind instead of
  adding the full headline shock every day. Politics is modeled as specific
  fictional policy actions, not a rating of candidates or parties.
- Optional delivery contracts (up to 3 active). Requirements, destination,
  deadline, fixed payout and refundable performance bond are disclosed before
  acceptance. Bonds remain assets while held, are returned on delivery and are
  forfeited on cancellation, missed deadline, or closing with unfinished work.
  Goods are consumed only on delivery. Deadlines include that day's session.
- Day 30 remains tradable. Close Campaign explicitly ends it; unsold inventory
  is marked at the final hub quote, not booked as a realized sale. The scorecard
  separates realized trades/deliveries, unsold inventory, travel, and forfeits.
  Earned run labels, best/worst recorded sales, personal-best history and replay.
- Same seed + rules version = same world on the same day, even when choices of
  trades, views or travel differ. New runs accept a seed; replay resets to Day 1.
- Terminal: keyboard navigation (C/M/I/P), N for next day, J journal, ? help, and
  expandable transaction tape. Shortcuts are ignored in fields and dialogs;
  none executes a trade. Situation Room: clickable schematic hub/route map,
  destination quotes and travel. Newspaper: daily front page with mark changes
  for inventory carried into that session. The journal, routes and briefing
  facts remain available to every theme; no theme has an economic advantage.
- Preserves the Build 14 content-width responsive layout, stacked actions,
  13 themes, mobile hub sheet, sticky HUD, sidebar balances, and position return.

## Saves, replay and honest statistics

The active v0.5 key is `trade-wars-campaign-v5`. Existing v0.4 campaigns under
`trade-wars-prototype-v2` migrate once, preserving cash, quantities, average
costs, current hub/day and existing-asset quotes. The original key is unchanged.
New markets start unowned. Earlier individual trades and hub price histories
were never recorded; the new journal/history begin on the upgrade day instead
of inventing them. Continued v0.4 runs are excluded from v0.5 personal-best
comparisons and cannot reproduce the old random world through seeded replay.

Starting or replaying a run saves the outgoing v0.5 campaign under
`trade-wars-campaign-v5-previous`. Corrupt saves are retained as backups where
storage permits. Storage failures display a warning; export the campaign before
closing. Saves and records are device/browser-local, not cloud-synced.

## Tests

Engine: `npm test` (or `node --test tests/engine-v05.test.mjs`). Covers cost basis,
input validation, preview consistency, cash/inventory accounting, all contract
states, multi-day conditions, deterministic replay across decisions, Day 30,
record keeping, legacy preservation and storage failures.

Optional browser dependencies:

```
python -m pip install playwright
python -m playwright install chromium
python tests/test_v05_browser.py
python tests/test_v05_features.py
```

Set `CHROMIUM_EXECUTABLE` when using a system Chromium. The browser tests use
`tests/offline_browser.py`: real Chromium DOM/CSS/ES modules, resource URLs
rewritten to blobs and emulated WebStorage. Build 15's matrix checks 19 viewport
widths (320–1920px), all 13 themes and all 4 views, expanded equipment/contracts,
slider endpoints/midpoint, dialogs and containment; user flows run at 390, 700,
1024 and 1640px. Extended checks exercise clickable routes, newspaper attribution,
price history, seed entry and restored interface state.

These are not physical iPhone/Safari tests. Network navigation is blocked in the
execution environment used for this release, so native-origin browser storage,
live HTTP loading and native CSV/JSON downloads were not end-to-end verified
there. Storage logic is unit-tested; restored state is browser-tested in the
fixture. `tests/test_market_layout.py` is the archived Build 14 harness; use the
v0.5 commands above for this release.

## Layout and code ownership

`market-layout.css` owns board responsiveness with container queries and a safe
compact fallback. The inactive `mobile-vertical.css` / `build13-market.css` files
remain historical, not loaded patches. `v05-desk.css` only adds feature layout.

`v02-main.js` is the retained boot shell. It now loads `v05-ui.js` and `v05-desk.js`
against `v05-engine.js` / `v05-data.js`. v0.2 data supplies the unchanged original
asset and hub definitions. Old engine/UI files are retained but not booted.
Public version/build is in `release.js`; internal resource URLs use `?cache=`.
Keep dependent import versions synchronized when changing files in a release.
