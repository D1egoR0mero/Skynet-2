# Verification Agents and Skills: Rationale

For PM2.3 we added two subagents (`tester` and `review`) and two skills (`test`
and `verify`) so that verification is something the project can repeat instead of
something we do once by hand. Before this, our checks were ad hoc: whoever
remembered to run `npm test` ran it, coverage numbers got quoted without saying
which files they covered, and "it works" was based on a general impression rather
than a recorded command. The agents and skills exist to make the same set of
checks happen every time and to make the results honest about what was and was
not actually executed.

## Quality gates

Both agents and both skills use the same four gates. The point of naming them
G1–G4 is that a result can be reported as PASS, FAIL, or NOT CONFIGURED, and
"not run" never quietly turns into "passed."

| Gate | What it checks | Pass criteria | If it fails | Why we added it |
|------|----------------|---------------|-------------|-----------------|
| **G1 suite** | The whole automated test suite, run with the repository's own runner (`npm test` → `node --test test/*.test.js`). | Exit code 0, `fail 0`, `tests` count greater than zero. | Stop. Quote the failing assertion or stack trace, name the suspected cause as `file:line`, propose a fix, and ask before changing anything. A test file that fails to import counts as a failure, not a pass. | We needed one command whose output we could quote. It also catches the boring failure mode where a test file has a syntax error and silently contributes nothing. |
| **G2 coverage** | Line and branch coverage from Node's built-in reporter, with thresholds of 85% lines and 85% branches. | Exit code 0 and both lines ≥ 85 and branches ≥ 85. | Record G2 as FAIL while G1 stays PASS, show the per-file rows, and map each uncovered branch to the behavior it leaves unasserted. Do not lower the threshold to make it green. | Coverage forces us to measure instead of assume. We also report per-file numbers because the aggregate hides weak files — `simplify.js` sits at 41.67% branches while the all-files row is 90.43%, and an aggregate-only view would never show that. |
| **G3 behavior** | Whether the tests actually assert the behavior, by reading the test bodies: expected values are asserted, no tautological asserts, no test mocks its own unit, every exported function has a test, and untested error paths are named. | All of the above hold, and any gap is listed explicitly. | List the unasserted behavior as "not verified." Do not describe it as passing just because no test failed. | This is the gate coverage cannot replace. A line can execute and still be unverified if nothing asserts what it produced. G3 is also the gate that caught our real problems. |
| **G4 lint** | Whether the repository configures a linter at all, detected from `package.json`. | A linter is configured and runs clean. | Report "no linter configured." Never install one into a graded repository without approval. | We did not want an agent quietly adding dependencies so it could show a green lint row. Recording the gap is more useful than faking the check. |

G1 and G2 are run as separate commands so their exit codes and summary lines
stay independent. That matters because a coverage threshold can fail even when
every test passes.

## Skills

### `test` skill

**What it does.** It is the procedure for creating and repairing tests in this
repository's actual runner. It starts by reading `package.json` and using
`scripts.test`, so the agent cannot fall back on pytest or JUnit habits from
other courses. It then seeds the style from an existing test file, maps every
export of the module to a test, walks an edge-case checklist (empty inputs,
missing fields, boundaries, error branches), and requires each new test to be
proven: it must execute, it must fail when the code is deliberately mutated in a
temporary copy, and it must pass once the behavior is correct.

**When to run it.** When adding coverage, reproducing a bug as a test, or when a
generated test fails to run or fails for the wrong reason.

**What it outputs.** The test file plus a fixed report: files changed, the
`npm test` result line, a function-to-test map with gaps, edge cases covered and
still uncovered, and any application defect as `file:line` with expected vs
actual. It ends there — it does not fix application code.

**Why our project needs it.** Our suite started at 17 tests with a mix of styles,
and AI-written tests are easy to get wrong in ways that look fine: importing the
wrong runner, mocking the function under test, asserting `assert.ok(true)`, or
"adding tests" that never execute. The skill's rules against weakening
assertions and against claiming a pass for a command that was not run are the
reason we can trust the test count we report.

### `verify` skill

**What it does.** It defines the gates, the exact commands, and the failure
protocol in one place, and it defines what "verified" means for this team: every
test passes, coverage clears the threshold, and tested behavior matches expected
behavior. It also contains the coverage-scope warning — Node only attributes
coverage to modules loaded in the test process, so files exercised through
temporary copies are invisible to the reporter and must be named as unmeasured.

**When to run it.** Before a milestone, a PR, or a submission.

**What it outputs.** The complete markdown body for `docs/verification-report.md`,
with a gate table, a coverage table, defects, proposed fixes that were not
applied, a "not verified" section, and a readiness recommendation. Because the
reviewer cannot write files, the body is handed to `@build` for the actual write.

**Why our project needs it.** Without a shared definition, the tester and the
reviewer could each declare success on different grounds. The skill also stops
us from presenting the all-files coverage percentage as if it were whole-project
coverage, which is exactly the mistake this document corrects below.

## Agents

Both agents are subagents with a `maxTurns` of 15. That limit is deliberate: a
verification run should be a bounded set of commands and a written result, not an
open-ended editing session.

### `tester`

**Role.** Runs the suite, writes and repairs test files, isolates failures to a
specific function with expected vs actual, and reports. It does not change
application code, and it does not decide whether the work is ready for a
milestone — that belongs to `@review`.

**Skills used.** `test` for the generation and repair procedure, `verify` for the
gate definitions.

**Permissions and why they fit.**

| Permission | Why the tester has it |
|------------|-----------------------|
| `read`, `grep`, `glob` | It has to read source and existing tests before writing anything, and inventory exports to find untested functions. |
| `bash` | It must actually run `npm test` and the coverage command. A tester that cannot execute is just a text generator. |
| `edit` | It writes and repairs files under `test/**`, and `docs/verification-report.md` only when explicitly asked. |
| `question` | The failure protocol requires asking before any change, so the prompt tool is part of the workflow, not an extra. |
| `skill` | It loads `test` and `verify`. |
| `task` | If the student approves an application fix, the tester delegates it to `@build` rather than applying it itself. |

The one thing worth being upfront about: the frontmatter grants `edit: allow`,
which is broader than "tests only." The real restriction is in the agent body,
which limits edits to `test/**` and the report and forbids `src/**`, `public/**`,
`server.js`, `package.json`, and `docs/ai/**`. We kept the permission broad
because the agent legitimately needs to write test files, and enforced the narrow
scope as an instruction. A stricter setup would split test-writing and reporting
into separate permissions.

### `review`

**Role.** Re-runs the gate commands itself, maps uncovered branches to behavior,
produces the body of the verification report, and recommends whether the work is
ready for a milestone.

**Skills used.** `verify` as the primary procedure, plus `test` so it can reason
about whether a test is meaningful.

**Permissions and why they fit.**

| Permission | Why the reviewer has it |
|------------|-------------------------|
| `read`, `grep`, `glob` | It reads all test bodies and source files; G3 cannot be judged from command output. |
| `bash` | It must re-run `npm test` and the coverage command independently. |
| `question` | On any FAIL it asks whether to proceed before anything changes. |
| `skill` | It loads `verify` and `test`. |
| `task` | It hands the report body to `@build`, since it cannot write the file. |
| **no `edit`** | This is the important one. The agent that judges readiness cannot modify the code it is judging. |

The separation is the whole design: the tester can write tests but cannot sign
off, and the reviewer can sign off but cannot write. The reviewer is also
required to re-run the commands rather than accept the tester's summary — a
result it did not execute is recorded as "not verified."

## Results and changes

We ran the gates on 2026-11-10 on Node v24.19.0 against commit `2f381d1`, using
`npm test` and
`node --test --experimental-test-coverage --test-coverage-lines=85 --test-coverage-branches=85 test/*.test.js`.
The full write-up is in `docs/verification-report.md`; here is the short version.

| Gate | Result | What we saw |
|------|--------|-------------|
| G1 suite | **PASS** | `tests 34`, `pass 34`, `fail 0`, `skipped 0`, `todo 0`, about 2.2 s. |
| G2 coverage | **PASS** | `all files` at **100.00% lines**, **90.43% branches**, 100.00% functions, against 85/85 thresholds. |
| G3 behavior | **FAIL** | Behavioral verification failed due to untested edge cases (details below). |
| G4 lint | **NOT CONFIGURED** | No `lint` script and no linter dependency in `package.json`. Nothing was installed. |

**What the coverage numbers do not mean.** 100% line coverage and 90.43% branch
coverage are not whole-application numbers. Node only counts modules loaded in
the test process, so the measured set is `src/filters.js`, `src/display.js`,
`src/sources/boards.js`, and `src/sources/simplify.js`. `server.js` and
`public/app.js` run through copies in temporary directories, so their execution
is not attributed back to the repo files, and `src/index.js` is never imported by
a test at all. All three are missing from the table, which means the percentages
describe four source files, not the app.

**What the agents found.**

- `src/sources/simplify.js` sits at 41.67% branch coverage; five of its twelve
  decisions are never asserted, mostly the `"Untitled role"`, `"Unknown
  company"`, `"Unspecified"`, `""`, and `null` fallbacks.
- `src/index.js` has no tests at all. `main()` runs on import and none of the
  helpers are exported, so the whole CLI flow is unverified.
- `public/app.js` decision points are unasserted: co-op and full-time type
  filters, the stale-date cutoff, the "No listings available" empty state, and
  the "Posting date unavailable" label.
- Five defects were recorded in the report: **D1** (`simplify.js:33` — a listing
  with no `locations` throws and rejects the entire fetch, high), **D2**
  (`filters.js:30` — a stray `console.log(inc)` corrupts CLI output, medium),
  **D3** (major and company-type filters require *all* keywords while the
  docstring and prompts say *any*, high), **D4** (`simplify.js:39` — `tags`
  built from raw fields, low), and **D5** (`src/index.js:164` — unexported,
  runs on import, medium).

**What we changed afterward.** We added 17 tests in `test/filters.test.js` and
`test/display.test.js`, which took the suite from 17 to 34 and brought
`filters.js` and `display.js` to 100% lines and branches. We added the `tester`
and `review` agents and the `test` and `verify` skills, and we wrote
`docs/verification-report.md`. The report's recommendation is **not ready**,
because G3 fails and D1/D3 are behavior defects independent of coverage.

We did not fix any application bugs. D1–D5 are documented with proposed fixes,
and none of those fixes were applied — D1 and D4 need approval, D2 is a one-line
change we did not make, D3 needs a product decision about whether the filters
should be AND or OR, and D5 needs a refactor of the entry point. The remaining
branch gaps in `simplify.js`, `index.js`, `public/app.js`, and `server.js` are
likewise still open. If it looks like the suite is green and everything is
resolved, that is not what the report says.

### AI usage disclosure

OpenCode with DeepSeek-V4.1-Flash assisted with the agents, the skills, the
tests, and this report. The assistant drafted the agent definitions and skill
procedures, wrote and ran the test files, executed the gate commands, and
produced the body of `docs/verification-report.md`. We reviewed the output and
decided what to keep, and the assistant did not apply any fix to application
code. All results stated here are from commands that were actually run; nothing
is reported as passing that was not executed, and the unmeasured files are named
rather than counted.

This is a project-quality assessment, not a grade. Anything about grading,
deadlines, or academic integrity goes to Dr. Brown at dcbrown@vt.edu.
