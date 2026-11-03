# PM2.1 automated regression coverage

Run `npm test` for the full suite or `node --test test/pm21-*.test.js` for PM2.1.
Node.js 20+ and local HTTP listening permission are required. External provider
requests are mocked; integration tests copy the app into temporary directories.

The milestone permits integration tests covering multiple functions together.
This map identifies the observable behavior that exercises each named function
in the PM2.1 web application. It does not claim exhaustive branch coverage.

| Code/functions | Tests and verified behavior |
| --- | --- |
| `server.js`: `init`, `key`, `refresh`, HTTP request callback | `pm21-server.test.js`: starts server, deduplicates provider listings by canonical URL, verifies initial counts/IDs, cached GET, forced refresh, stable firstSeen, static assets, 404/405; outage test covers persisted cache loading, stale-cache fallback and uncached 502. |
| `src/sources/simplify.js`: `fetchInternships` and normalization callbacks | `pm21-sources.test.js`: active/visible selection, normalized company/date, upstream HTTP error; server integration exercises source and cache together. |
| `src/sources/boards.js`: `fetchBoard`, `fetchBoards` and normalization/filter callbacks | `pm21-sources.test.js` and `pm21-boards.test.js`: both providers, technical internship selection, normalization/defaults/dates, co-ops, malformed payloads, HTTP/network failures and partial success. This adapter was missing from the PM2.1 commit despite imports; it is restored in PM2.2. |
| `public/app.js`: `$`, `el`, `render` and filter/card callbacks | `pm21-ui.test.js`: HTML IDs resolve, cards/counts render, literal text/unsafe-link handling, search/location/type/date composition, empty results and pagination. |
| `public/app.js`: `postedTime`, `newestFirst`, `idFor` | `pm21-ui.test.js`: newest-first ordering, unknown/invalid dates last, stable favorite identifier; saving and saved-mode integration. |
| `public/app.js`: `read`, `switchMode`, save/theme callbacks | `pm21-ui.test.js`: malformed storage fallback, saving/removing roles, persisted/restored favorites and dark mode, switching Saved/Explore. |
| `public/app.js`: `load`, refresh callback | `pm21-ui.test.js`: initial load, partial-source warning, refresh POST, server failure shown without result cards. |
| `public/app.js`: input/reset/previous/next callbacks | `pm21-ui.test.js`: user input changes visible cards, navigation changes page, input resets pagination, clear restores results. |

PM2.2 tests in `pm22-keywords.test.js` additionally exercise `splitKeywords` and
`matchesKeywords` through real application event handlers: include AND, exclude
OR, normalization, blank fields, literal phrases, conflicting rules, title/company
scope, combined search/location, pagination reset and preserving saved-only mode.

The DOM harness reads actual HTML IDs and runs the application script, but does
not emulate browser layout, accessibility APIs or real browser storage behavior.
Manual browser checks remain useful. The daily timer is not waited out; its
`refresh` target is exercised directly through the API. The older CLI is outside
the PM2.1 web enhancement scope.

AI assistance and prompts: [disclosure](../ai/PM2.2-ai-usage.md). New/expanded
AI-assisted tests contain a comment pointing to that record; pre-existing source
tests retain their original provenance.
