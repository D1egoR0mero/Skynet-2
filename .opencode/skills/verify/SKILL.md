---
name: verify
description: "Run the project's quality gates — full suite, coverage thresholds, configured linting — and produce docs/verification-report.md. Use before a milestone, PR, or submission."
---

# Verify Skill

Decide whether the project is "verified" using the team's definition: every
automated test passes, coverage clears the threshold, and tested behavior
matches expected behavior. Coverage alone is not correctness — a line that
executes without an assertion is an unverified line.

## Gates

| Gate | Command | Pass criteria |
|------|---------|---------------|
| G1 suite | `npm test` | exit 0, `fail 0`, test count > 0 |
| G2 coverage | `node --test --experimental-test-coverage --test-coverage-lines=85 --test-coverage-branches=85 test/*.test.js` | exit 0; lines ≥ 85 and branches ≥ 85 |
| G3 behavior | read the test bodies | expected values asserted; no tautological asserts; every exported function covered; untested error paths named |
| G4 lint | detect from `package.json` | only if configured; otherwise report "no linter configured" |

Run G1 and G2 as separate commands and keep their raw summary lines. Record the
runtime (`node --version`) and the commit under test.

There is no coverage or lint dependency in this repository. Use Node's built-in
`--experimental-test-coverage` and its threshold flags; do not add a tool to a
graded repository without approval. A threshold breach exits non-zero even when
every test passes — record that as G2 FAIL while G1 stays PASS.

### What this coverage number actually measures

Node attributes coverage only to modules loaded in the test process. In this
repository, `server.js` and `public/app.js` are exercised through copies made in
temporary directories, so their execution is **not** attributed back to the repo
files. `--test-coverage-include` does not recover them.

Report the per-file table, not just the `all files` row, and name the scope
explicitly, for example: "measured: `src/sources/boards.js`,
`src/sources/simplify.js`; not measured: `server.js`, `public/app.js` (exercised
via temporary copies)". Never present the all-files figure as whole-project
coverage, and list the unmeasured files under "Not verified".

## Coverage is a floor, not a verdict

For every uncovered branch, record the mapping `file:line` → function →
behavior that is not asserted. Then read the tests themselves:

- Is there an assertion with an expected value, or only "no exception thrown"?
- Does any test assert something that cannot fail (`assert.ok(true)`)?
- Does a test mock the function it claims to test?
- Is any test skipped, or present but never executed?
- Does the suite touch error paths, or only the happy path?
- Is any export of `src/**`, `public/app.js`, or `server.js` untested?

A suite at 90% coverage that never exercises a `catch` block is not verified.

## Failure behavior

On any FAIL:

1. **Stop.** Do not continue to the next gate as if the result were green.
2. **Explain** which gate failed, and quote the evidence (assertion, stack
   trace, coverage line).
3. **Propose** a fix as a diff or a precise description, naming the file and
   function.
4. **Ask** with the `question` tool before anything is changed.

Never fix while verifying. Never mark a gate PASS from a command you did not
run. Report "not verified" separately from "failed" — an untested path is not a
passing path.

## Output: `docs/verification-report.md`

Return the complete markdown body. The reviewer agent has no edit permission, so
the write is delegated to `@build`. Use this structure:

```markdown
# Verification Report — <milestone>

- Commit: <sha>
- Date: <ISO date>
- Runtime: node <version>
- Commands run: <exact commands>

## Gate results

| Gate | Command | Result | Evidence |
|------|---------|--------|----------|
| G1 suite | ... | PASS/FAIL | `<summary line>` |
| G2 coverage | ... | PASS/FAIL | lines X%, branches Y% |

## Coverage

Lines / branches / functions. Uncovered branches mapped to behavior:

| File:line | Function | Unasserted behavior |
|-----------|----------|---------------------|

## Defects

| File:line | Expected | Actual | Severity |
|-----------|----------|--------|----------|

## Proposed fixes (not applied)

## Not verified

Anything not run, and why (missing tooling, unlistened port, mocked dependency).

## Recommendation

Ready / not ready, and the smallest change that would unblock it.
```

The recommendation is a project-quality signal. Grading, deadline, and
integrity questions go to Dr. Brown at dcbrown@vt.edu.
