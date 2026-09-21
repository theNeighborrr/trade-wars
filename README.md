# Trade Wars — Presentable Prototype

**Current release: v0.4 · Build 14**

A responsive, no-build prototype for a topical global trade / markets strategy game.

## Run it

From this folder:

```bash
python -m http.server 8080
```

Then open http://localhost:8080 in a browser.

You can also open `index.html` directly, though serving it locally more closely matches deployment behavior.

## Included

- Desktop sidebar + mobile bottom navigation
- 30-day campaign loop
- Eight tradable global-market assets
- Buy/sell portfolio mechanics
- Cost basis and unrealized P/L
- Event-driven market shocks
- World Intel feed
- Responsive market terminal
- Net-worth chart
- Local save state using localStorage
- PWA manifest and icon
- Explicitly labeled simulated event feed so the prototype does not imply live news ingestion

## Production path

A real product could replace the authored `scenarioDeck` in `app.js` with a backend event service. The safest architecture is:

1. ingest verified reporting from trusted sources;
2. extract structured event facts into a neutral schema;
3. have deterministic game rules map event types/severity/regions to asset effects;
4. retain source links and publication times for the UI;
5. avoid using generative text to decide whether a political actor or election outcome is “good” or “bad.”

This prototype intentionally uses no frameworks or external packages so it is easy to inspect and hand off.

## Layout regression tests

Build 14 uses `market-layout.css` as the market layout owner. It replaces the
loaded `mobile-vertical.css` and `build13-market.css` patches. Cards adapt to the
main content width after sidebar/padding: compact below 560px, two-line from
560px, and a full table from 1080px. The compact hub picker is used through
820px viewport width; the desktop hub grid wraps instead of scrolling sideways.

Install the optional test dependencies and run:

```bash
python -m pip install playwright
python -m playwright install chromium
python tests/test_market_layout.py
```

Use `--themes terminal --layout-only` for a quick pass. Tests render the actual
HTML/CSS/ES modules offline with resource URLs rewritten to in-memory blobs.
WebStorage is emulated because the fixture uses an opaque origin. Tests cover
27 viewport widths, all 13 themes, slider endpoints/midpoint, button geometry,
buy/sell, cost basis, travel, advancing, save restoration, and sticky UI. They
are Chromium checks, not a substitute for a physical Safari/iPhone test.
