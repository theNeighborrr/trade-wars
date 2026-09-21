# Trade Wars

**v0.7 · Build 17 — Global Leaderboards**

Play: https://theneighborrr.github.io/trade-wars/

The game remains a single-player, mobile/desktop simulation. All news, prices,
customers and contract effects are fictional. Playing does not require an account,
email, payment or network connection to Supabase. The optional shared leaderboard
uses authenticated guest profiles and a deployed replay-validation service.
The prior Trading Houses feature documentation is in [README-v06.md](README-v06.md).

## Real-player leaderboards

Open **Leaderboard** from Markets, or **View leaderboard** from Command.
At campaign close, **Submit to leaderboard** opens a publication preview.

- Reading a board needs no login. Simply loading or playing the game makes no
  leaderboard request and does not create a guest identity.
- Choose a public nickname to create a Supabase Auth guest profile. No email or
  password. Its tokens stay in this browser, separate from campaign exports.
- A checkbox and explicit submit button authorize publication. Public fields:
  nickname, company, final net worth, return, deliveries/trades, submission time.
  Game decisions and accounting checks go privately to the score validator, not
  into a publicly readable database table.
- The server starts a fresh pinned-rules game, replays legal decisions and
  calculates the score. Claimed balances, payouts, costs and prices are not
  accepted as authoritative. A mismatching final result is rejected.
- Daily boards use the exact UTC edition, Independent / $50,000 / New York.
  Free-scenario boards are separated by seed, specialty and rules version.
- Replays are welcome. Keep one best result per guest and board, not a list of
  duplicate entries. Equal scores in cents share a rank. Top 50 plus your own
  position and the gap to the next higher score are shown.
- Existing complete v0.6 journals can be submitted after replay validation.
  The proof builder reconstructs quiet advances from journal days; travel
  already consumes a day and automatic forfeits are recalculated. Sparse or
  preserved older-rule campaigns cannot be ranked but remain playable.
- Change your nickname or remove your visible scores from the leaderboard UI.
  Removing scores does not reset the game or discard the local guest identity.
- No fake participants or seed scores. Empty boards invite the first submission.

**Replay-validated is not cheat-proof.** It establishes an achievable legal run,
not that a human played it without bots, advance seed knowledge or outside help.
Guest profiles are not verified real-world identities. A person can create more
than one guest, and losing browser data can lose access to a previous profile.
There is no first-attempt-only competitive claim, cloud game sync, or cross-device
account recovery in this release. Local challenge-share text remains self-reported;
only results accepted by the server receive the replay-validated board label.

## Architecture and permission boundaries

The static game remains on GitHub Pages. Supabase project `trade-wars` provides
Auth, PostgreSQL and one Edge Function, `trade-wars-leaderboard`.

`v07-online.js` contains ONLY the project URL and publishable key. Privileged
credentials are supplied by Supabase's server environment and never committed
or sent to a browser. The function intentionally has `verify_jwt=false` because
GET is public. Every POST authenticates the bearer token against Auth `/user`;
it never trusts decoded claims or a client-supplied user ID. Optional authenticated
GET requests use the same verification before identifying your rank.

All three tables have RLS enabled, explicit deny policies for client roles, and
revoked anon/authenticated privileges. RPC execution is service-role-only.
The function exposes only the selected public ranking fields. It does not expose
raw auth IDs, tokens or replay logs. Moderation and test flags cannot be set by
a player. Database requests and submission updates are server-only.

Limits: 192 KiB JSON requests, at most 1,200 replay decisions, and 10 authenticated
write requests per minute / 60 per UTC day per guest. Profile updates and rejected
submissions count. Auth additionally has its own signup limits. These are starter
playtest safeguards, not protection against coordinated multi-account abuse.
Before a broad public launch, configure CAPTCHA for anonymous signup; connect the
provider's site key to the guest creation flow. Do not disable signup protections
or expose a service-role key to work around throttling.

CORS allows public browser readers; bearer tokens, not CORS, authorize writes.
Network outages display an error and never change campaign state. The optional
leaderboard module is loaded after core/theme initialization, isolated from it.

## Rules and save compatibility

The public app version is 0.7, but its unchanged economic rules remain **0.6.0**.
The game engine, seed generation, scoring and save keys are not changed. A full
0.6 run can be continued and submitted; migrated old-rule runs stay unranked.

The validator's `rules.js` imports immutable source at Git commit
`b0baa09cb21ad8c5a12292258078ff06bea5de5e`, never `main`. Supabase resolves and
bundles that graph during deployment. `rules-manifest.json` fingerprints the
original files. Future economic releases need their own validator and board;
do not silently replace the rules underneath an existing competition.

## Owner moderation

In the Supabase Table Editor (owner/admin access only):

- Set `tw_scores.hidden=true` to withhold an abusive entry. Submitting a better
  result cannot unhide it. Keep the row as a moderation tombstone.
- Set `tw_players.blocked=true` to hide that player's entries and block writes.
- `is_test` excludes a private verification profile from every public rank. No
  verification accounts or results remain in the deployed launch database.

Remove visible scores through the app while signed in as their owner. Owner-
moderated entries remain withheld. For a lost guest or broader deletion request,
the database owner must assist; no recovery email was collected.

## Run and test

Run `python -m http.server 8080` here; ES modules require HTTP, not file://.

`npm test` runs the 63 retained engine tests and 11 replay/protocol tests. The
Node test resolver maps only the pinned HTTPS rules import to matching local
source; it checks SHA-256 before loading it. It does not fetch arbitrary code.
Replay tests include 36 mixed campaigns across specialties, upgrades, deliveries,
travel, expiry, cancellation, closure, tampered summaries and invalid decisions.

Optional Chromium tests (requires Python Playwright + Chromium):

```
python tests/test_v06_browser.py --report base-browser-report.json
python tests/test_leaderboard_browser.py
```

The leaderboard test mocks HTTPS responses to exercise guest/consent/submission,
rank display, deletion confirmation, offline handling, token refresh and modal
focus without creating public test scores. It checks 13 themes, five widths and
four leaderboard states. The retained base test covers 988 view/theme/width cases.
These use native Chromium DOM/CSS/modules and emulated localStorage, not a
physical Safari/iPhone or native-origin storage test.

Live backend verification separately confirmed anonymous sign-in, public reads,
an authenticated full replay submission and its calculated score, private QA
exclusion from rankings, and revoked client read/write/RPC grants. QA data,
credentials and the temporary HTTP test extension were removed afterward.
A combined remote negative-test request was blocked by the tool's safety checks;
remote rejection/duplicate cases were not completed. Invalid replay cases were
exercised locally. Do not describe those unperformed remote checks as passed.

Supabase's advisor may flag leaked-password protection on the project's unused
email/password provider. This client uses anonymous sign-in; before enabling
password accounts review https://supabase.com/docs/guides/auth/password-security.
