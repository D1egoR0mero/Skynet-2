# ADR-0002: Add include/exclude keyword filtering to the existing browser application

- **Status:** Proposed
- **Date:** 2026-11-03
- **Deciders:** Frontend/UX owner, QA/test owner, peer reviewer

## Context

US-001 criteria 2–3 require include keywords to combine with AND and exclude keywords to combine with OR. The current browser provides a single phrase-search field and filters in `public/app.js`. US-002 scopes PM2.2 to separate keyword fields while retaining general search, location, type, date, and saved-opportunity filters.

ADR-0001 proposed server-side filtering using Express. The delivered application instead uses Node's HTTP server and browser-side filtering. This decision replaces the proposed approach only for this enhancement; it does not claim the remaining funnel requirements are implemented.

## Decision

We will implement parsing and matching as pure browser functions and combine their result with existing filters. Separate labelled inputs accept comma-separated terms; matching uses case-insensitive substrings of title and company text.

- Split on commas, trim and lowercase terms, and discard empty terms.
- Keep a listing only if every include term matches and no exclude term matches.
- Blank fields impose no restriction. Existing filters combine with these rules using AND.
- Reset pagination on keyword edits and clear both fields with Clear filters.
- Retain the existing empty-results message when no listings match.

## Consequences

- **Positive:** No new dependency or API. Pure functions enable unit tests; UI integration tests verify wiring, combined filters, pagination reset, and clearing.
- **Negative:** CLI/browser implementations can drift. Substring matching can match part of a word; it is not whole-word, regular-expression, or semantic search.
- **Follow-ups:** Test AND/OR, whitespace, case, empty terms, conflicts, and combined filters; obtain peer review before merging.

Sequential filter history, undo, zero-result rejection, and other funnel behaviors remain outside this enhancement.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Move filtering to server endpoints | Adds API work beyond this bounded change. |
| Replace general search | Removes an existing useful interaction. |
| Add a search library | No dependency is needed for substring rules. |
| Implement the complete funnel | Expands beyond the requested enhancement. |

## Links

- [US-002](../requirements/US-002-include-exclude-keywords.md)
- [US-001 criteria 2–3](../requirements/US-001-web-funnel-search.md)
- [ADR-0001](ADR-0001-web-application-architecture.md)
- [Browser implementation](../../public/app.js)
- [Course agent ADR template](../templates/adr.md)
