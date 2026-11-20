# PM2.3 AI assistance disclosure

- **Date:** 2026-11-20
- **Tool:** Opencode Build agent, model `ARC/DeepSeek-V4.1-Flash`.
- **Purpose:** Add the missing PM2.1 unit tests for the PM2.3 testing milestone.
- **User prompt:** “Based on your analysis, generate unit tests for the PM2.1 functions that are missing test coverage. Requirements: 1. Follow the existing testing conventions. 2. Use the testing framework already installed in the project. 3. Write at least one unit test per function. 4. Include normal cases, edge cases, and invalid inputs where appropriate. 5. Do not modify the original implementation unless absolutely necessary. 6. Add comments explaining the purpose of each test. For any AI-generated tests, document the prompts used so we can comply with our CS3704 AI policy. After generating the tests, run the test suite and report which tests pass or fail.”
- **Prior context prompt:** “I am working on Project Milestone 2.3 for my CS3704 project. Our repository is an internship/job search application. I need to generate unit tests for the functions implemented during PM2.1. First, inspect the entire project structure and identify: 1. The functions implemented or modified for PM2.1. 2. Where those functions are located. 3. Which functions already have tests. 4. Which functions are missing unit tests. 5. The existing testing framework and conventions used in this project. Do not modify any files yet. Just provide your analysis.”
- **Scope decision:** PM2.1 means the web application delivered by commit `ed9bca4` / merge `ca7ece9`: `server.js`, `public/app.js`, and the source adapters they use. The older CLI (`src/index.js`, `src/filters.js`, `src/display.js`) was left outside this change; `filters.js` and `display.js` already have tests, and the CLI is not the PM2.1 deployment artifact.
- **Implementation rule followed:** No application code was changed. Only `test/**` and documentation were changed.
- **Testing instructions:** Use the existing `node:test` + `node:assert/strict` conventions. Add focused tests for missing branches with inline fixtures, mock external `fetch` calls, and use the existing VM DOM harness for browser code. Add comments explaining each test’s purpose. Keep server tests in temporary project copies.

## Files changed

- `test/pm21-sources.test.js` — added GitHub normalization/default/edge-case coverage.
- `test/pm21-boards.test.js` — added unsupported-provider coverage for `fetchBoard` via a temporary configured copy.
- `test/pm21-ui.test.js` — added co-op/full-time, posted-since, empty-state, page-clamp, helper, and card-rendering coverage.
- `test/pm21-server-branches.test.js` — new file for `key()` fallback, malformed startup cache, partial board failure merge, mid-run refresh rejection, static/JSON headers, and concurrent refresh coalescing.
- `test/pm21-server.test.js` — test-only cleanup fix: wait for the spawned server to exit before deleting its temporary directory (fixes Windows `EBUSY` flakiness).
- `docs/testing/PM2.1-test-coverage.md` — added the new PM2.3 test mapping.

## Function-to-test mapping

| Function/area | New or expanded coverage |
|---|---|
| `simplify.js` `fetchInternships` | Defaults for title/company/location/URL/date/terms; `is_visible:false` vs `active:false`; empty dataset; non-array payload rejection |
| `boards.js` `fetchBoard` | Unsupported provider fails before `fetch`; temporary config copy keeps the real `job-boards.json` untouched |
| `app.js` `render` | Co-op and full-time spellings; posted-since stale/undated exclusion; no-listings vs no-match states; unknown posting date; page clamp; card initials/tags/date |
| `app.js` `$`, `el`, `read`, `newestFirst` | Direct helper assertions, including storage fallback and sort tie-breakers |
| `server.js` `key` | URL-less `company|title|location` fallback; case/query/trailing-slash URL normalization |
| `server.js` `init` | Malformed cache file is ignored and a fresh refresh is served |
| `server.js` `refresh` | Partial board failure merges only the failed company’s cache; failed mid-run refresh returns the cached payload; concurrent refreshes share one upstream refresh |
| `server.js` request callback | Static HTML/JS/CSS headers and JSON `Cache-Control` headers |

## Assistant verification

- `node --test test/pm21-sources.test.js test/pm21-boards.test.js test/pm21-ui.test.js test/pm21-server-branches.test.js` → **26 tests, 26 pass, 0 fail**.
- `node --test "test/*.test.js"` → **49 tests, 49 pass, 0 fail**, duration about 2.2 s, Node.js v24.21.0 on Windows.
- `node --test --experimental-test-coverage "test/*.test.js"` → measured files: 100% lines, 97.96% branches, 100% functions; `simplify.js` improved from 41.67% to 100% branch coverage. `server.js` and `public/app.js` still execute in temp copies/VM contexts, so they are not attributed in Node’s coverage table.
- `npm run lint` could not run locally because `eslint` is not installed in this checkout’s `node_modules`; the CI workflow installs dependencies first with `npm ci`. No lint result is claimed here.

No human execution, peer review, or instructor approval is claimed. Team members should inspect these tests, run them in their own environment, and record their own checks.
