# Trade Wars — Presentable Prototype

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
