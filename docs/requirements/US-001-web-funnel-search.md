# User Stories: Skynet Internship Finder

## US-001 — Web-based internship search and filtering

**Story:** As a Virginia Tech student, I want to search and narrow internship listings on a web page instead of a terminal, so that I can find relevant internships from any device without installing or running a command-line tool.

**Acceptance Criteria**

1. Given a student opens the Skynet Internship Finder web page, when the listings have finished loading, then the Explore opportunities view shows the total number of available roles, the matching-results count, and the saved count, and lists the newest listings immediately with no filter required; listings are ordered by posting date newest first, listings with no known posting date come after dated listings, and each card shows the title, company, location, term when present, posting date when known, and an "View opportunity" link when a usable URL exists.
2. Given the Explore view is shown, when the student types text into the search box, then only listings whose title, company, tags, or terms contain that text (case-insensitive) remain, the matching-results count updates as each character is typed, and the results return to page 1.
3. Given the Explore view is shown, when the student enters text into Location, then only listings whose location contains that text (case-insensitive) remain, the count updates, and the results return to page 1.
4. Given the Explore view is shown, when the student selects an Opportunity type, then Internships keeps listings whose title or term contains "intern", Co-ops keeps listings whose title or term matches co-op, coop, or co op, Full-time keeps listings whose title or term matches full-time, full time, new grad, graduate, or entry level, and All types applies no restriction.
5. Given the Explore view is shown, when the student selects a Posted-since window, then only listings whose posting date falls within the last 7, 30, or 90 days remain, listings with no known posting date are excluded while a window is selected, and Any date removes the restriction.
6. Given any listing is displayed, when the student activates its save control, then that listing is added to (or removed from) Saved roles without changing the other filters, the saved count updates immediately, the Saved roles view shows exactly the saved listings, and the saved set survives a page reload; a listing keeps the same saved identity across refreshes when its company, title, and URL are unchanged.
7. Given the matching results exceed one page, when the results are shown, then at most 12 listings appear per page with a "Page X of Y" indicator, Previous is unavailable on the first page and Next is unavailable on the last, moving between pages shows every matching listing exactly once with none repeated or skipped, and changing any filter or switching between Explore and Saved returns the results to page 1.
8. Given any filters are applied, when the student activates Clear filters, then the search text, Location, Opportunity type, and Posted-since controls are emptied, the full listing set returns at page 1, and the selected Explore or Saved view together with the saved listings is preserved.
9. Given the page is loading or the listings request fails, when the student opens the page or activates Refresh, then a loading status is announced while the request is in flight; on success the status reports the number of matches, the number of newly discovered listings at the last sync, and the last-updated time, and warns when some sources are unavailable; on failure the page shows the error message naming the problem and does not present previously loaded or partially loaded listings as current.
10. Given the page is in either colour theme, when the student activates the theme control, then the page switches between light and dark presentation, the control's label reflects the new mode, and the choice survives a page reload.

**Priority:** Must-have (MoSCoW) — the PM2.1 enhancement exists to move the product from a terminal prototype to the browser experience described in the README.

**Related requirements:** ADR-0001 — `docs/design/ADR-0001-web-application-architecture.md` (architecture this story is built on). US-002 — `docs/requirements/US-002-keyword-filtering.md` — defines the include/exclude keyword enhancement, which is delivered on the `pm2.2-include-exclude-keywords` branch and is not yet merged into `main`; it is therefore outside this story's shipped scope. ADR-0002 records that enhancement's design.

**Assumptions / dependencies:**
- The browser obtains listings only from the application's own `GET /api/listings` endpoint; it never calls a third-party listing provider directly.
- Each listing exposes `title`, `company`, `location`, `url`, `datePosted`, `terms`, `tags`, `source`, and a stable `id`; `tags` is the lowercased title plus company text.
- Saved roles and the colour theme are stored in browser local storage, so they are per-browser and are not shared between devices.
- The deployment runs a single Node.js process with no database and no user accounts; listing data is public.
- Known defect on `main`: `server.js` imports `src/sources/boards.js`, which is absent from this branch, so the web server does not start and the PM2.1 source tests fail until that adapter is restored. The `pm2.2-include-exclude-keywords` branch restores it; this story's criteria assume the server starts.
- The keyword include/exclude fields described in the README's feature list are specified separately in US-002 and are not part of the controls covered above.
