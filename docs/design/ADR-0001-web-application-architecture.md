# ADR-0001: Serve the internship finder as a static browser client over a small Node JSON API

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Team lead, Backend/API owner, Frontend/UX owner, QA/test owner

## Context

The repository began as a terminal-only prototype. Its filter core is pure (`src/filters.js`), its source adapter documents the listing shape (`src/sources/simplify.js`), and its CLI applies one filter step at a time with undo and a zero-result guard (`src/index.js`, `src/display.js`). The product intent in `README.md` is a browser experience: students must be able to use it on phones and locked-down machines, and a filtered view must be linkable rather than trapped in a terminal.

The first draft of this record, dated 2026-10-22, proposed a server-rendered Node/Express application that replayed filter steps on the server, required at least one filter before showing results, and paginated 20 listings per page. That design was not built, and the PM2.1 implementation does not follow it. This revision records the architecture that actually shipped (commit `ed9bca4`, merged in pull request #1) and preserves the original proposal in the alternatives below.

Forces and constraints that shaped what shipped:

- **Team and schedule:** three students working part-time, one semester milestone at a time. A second toolchain or deployment target competes for the same hours.
- **Runtime:** Node.js 24 with ES modules (`"type": "module"`). The declared dependencies (`chalk`, `cli-table3`, `inquirer`) are terminal presentation libraries and contribute nothing to the browser UI.
- **Data:** public listings from two families of sources — the SimplifyJobs GitHub JSON document and company career boards (Greenhouse and Lever, configured in `job-boards.json`). No database, no accounts, no authentication.
- **Budget:** no paid hosting; the deployment target must fit a no-cost tier.
- **Interaction:** students expect filtering to update as they type, and the result pool is small enough (roughly 4,800 listings) to hold in the browser.

Quality attributes driving the decision:

| Attribute | Why it matters here |
|---|---|
| Usability for a browser-only audience | The change exists so students can use the product on any device, including phones. |
| Availability when upstream sources fail | Listing providers are outside the team's control and can fail or change shape at any time. |
| Maintainability for a three-person team | One deployable artifact and one client codebase are cheaper to understand than a rendering tier plus a separate API tier. |
| Testability | Source normalization, caching, and UI behaviour must be verifiable with fixtures, without calling live providers. |

Facts and assumptions:

- *Fact:* `server.js` uses Node's built-in `http` module; Express is not a dependency.
- *Fact:* the server exposes exactly three static assets (`index.html`, `app.js`, `style.css`) plus `GET /api/listings` and `POST /api/refresh`.
- *Fact:* the listing cache is persisted to `data/listings-cache.json`, considered fresh for 24 hours, and refreshed on demand and on a daily timer while the process runs. Cached entries carry `id`, `firstSeen`, and a `newCount` computed against the previous cache.
- *Fact:* all filtering, sorting, pagination, saved roles, and theme handling happen in `public/app.js`, which is loaded as a module script with no bundler.
- *Fact:* `public/app.js` filters 12 listings per page (the CLI uses 20; the web page does not).
- *Assumption:* traffic is a course demonstration plus classmates, so no capacity or cost claim rests on measured load.
- *Known defect:* `server.js` imports `src/sources/boards.js`, which is absent from `main`; the server cannot start and `test/pm21-sources.test.js` cannot pass until it is restored. The `pm2.2-include-exclude-keywords` branch restores that adapter.

## Decision

We will ship the finder as a single Node.js process that serves a static browser client and two JSON endpoints: the server owns fetching, normalizing, de-duplicating, and caching the listing pool, while the browser owns all filtering, sorting, pagination, saved state, and presentation.

Concretely:

- **Static client.** `server.js` serves `index.html`, `app.js`, and `style.css` from `public/` with an explicit file map. There is no framework, bundler, or client build step.
- **Listing endpoints.** `GET /api/listings` returns the cached payload (`listings`, `updatedAt`, `newCount`, `errors`), refreshing first when the cache is older than 24 hours. `POST /api/refresh` forces a refresh; other methods receive `405`, and unknown paths receive `404`. Failures return a JSON error with `502`.
- **Source assembly and cache.** The server fetches the SimplifyJobs document and the configured career boards in parallel, normalizes both to one listing shape, de-duplicates by URL (query string and trailing slash ignored, lowercased) or by company/title/location when no URL exists, preserves `firstSeen` across refreshes, and writes the merged cache to `data/listings-cache.json`. When one source fails, entries from the failed source are retained from the previous cache and the failure is reported in `errors`.
- **Browser-side filtering.** `public/app.js` filters the full in-memory array in `render()` — saved view, free-text search, location, opportunity type, and posted-since — sorts newest-first, clamps the page, updates counters and pagination, and renders cards or the empty state. Saved roles and theme live in local storage.
- **CLI retained as reference.** `src/index.js` and `src/display.js` remain as the executable specification of the funnel, undo, and zero-result behaviour, and as a parity target for tests. They are not the deployment artifact, and the web client does not import `src/filters.js`.

## Consequences

- **Positive:**
  - One deployable artifact and no client build toolchain: nothing to install, version, or debug beyond Node and the server's dependencies.
  - Same-origin requests only, so no CORS configuration, tokens, or proxy layer are needed.
  - Per-keystroke filtering happens locally against an in-memory pool, so search and filter feedback needs no network round trip.
  - Server-side ownership of the pool makes a shared cache and scheduled refresh possible, which is what keeps the page usable when one upstream source fails.
  - The page is linkable and usable on mobile browsers, which is the reason for the change.
- **Negative:**
  - Filter state is not encoded in the URL, so a filtered view cannot be bookmarked or shared and is lost on reload.
  - Filter semantics are implemented twice — in the browser and, for the CLI, in `src/filters.js` — so the two can drift; `ADR-0002` records the same tension for keywords.
  - The committed cache file is large (tens of thousands of lines) and can go stale by up to 24 hours; freshness depends on the process staying up or a refresh request arriving.
  - There is no authentication, rate limiting, or abuse protection, which is acceptable only because the data is public and read-only.
  - Browser interaction is hand-written DOM: focus handling, error display, and accessibility are manual work.
  - `main` is currently not runnable end to end because `src/sources/boards.js` is missing, and `test/pm21-sources.test.js` fails for the same reason.
- **Follow-ups:**
  - Merge the `pm2.2-include-exclude-keywords` branch to restore `src/sources/boards.js`, add `npm test` and `npm run web` scripts, and bring the PM2.2 tests with it.
  - Decide whether the listing cache belongs in version control or is generated at runtime, and document the freshness expectations for demos.
  - Consider URL-encoded filter state so filtered views are shareable.
  - Run an accessibility and usability-heuristic review of the page before the milestone demo.
  - Revisit client-side filtering if the pool grows far beyond its current size.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Server-rendered Node/Express application with server-side filter replay and 20 listings per page (the 2026-10-22 draft of this record) | Not built. The shipped interaction filters on every keystroke, so replaying a filter list per request would add a network round trip per character, and the team would have had to maintain a server rendering path alongside the client. The static client plus JSON API delivers the same user outcome with one codebase and one deployable. |
| React + Vite SPA with a JSON API | Introduces a second toolchain (bundler, client dependency tree, separate build output) and two deployable artifacts for a three-person team on a one-semester cadence, while the required interaction needs no component model. |
| Client-only SPA fetching the SimplifyJobs document directly from the browser | Makes a third-party host part of every page load: availability, response shape, and access policy become runtime failure modes, and the browser would have to fetch from another origin. It also gives up the server-side cache that lets the page survive one failed source. |
| Keeping the CLI and wrapping it, or shipping a terminal-only tool | Does not address the reason for the change: no linkable URL, no use on a phone or on a machine without Node, and no way to share a filtered view. |

## Links

- `US-001` — web search and filtering requirement: `docs/requirements/US-001-web-funnel-search.md`
- `US-002` — include/exclude keyword requirement: `docs/requirements/US-002-keyword-filtering.md`
- `ADR-0002` — keyword filter placement within this architecture: `docs/design/ADR-0002-keyword-filter-placement.md`
- `README.md` — product intent, feature list, and include/exclude semantics
- `server.js` — static file map, `GET /api/listings`, `POST /api/refresh`, cache and refresh policy
- `public/app.js` — client-side filtering, sorting, pagination, saved roles, and theme
- `src/sources/simplify.js` — GitHub source adapter and listing contract
- `src/sources/boards.js` — Greenhouse/Lever adapter; absent on `main`, restored on `pm2.2-include-exclude-keywords`
- `test/pm21-server.test.js`, `test/pm21-ui.test.js`, `test/pm21-sources.test.js` — PM2.1 regression tests
