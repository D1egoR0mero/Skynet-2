# ADR-0002: Apply include/exclude keyword filtering client-side over title and company

- **Status:** Proposed
- **Date:** 2026-11-04
- **Deciders:** Team lead, Frontend/UX owner, QA/test owner, Requirements analyst

## Context

The Skynet Internship Finder web app must gain include (AND) and exclude (OR) keyword filtering in its filter bar, alongside the existing free-text search, Location, Opportunity type, Posted-since, and Saved-view controls. This record fixes the single decision of *where and how* that matching is evaluated.

Facts that shape the decision:

- The browser holds every listing in memory. `public/app.js` loads the full payload from `GET /api/listings` into a module-scope array and paginates client-side (`page`, `size = 12`). The cache currently holds roughly 4,800 listings, and a refresh is required to change what is in memory.
- Filtering already happens in the browser inside `render()`. It builds a lowercased `searchable` string from title, company, tags, and terms for the free-text search box, then applies the remaining predicates in sequence, sorts newest-first, clamps `page`, updates the counters and pagination controls, and renders cards or the existing zero-result `.empty` state.
- Re-filtering happens on every keystroke: each filter input has an `input` listener that resets `page = 0` and calls `render()`. The Clear filters button clears a fixed list of control ids. Any new control must join both lists or it will behave inconsistently with its neighbours.
- The cache payload is static between refreshes, and a cached `GET /api/listings` must return an identical JSON body — the PM2.1 integration test asserts `updatedAt` is unchanged across consecutive GETs. The API contract is therefore not free to vary per request.
- `public/app.js` is served directly to the browser with no bundler, and `server.js` exposes only `index.html`, `app.js`, and `style.css` as static files. Node modules under `src/` are not reachable from the page without changing that file map.
- The semantics are already fixed by `README.md` (worked Disney examples): comma-separated, case-insensitive, whitespace-trimmed literal substrings; include terms must all match (AND); exclude terms must match none (OR).
- The terminal CLI implements equivalent semantics separately in `src/filters.js` (`applyPlusMinusFilter` delegating to `applyKeywordFilter`). It matches against a `tags` field that `src/sources/simplify.js` defines as the lowercased "title company" string, so its effective field scope is title and company. That file also carries a stray debug statement (`console.log(inc)`) inside `applyKeywordFilter`. The CLI is a separate ES-module program and is out of scope for this enhancement.
- This decision is implemented on the `pm2.2-include-exclude-keywords` branch: `splitKeywords()` parses comma-separated input, `matchesKeywords()` applies AND/OR to a lowercased `title + company` string, the `#include` and `#exclude` inputs carry helper text, and both ids join the input-listener and Clear-filters lists. `test/pm22-keywords.test.js` and the DOM harness in `test/helpers/browser.js` cover the behaviour, and `npm test` runs the suite. The same branch restores the previously missing `src/sources/boards.js`, so the server can start.

Assumptions:

- Listing volume stays in the low thousands, so a linear scan per keystroke over an in-memory array remains imperceptible without indexing or debouncing machinery.
- Title and company are the fields users mean by "keywords a role must contain"; tags, terms, and location are deliberately excluded from keyword matching.
- The API, the cache file format, and the CLI contract are unchanged by this decision.

Quality attributes driving the decision: responsiveness of the filter bar under per-keystroke input, preservation of the frozen cache/API contract, maintainability of a buildless frontend, and consistency with the semantics already published in `README.md` and with the CLI's effective field scope.

## Decision

We will implement include and exclude keyword matching as two small client-side helpers in `public/app.js` — `splitKeywords()` to parse comma-separated input and `matchesKeywords()` to evaluate AND-include / OR-exclude over a lowercased `title + company` string — composed into the existing `render()` filter chain ahead of the remaining predicates. The two new inputs join the existing `input`-listener list and the Clear-filters control list so they behave exactly like the existing filters, and no server or API change is made.

The resulting chain, evaluated per keystroke against the in-memory pool:

```
listings (in memory, ~4.7k)
   |
   +--> include keywords  (new, AND: every term in title+company)
   +--> exclude keywords  (new, OR: no term in title+company)
   +--> saved mode        (existing)
   +--> free-text search  (existing, uses `searchable`)
   +--> location          (existing)
   +--> opportunity type  (existing)
   +--> posted since      (existing)
   |
   +--> sort newest-first --> clamp page --> counters/pagination --> cards
                                                              \--> .empty state
```

Keyword matching deliberately does not reuse the `searchable` string: it composes its own `title + company` text so that season metadata in `terms`, the derived `tags` field, and `location` cannot satisfy a keyword.

## Consequences

- **Positive:** No backend, API, or cache change, so the identical-payload behaviour of a cached GET and its PM2.1 test remain untouched. Feedback is immediate per keystroke with no network round trip. The feature reuses the existing filter pipeline, pagination clamping, counters, and zero-result empty state, so there is one rendering path rather than a parallel one. Field scope matches the CLI's effective scope (its `tags` is title + company) and the README examples, and the on-page helper text makes the scope visible. The behavior is covered by deterministic DOM-harness tests that need no live providers, and no dependency or build step is introduced.
- **Negative:** Filter state is not encoded in the URL, so a filtered view cannot be bookmarked or shared, and results are lost on reload. Matcher logic is duplicated between the browser and `src/filters.js`, creating two implementations of one published specification that can drift. Because keywords match only title and company, typing a visible value such as `Remote` or `Summer 2027` into Include matches nothing even though that value appears on the card; this is intentional and disclosed by the helper text, but it is a usability edge. Literal substring matching produces false positives — `intern` also matches `internal`, and short terms match inside unrelated company names — which is accepted because `README.md` specifies exact substring behaviour. Per-keystroke cost grows linearly with the listing count; at the current volume this is well within an interaction budget, but a much larger pool would force a revisit (debouncing, indexing, or moving the work server-side).
- **Follow-ups:** Complete the PM2.2 peer review and merge the branch. Consider URL-encoded filter state so filtered views are shareable in a later milestone. Reconcile the browser and CLI matchers — likely by extracting a shared module once the server's static file map or a build step makes it reachable — if the two surfaces are required to stay identical. Remove the stray debug statement in `applyKeywordFilter` if and when the CLI matcher is next touched. If the keyword field scope ever changes, update `US-002`, the helper text, and `test/pm22-keywords.test.js` together. Keep `ADR-0001` aligned with the shipped client-side architecture as the app evolves.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Server-side query parameters on `/api/listings` (e.g. include/exclude passed to the endpoint) | Would require caching the response per filter combination, expanding the API surface, and changing the payload per request — which breaks the current "a cached GET returns an identical body" guarantee and the PM2.1 test that asserts it. At this data size it also buys no measurable performance over a client-side scan, so it adds contract risk for zero benefit. |
| Reuse the existing `searchable` string (title + company + tags + terms) for keyword matching | `tags` duplicates title + company, and `terms` carries season/commitment metadata such as "Summer 2027", so a keyword would keep or remove listings for a reason the keyword field's helper text does not announce. Restricting matching to title and company keeps the visible contract honest and matches the CLI's effective scope. |
| Extract a single shared matcher module consumed by both the browser and the CLI | Not reachable today: the server serves only three static files, so a Node module under `src/` would have to be exposed or bundled first — a cost larger than the duplication it removes. Revisit if the two surfaces must remain provably identical; the near-term mitigation is a written specification plus tests on both sides. |
| Adopt a fuzzy or full-text matching library in the frontend | Contradicts the semantics already published in `README.md`, which specify case-insensitive literal substring matching with worked examples; fuzzy matching would silently change documented behaviour and return results users did not ask for. It also introduces a JavaScript dependency into an otherwise dependency-free, buildless frontend. |

## Links

- `US-002` — include/exclude keyword filtering user story: `docs/requirements/US-002-keyword-filtering.md`
- `US-001` — parent web search requirement: `docs/requirements/US-001-web-funnel-search.md`
- `ADR-0001` — web application architecture record (Accepted; corrected 2026-11-04 to describe the shipped client-side app and JSON API)
- `README.md` — feature list documenting include (AND) / exclude (OR) semantics with worked examples
- `public/app.js` — `splitKeywords()`, `matchesKeywords()`, and `render()`
- `public/index.html` — `#include`, `#exclude`, and `#keyword-help`
- `src/filters.js` — `applyPlusMinusFilter` (delegating to `applyKeywordFilter`): the CLI's parallel implementation of the same semantics
- `src/sources/simplify.js` — defines `tags` as the lowercased title + company string
- `test/pm22-keywords.test.js`, `test/helpers/browser.js` — PM2.2 keyword behaviour tests and DOM harness (on `pm2.2-include-exclude-keywords`)
- `docs/ai/PM2.2-ai-usage.md` — AI assistance disclosure for this branch (on `pm2.2-include-exclude-keywords`)
