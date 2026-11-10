# Verification Report — PM2.2 (web application, re-verification)

- **Commit:** `2f381d1` (`2f381d1a5d2e6e149ad0a2892a0d8f93ebff037e`), merge of PR #14
- **Branch:** `verification-agents`
- **Working tree:** the commit under test is `2f381d1`; `test/filters.test.js` and
  `test/display.test.js` are **uncommitted additions**. Of the 34 tests below, 17
  exist in the commit and 17 come from those two files.
- **Date:** 2026-11-10
- **Runtime:** node v24.19.0 (darwin)
- **Commands run:**
  - `npm test`
  - `node --test --experimental-test-coverage --test-coverage-lines=85 --test-coverage-branches=85 test/*.test.js`

**Scope.** Measured modules: `src/filters.js`, `src/display.js`,
`src/sources/boards.js`, `src/sources/simplify.js`. `server.js`, `public/app.js`,
and `src/index.js` are **not** in the coverage table (see Coverage → Scope).
Test tooling (`test/helpers/browser.js`, the `tester`/`review` agents, the
`test`/`verify` skills) is uncommitted working-tree content.

## Gate results

| Gate | Command | Result | Evidence |
|------|---------|--------|----------|
| G1 suite | `npm test` | **PASS** | exit 0; `ℹ tests 34`, `ℹ pass 34`, `ℹ fail 0`, `ℹ skipped 0`, `ℹ todo 0`, `ℹ duration_ms 2192.676375` |
| G2 coverage | `node --test --experimental-test-coverage --test-coverage-lines=85 --test-coverage-branches=85 test/*.test.js` | **PASS** | exit 0; `all files` lines **100.00%**, branches **90.43%**, funcs **100.00%** (thresholds 85/85) |
| G3 behavior | Read of all 7 test files and export inventory | **FAIL** | `simplify.js` 41.67% branches: 5 of 12 decisions unasserted; `src/index.js` has no test and no export; `public/app.js` decision points unasserted (see below). No skips, no `todo`, no tautological asserts, no test mocks its own unit |
| G4 lint | Detect from `package.json` | **NOT CONFIGURED** | no `lint` script, no linter dependency, nothing installed |

No gate was marked PASS from an unrun command. G2 thresholds are **aggregate**;
the gate does not enforce per-file minimums, so `simplify.js` at 41.67% does not
breach it.

## Coverage

| File | Line % | Branch % | Funcs % | Uncovered lines |
|------|--------|----------|---------|-----------------|
| `src/display.js` | 100.00 | 100.00 | 100.00 | — |
| `src/filters.js` | 100.00 | 100.00 | 100.00 | — |
| `src/sources/boards.js` | 100.00 | 95.45 | 100.00 | — |
| `src/sources/simplify.js` | 100.00 | 41.67 | 100.00 | — |
| **all files** | **100.00** | **90.43** | **100.00** | — |

**Scope, stated explicitly.** Measured: `src/filters.js`, `src/display.js`,
`src/sources/boards.js`, `src/sources/simplify.js`. Not measured:
`server.js`, `public/app.js` (exercised via copies in temporary directories, so
execution is not attributed to repo files), `src/index.js` (never imported by a
test), and `test/helpers/`. The `all files` row is therefore **not**
whole-project coverage.

Node's reporter does not itemize branches. `file:line` below was confirmed by
reading each conditional against the fixtures; raw V8 zero-count blocks were
also inspected for `boards.js` and `simplify.js`.

### Uncovered branches mapped to behavior

| File:line | Function | Unasserted behavior |
|-----------|----------|---------------------|
| `src/sources/simplify.js:29` | `fetchInternships` | `is_visible: false` with `active: true`; the only excluded fixture is `active: false`, so the two conditions are never distinguished |
| `src/sources/simplify.js:31` | `fetchInternships` | missing title → `"Untitled role"` |
| `src/sources/simplify.js:32` | `fetchInternships` | missing `company_name` → `"Unknown company"` |
| `src/sources/simplify.js:33` | `fetchInternships` | empty `locations` → `"Unspecified"`; missing `locations` throws (D1) |
| `src/sources/simplify.js:34` | `fetchInternships` | `company_url` fallback; both URLs missing → `""` |
| `src/sources/simplify.js:35` | `fetchInternships` | missing `date_posted` → `null` |
| `src/sources/simplify.js:36` | `fetchInternships` | missing/empty `terms` → `"Unspecified"` |
| `src/sources/boards.js:9` | `fetchBoard` | unsupported provider throws `"Unsupported provider"`; unreachable with the current `job-boards.json` (greenhouse + lever only) |
| `src/index.js:30-96` | `promptFilterChoice`, `collectFilterInput`, `runFilter`, `describeFilter`, `isBlankInput` | no test at all: filter selection, input collection, label formatting, blank-input guard |
| `src/index.js:98-164` | `main` (runs on import) | no test at all: fetch-failure message, undo stack, zero-result rejection, done gating |
| `public/app.js:29` — not measured | `render` | `co-op` and `full-time` type filters; only `intern` is exercised |
| `public/app.js:30` — not measured | `render` | date cutoff rejecting a stale posting; fixture dates are always recent |
| `public/app.js:39` — not measured | `render` | `"No listings available"` empty state; only the no-match state is asserted |
| `public/app.js:44` — not measured | `render` | `"Posting date unavailable"` label |
| `server.js:12` — not measured | `key` | dedup fallback for a listing with no `url` |
| `server.js:25-28` — not measured | `refresh` | partial board failure: merge old entries for only the failed companies |
| `server.js:38` — not measured | `refresh` | cached-listing fallback when refresh itself rejects (the integration test covers startup-with-cache, not a mid-run rejection) |

`filters.js` and `display.js` have no uncovered branches. All **8 exported
functions** in `src/**` are covered by at least one test (`applyKeywordFilter`,
`applyMajorFilter`, `applyCompanyTypeFilter`, `applyLocationFilter`,
`applyPlusMinusFilter`, `displayResults`, `fetchBoards`, `fetchInternships`).
The exported constant `SOURCE_NAME` is not asserted directly.

### Test-body review

- **No tautologies:** no `assert.ok(true)` or equivalent; every assertion has an
  expected value. Spot-checks of the strongest claims: `filters.test.js` asserts
  exact surviving titles and literal-substring behavior; `display.test.js`
  asserts page ranges and counts; `pm21-boards.test.js` asserts exact error
  strings and normalized dates.
- **No skipped or unexecuted tests:** `grep` for `.skip`/`.todo`/`.only` returned
  nothing; G1 reports `skipped 0`, `todo 0`, and 34 executed tests.
- **Mocks are external only:** `globalThis.fetch` (sources, boards, server
  fixture via `--import`), a DOM/localStorage harness for `public/app.js`, and a
  `PassThrough` for stdin in `display.test.js`. No test mocks the unit under test.
- **Error paths are exercised:** HTTP 503, thrown network error, invalid JSON,
  malformed payload (`{jobs:null}`), total upstream outage with and without a
  cache, failed refresh in the UI, invalid saved-state JSON, and rejected unsafe
  URLs. `simplify.js` default branches remain the notable gap.
- **Behavior match:** three mismatches are recorded under Defects; only one
  (D3) is a case where the documented behavior and the implementation disagree.

## Defects

| ID | File:line | Expected | Actual | Severity |
|----|-----------|----------|--------|----------|
| D1 | `src/sources/simplify.js:33` | a listing without `locations` normalizes to `"Unspecified"`, like the other fallbacks | `item.locations.join(", ")` throws `TypeError: Cannot read properties of undefined`; the whole fetch rejects (verified with a fixture) | **High** — one malformed record aborts all GitHub listings; no test covers it |
| D2 | `src/filters.js:30` | filtering is silent; the CLI prints only its own prompts/results | every call prints the normalized include array, e.g. `[ 'software' ]` (verified) | **Medium** — user-visible CLI output corruption |
| D3 | `src/filters.js:38-48` vs `src/index.js:51,55,63` | major and company-type accept **any** comma-separated keyword (docstring "must match at least one"; prompt "matches ANY") | both delegate to `matchesAll`, requiring **every** keyword; `applyMajorFilter(pool, "software, data")` drops a listing containing only "software" (verified) | **High** — silent over-filtering; docs and behavior disagree |
| D4 | `src/sources/simplify.js:39` | `tags` built from the defaulted title/company | built from raw fields: `"undefined undefined"` when both are missing (verified) | **Low** — corrupts keyword matching for incomplete records |
| D5 | `src/index.js:164` | logic importable and testable; entry point executes only when run | `main()` runs on import and no helper is exported, so the module has zero tests | **Medium** — the entire CLI flow is unverified |

## Proposed fixes (not applied)

1. **Test-only (no approval needed for `test/**`)** — add one fixture array to
   `test/pm21-sources.test.js` with records missing each optional field, an
   empty `locations` array, and `{is_visible: false, active: true}`; assert
   `"Untitled role"`, `"Unknown company"`, `"Unspecified"`, `""`, `null`, and
   exclusion. This closes the six `simplify.js` branch gaps. Do **not** include a
   record with `locations` absent until D1 is fixed, or the test will fail.
2. **D1 (requires approval)** — `src/sources/simplify.js:33`:
   `location: (item.locations || []).join(", ") || "Unspecified",`
3. **D4 (requires approval)** — compute the defaults once, then build `tags`
   from them rather than from `item.title` / `item.company_name`.
4. **D2 (requires approval)** — delete `console.log(inc)` at `src/filters.js:30`.
5. **D3 (decision required)** — either make `applyMajorFilter` /
   `applyCompanyTypeFilter` match **any** keyword (add an `any` mode to
   `applyKeywordFilter` and use it in those two functions) or change the
   docstring and the three `src/index.js` prompts to say **all**. The README
   describes AND logic for include keywords, so this is a product decision, not
   a mechanical fix.
6. **D5 (requires approval)** — export `runFilter`, `describeFilter`, and
   `isBlankInput` and guard the entry point with
   `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();`
   Then unit-test the three helpers and the undo/blank/zero-result branches.
7. **Optional** — `public/app.js` tests for co-op/full-time, stale-date cutoff,
   the no-listings empty state, and the date-unavailable label; a server test for
   partial board failure and `key()` without a URL.

## Not verified

- `server.js` line/branch coverage — integration tests run copies in temporary
  directories, so execution is not attributed to the repo file. Its refresh
  merge, `key()` fallback, concurrent-refresh dedupe, static headers, and the
  daily scheduler are unverified.
- `public/app.js` line/branch coverage — DOM harness only; no layout,
  accessibility tree, or real `localStorage`. The decision points listed above
  are unasserted.
- `src/index.js` — never imported; zero coverage. Not "failed", simply not run.
- Live providers — every network call is mocked; the SimplifyJobs, Greenhouse,
  and Lever response contracts are unverified beyond the fixtures.
- Real browser and real TTY behavior — no browser; stdin is a `PassThrough`.
- Linting/formatting — no linter configured, none installed.
- Coverage of `test/helpers/` and `node_modules` — excluded by design.
- Manual mutation checks were run during test authoring for `filters.js` and
  `display.js` (mutated copies in temp directories) and were caught by the
  intended tests. That is supplementary evidence, not a gate, and no mutation
  tool is installed.

## Recommendation

**Not ready.** G1 and G2 pass; G3 fails on unasserted `simplify.js` fallbacks and
an entirely untested CLI entry point, and D1/D3 are behavior defects regardless
of coverage.

Smallest unblocking change: proposed fix 1 (test-only, `test/pm21-sources.test.js`),
which closes the six branch gaps and makes D1 a failing test that justifies the
one-line guard in fix 2. D3 still needs a product decision before the CLI can be
called verified.

This is a project-quality assessment, not a grade. Grading, deadline, and
integrity questions go to Dr. Brown at dcbrown@vt.edu.
