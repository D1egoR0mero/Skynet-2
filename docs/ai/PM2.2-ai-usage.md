# PM2.2 AI assistance disclosure

- **Date:** 2026-11-03
- **Tool:** OpenAI Codex desktop, with build, requirements, and design subagents following the repository's agent roles. This work used Codex, not Opencode.
- **Purpose:** Add PM2.1 regression tests, implement PM2.2 include/exclude keyword filtering, and prepare a pull request.
- **User prompt:** “generate tests for pm2.1 code and then add the mplement include/exclude keyword filtering for PM2.2 the pr title should be: implement include/exclude keyword filtering for PM2.2 and human pr description with tests”
- **Follow-up instruction:** At least one unit test per PM2.1 function, or integration tests incorporating multiple functions; disclose AI-generated tests using comments and/or a log; add the tests to the repository and submit major contributions through a PR.
- **Implementation instructions:** Use comma-separated keywords, AND for inclusion and OR for exclusion, case-insensitive substring matching against title/company, trim whitespace and ignore empty tokens. Compose with existing filters, reset pagination on edits, and reset both new fields when clearing filters.
- **Testing instructions:** Exercise PM2.1 source adapters, server/cache/refresh behavior, UI rendering, filtering, pagination, favorites, theme and loading behavior. Use deterministic fixtures and mocked external requests; map functions to tests. Add focused PM2.2 parsing, matching, and UI integration coverage.
- **AI-shaped portions:** Code and tests in this PR, test documentation, and the PR description. Requirements/design drafts were initially generated, then removed at the user’s request because a separate teammate will produce those artifacts using Opencode. The missing career-board source adapter was identified during baseline inspection and repaired as part of making the existing server and tests runnable.
- **Human contributions observed:** The user selected the enhancement, supplied milestone criteria, specified the PR title, and requested test disclosure. No human execution of these tests or peer approval is claimed.
- **Verification and responsibility:** The PR reports checks actually run by the assistant. Team members still need to inspect and understand the implementation, verify it in their environment, record their own revisions and checks, and conduct the required peer review. This log does not represent instructor approval or an exception to course tool requirements.

See [PM2.1 test coverage](../testing/PM2.1-test-coverage.md) for the function-to-test mapping and reproducible commands.

## Assistant verification

On 2026-11-03, `npm test` on Node.js v24.19.0 passed all 17 tests (13 PM2.1/source-repair tests and four PM2.2 tests), with zero failures. Local HTTP listening permission was required for server integration tests. External source responses were mocked. UI tests used a lightweight DOM harness, not a real browser. `git diff --check` passed. No live-provider availability or manual browser verification is claimed.
