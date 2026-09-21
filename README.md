# Trade Wars

**v0.6 · Build 16 — Trading Houses**

A single-player, mobile/desktop browser game about world trade. All news, prices,
contracts, customers and policy effects are fictional game scenarios, not live
reporting or investment advice. No money, server account, or API key is involved.

Play: https://theneighborrr.github.io/trade-wars/

## This release

**Your next decisions.** The Command page has up to three prioritized known
commitments/developments. Markets has a compact expandable version. Ready
contracts, deadlines, missing goods, destination travel and a per-package cash
gap are calculated from the player's actual inventory and current quotes.
Travel uses a session. A developing event is not a guaranteed outcome. Prices
at arrival may differ. This is a commitments checklist, not an auto-trader.

**Trading houses.** Start a new run, name the company, and choose a specialty:

| Specialty | Starting cash / headquarters | Tradeoff |
| --- | --- | --- |
| Independent Trader | $50,000 / New York | Largest bankroll, no special discounts |
| Logistics Broker | $48,000 / Singapore | 25% lower travel costs; 6% higher Harborline/Atlas payouts |
| Grid Contractor | $48,500 / Houston | 25% lower contract bonds; 6% higher Meridian/Northstar payouts |

Price worlds do not change with specialty, company name, upgrades, or theme.
Specialty bonuses apply only to future offers from the named customers. Price
quotes, discounts, bonds, and payouts are explicit game rules, not real estimates.
Returns use the specialty's actual starting bankroll. Personal-best views are
separated by specialty and campaign mode (and by date for daily editions).

**Run-only upgrades.** Manage company from the company-name button, Command,
or the Markets toolbar. Each purchase requires confirmation and is an immediate,
non-refundable expense that reduces both cash and net worth. It is not a
resaleable asset and does not carry into the next run.

- Carrier Agreement: $1,500; 20% off future travel, multiplicative with specialty
  discount. Example: a Logistics Broker with the agreement pays $390 for a
  normally $650 Houston trip.
- Procurement License: $2,200; one larger package in future tender rounds,
  using an 8% higher goods-price multiplier. Existing offers do not change.
  Purchase is disabled once no future tender remains.
- Operations Desk: $1,800; four simultaneous contracts instead of three.
  Capacity is not free goods, free bonds, or guaranteed profits.

**Repeat customers.** Meridian Gridworks, Northstar Storage, Atlas Industrial,
and Harborline Logistics recur across tender rounds. On-time delivery adds a
trust point (maximum six); failure/cancellation loses one (minimum zero).
At one point, future bonds are 10% lower; at three, 20% lower. A previously
successful customer with positive trust can offer a premium two-day rush job.
Completing another job repairs trust. Displayed offer terms remain fixed;
there are never retroactive changes to signed contracts. Tenders offer at
most three jobs. A license/rush order replaces an ordinary slot, not an
unbounded list of jobs. These are entirely fictional customers.

**Daily challenge and sharing.** The UTC date and rules `0.6.0` define the edition.
All entrants start Independent, $50,000, New York, with identical market worlds
and access to upgrades. The date locks at launch, including across midnight.
Opening an invitation or reviewing a challenge does not replace a save or start
an attempt. Start requires an explicit click; an active matching run can resume.
First-attempt/replay counts are persisted on this device. Clearing/editing local
storage can change them; scores are self-reported, not server-verified or ranked
on a public leaderboard. The device supplies the UTC clock.

Share a result/checkpoint or just the challenge link. Matching free-scenario
links include seed, rules, and specialty. Native Web Share is offered when
present; copy/manual-text fallbacks remain available in restricted browsers and
Notion embeds. Nothing is posted or sent automatically. Unsupported rules,
invalid dates, unknown specialties, or malformed seeds cannot silently launch a
different scenario. Old editions use their specified date, not today's seed.

## Existing mechanics retained

All 13 interfaces, content-width responsive market cards, vertical Buy/Sell,
exact quantity entry and sizing-only Buy Max / Sell All, before-trade previews,
receipts, local/global charts, full journals, Solar/Grid markets, evolving
multi-day conditions, delivery bonds, Day 30 final trading, explicit closure,
results, replay and CSV/JSON exports remain. [v0.5 feature detail](README-v05.md).

## Save safety and compatibility

The active key is `trade-wars-campaign-v6`. New/replay actions first back up the
outgoing campaign under `trade-wars-campaign-v6-previous`; if that write fails,
the switch is blocked rather than discarding unsaved progress. Storage warnings
remain visible and the campaign can be exported as JSON. No cloud sync.

A v0.5 save under `trade-wars-campaign-v5` is copied once, not deleted/overwritten.
Its prices, original 0.5.0 world randomness, contract terms, journal, history,
cash, holdings, average costs, and day continue unchanged. Company perks and
upgrades are disabled for that preserved run: use a new v0.6 run to enable them.
It cannot produce a misleading matching v0.6 replay/challenge link and is excluded
from the new records. The original v0.5 personal-best file is also untouched.

v0.4 saves can still migrate without invented transaction history; charts/journal
start at the upgrade day. Unreadable saves are backed up and the original key is
not overwritten merely by loading the page. Earlier recorded statistics are not
reconstructed or compared as complete new-rule runs.

## Run and test

Use an HTTP server, not file://, because the app uses native ES modules:

```
python -m http.server 8080
```

Engine regressions for both old and new rules:

```
npm test
npm run test:balance
```

Optional browser regressions:

```
python -m pip install playwright
python -m playwright install chromium
python tests/test_v06_browser.py
python tests/test_v06_houses.py
```

`CHROMIUM_EXECUTABLE` can select a system Chromium. `--quick` reduces the theme
and width matrix. The browser fixture uses real Chromium DOM/CSS/ES modules
with resource URLs rewritten to blobs and emulated WebStorage. It checks all
13 themes, view widths, trading controls, company/daily/share dialogs, exact
trading, contracts, reputation, upgrades, closing, replay, restored saves,
input escaping, and the manual copy fallback.

It is not a physical iPhone/Safari test. Native-origin navigation is blocked in
the release execution environment, so live HTTP loading, native-origin storage,
OS share sheets, and native clipboard/download integrations are not verified
end-to-end there. The share API may be unavailable inside Notion; manual copy
is a deliberate fallback. URL and sharing implementation follow the platform
specifications, not a custom messaging service:
https://www.w3.org/TR/web-share/ and https://url.spec.whatwg.org/.

The balance smoke simulation compares two simple contract policies over 40 seeds
and all three specialties. It checks accounting and samples tradeoffs; it is NOT
proof of optimal strategies, equal difficulty, or perfect balance. Numbers are
tunable and matching daily setups avoid cross-specialty score comparisons.

## Ownership and release boundaries

`v06-data.js` declares company/customer/upgrade rules and invitation validation.
`v06-engine.js` owns state, accounting, world evolution, reputation and attempts.
`v06-ui.js` / `v06-desk.js` retain trading and campaign presentation;
`v06-houses.js` / `v06-houses.css` add the new interactions. `market-layout.css`
remains the single market layout owner. The retained `v02-main.js` boot shell
loads only the current UI. Public version/build is in `release.js`; internal
resource revisions use `?cache=`. Old source is retained for preservation tests.

Rival AI companies and real-news-inspired editions are not in this release.
