# User Stories: Skynet Internship Finder

## US-002 — Include and exclude keywords in web search

**Story:** As a student searching for internships, I want to require relevant keywords and exclude unwanted keywords, so that I can narrow opportunities to those that fit my interests.

**Acceptance Criteria**
1. Given loaded listings and separate include/exclude keyword fields, when the student enters comma-separated include keywords, then a listing remains only if its title and company text together contain every nonempty keyword (AND matching).
2. Given loaded listings, when the student enters comma-separated exclude keywords, then a listing is removed if its title or company text contains any nonempty keyword (OR matching).
3. Given both fields contain keywords, when filtering occurs, then a listing remains only if it satisfies every include keyword and contains no exclude keyword.
4. Given keywords contain different capitalization, surrounding whitespace, or empty comma-separated entries, when filtering occurs, then matching ignores capitalization, trims surrounding whitespace, and ignores empty entries. Matching uses literal substrings, not regular expressions.
5. Given a field is blank or contains only whitespace and commas, when filtering occurs, then that field imposes no restriction.
6. Given the student also uses general search, location, type, posting-date filtering, or the Saved view, when keyword filtering occurs, then results satisfy those existing restrictions as well as the keyword restrictions. Keyword matching uses title and company only, not location, tags, or terms.
7. Given the student is viewing a later results page, when either keyword field changes, then the page resets to the first page and the result count and pagination reflect the filtered results.
8. Given filters are active, when the student selects Clear filters, then the keyword fields and existing search/filter controls are cleared, the first page is shown, and all loaded listings eligible for the current All or Saved view are restored.
9. Given no listing satisfies the active filters, when results update, then the result count is zero and the existing no-matching-opportunities message is shown.

**Priority:** Must-have (MoSCoW)

**Related requirements:** Extends [US-001 criteria 2–3](US-001-web-funnel-search.md). Implementation decision: [ADR-0002](../design/ADR-0002-client-keyword-filtering.md).

**Assumptions / dependencies:**
- Keywords are comma-separated; spaces within a keyword remain part of that keyword.
- Filtering operates on loaded listings and updates as input changes.
- Sequential funnel filtering, history, undo, and zero-result rejection remain outside this enhancement. This story preserves current empty-results behavior and does not claim US-001 criterion 6 is implemented.
- Artifact follows the repository's [course agent user-story template](../templates/user-story.md).
