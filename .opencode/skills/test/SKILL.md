---
name: test
description: "Generate, repair, and run unit tests in this repository's own test runner. Use when adding coverage, reproducing a bug, or when a generated test fails to run."
---

# Test Skill

Generate tests that run, fail for the right reason, and match the project's
existing style. The output is a test file plus a short finding list — never a
claim that is stronger than what you actually executed.

## 1. Detect the runner before anything else

Read `package.json` and use the command in `scripts.test`. Do not assume a
framework from prior coursework (JUnit, pytest, Vitest). In this repository:

| Fact | Value |
|------|-------|
| Runner | Node.js built-in test runner (`node --test`), Node 20+ |
| Command | `npm test` (`node --test test/*.test.js`) |
| Assertions | `node:assert/strict` |
| Test files | `test/<name>.test.js`; helpers in `test/helpers/` |
| Coverage | `node --test --experimental-test-coverage ...` (built in, no dependency) |

If `scripts.test` is missing or names a tool that is not installed, say so and
stop. Do not install a runner into a graded repository.

## 2. Seed from an existing test

Read one existing test file that covers a similar module and match it: import
style, fixture construction, test naming, and how external calls are mocked.
A generated test that looks unlike its neighbours is a review finding by itself.

Existing patterns worth reusing:
- provider responses are mocked from fixtures, never fetched
- server and file-writing tests copy the project into a temporary directory so
 real data is untouched
- UI tests use the small DOM harness in `test/helpers/browser.js`, not a browser

## 3. Map functions to tests

List the exports of the module under test (read the file or `grep` for
`export`), then state which test covers each one. Any export with no test is a
finding — report it even if the suite is green. A green suite with an untested
function is not evidence of correctness.

## 4. Cover the edge cases explicitly

For each function under test, check this list and record which cases apply:

- zero / empty string / empty array / empty leaderboard or collection
- single element
- negative numbers, and the order of operands in subtraction and division
- very large values and overflow-adjacent inputs
- missing key, missing record, player not present
- invalid or malformed input (wrong type, null, undefined)
- every error-handling branch: thrown error, rejected promise, non-2xx response
- boundaries of each comparison (`<` vs `<=`, first vs last page)
- conflicting or combined filters

Error paths are the most likely place for a hidden bug: an untested `catch`
block is unverified behavior, not tested behavior.

## 5. Prove each test runs

A test that never executes is a defect in the test. For every generated test:

1. Run it and confirm the reported test count includes it.
2. Confirm it fails when the code is wrong. If the production code is not
   currently broken, run the test against a deliberately mutated copy in a
   temporary directory — never mutate the real source.
3. Confirm it passes once the behavior is correct.

Report as test defects, not results: import errors, syntax errors, argument
count or order mismatches, misnamed variables, and invented function names.
These are the failure modes that make AI-generated suites unusable, and they
must never be summarized as "tests added".

## 6. Report

Return, in this order:

- files written or changed
- `npm test` result line (counts, failures)
- the function-to-test map, with gaps listed
- edge cases covered, and the ones still uncovered
- any defect found in the application code: `file:line`, expected vs actual

Then stop. Do not fix application code; propose the fix and ask first.

## Rules

- Do not weaken or delete an existing assertion to make a suite pass.
- Do not add `skip`/`todo` to a failing test without reporting it as uncovered.
- Do not mock the unit under test.
- Do not claim coverage or a pass for a command you did not run.
