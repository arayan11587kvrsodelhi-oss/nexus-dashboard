# NEXUS Dashboard

A live, single-owner developer intelligence dashboard, backed by the GitHub API.

This is a personal dashboard for one GitHub account (not a multi-user product).
It renders your live profile, repositories, language breakdown, recent activity,
contribution heatmap, and analytics - all derived from real GitHub data, with
no fabricated or hardcoded placeholder statistics.

## Architecture

```
nexus-dashboard/
├── server/            Node/Express backend - proxies GitHub, holds the
│                       optional token, caches responses server-side
├── public/            Static frontend (vanilla HTML/CSS/JS - no framework)
├── tests/             Unit, integration, and frontend logic tests (Vitest)
└── .github/workflows/ CI (lint, test, build)
```

The frontend never talks to `api.github.com` directly. It calls this
project's own backend at `/api/v1/github/dashboard`, which:

- fetches your GitHub profile/repos/events server-side (optionally
  authenticated with a personal access token, kept out of the browser)
- processes the raw data into the shape the dashboard renders
- caches the result in memory for a few minutes to avoid hammering
  GitHub's API
- falls back to the last known-good cached data (flagged as stale) if a
  live fetch to GitHub fails, instead of showing a hard error

## Getting started

```bash
npm install
cp .env.example .env
# edit .env - at minimum, set GITHUB_USERNAME to your GitHub handle
npm run dev
```

Then open http://localhost:8130.

### Environment variables

See `.env.example` for the full list with descriptions. The only required
value is `GITHUB_USERNAME`. Setting `GITHUB_TOKEN` (a token with no scopes -
this app only reads public data) raises the GitHub API rate limit from
60 requests/hour to 5,000 requests/hour and is recommended for anything
beyond local development.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the server with auto-restart on file changes |
| `npm start` | Start the server (production mode) |
| `npm test` | Run the full test suite (unit + integration + frontend) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint the codebase |
| `npm run format` | Check formatting |
| `npm run format:fix` | Auto-fix formatting |
| `npm run build` | Verify static assets exist and the server boots cleanly |

## API

| Endpoint | Description |
|---|---|
| `GET /api/v1/health` | Liveness check |
| `GET /api/v1/ready` | Readiness check (config + cache status) |
| `GET /api/v1/github/dashboard` | The full processed dashboard payload |
| `GET /api/v1/github/dashboard?refresh=true` | Force a live GitHub fetch, bypassing the cache (rate-limited) |

## Known, deliberate limitations

- **PR/issue counts are labeled "(recent)"** rather than lifetime totals.
  GitHub's public Events API only exposes a rolling window of recent
  activity, not full historical counts - the dashboard is honest about
  this rather than fabricating or mislabeling the numbers.
- **Stat-card sparklines are illustrative**, not derived from real
  historical time-series data. GitHub does not expose day-by-day
  historical snapshots of repo/star/fork/follower counts. Building a
  truly live version would require this server to record its own daily
  snapshots over time - deliberately out of scope for this cleanup pass
  (see the architecture audit for details).
- **No database, authentication, or multi-user support** - this is a
  single-owner dashboard by design. See the architecture audit for what
  a multi-user version would require.

## Testing

```bash
npm test
```

- `tests/unit/` - the GitHub data-processing logic (language breakdown,
  stats, activity feed shaping), fully offline/pure.
- `tests/integration/` - the Express routes, with GitHub's API mocked
  (success, cache-hit, stale-fallback, and hard-failure paths).
- `tests/frontend/` - pure frontend utilities (`escapeHTML`, `timeAgo`,
  `formatDate`), including explicit XSS-escaping tests.

## Security

- The GitHub token (if set) never leaves the server.
- All GitHub-derived strings (repo descriptions, commit messages,
  activity titles) are HTML-escaped before being inserted into the page,
  since this content can be set by other GitHub users, not just the
  dashboard's owner.
- Security headers (CSP, etc.) are applied via `helmet`.
- Basic rate limiting is applied to the API, with stricter limits on the
  manual "force refresh" path.
