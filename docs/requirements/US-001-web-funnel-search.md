# User Stories: Skynet Internship Finder

## US-001 — Web-based funnel search for internship listings

**Story:** As a Virginia Tech student, I want to narrow internship listings through a web page instead of a terminal, so that I can find relevant internships without installing or running a command-line tool.

**Acceptance Criteria**
1. Given a student opens the Skynet Internship Finder web page in a browser, when the page has finished loading the available listings, then the page shows the number of active internship listings loaded and presents exactly four filter options — Major / field of study, Keywords (include and exclude), Company type / industry, and Location — and shows no internship results yet.
2. Given the student has chosen the Keywords (include and exclude) filter and entered `the, walt, disney, company` as include keywords with the exclude field left blank, when the filter is applied, then the pool keeps only listings whose displayed title and company together contain all four keywords, so a listing for "The Walt Disney Company" survives and a listing reading only "Walt Disney Company" is not in the pool.
3. Given the student has chosen the Keywords (include and exclude) filter and entered `senior, manager, director` as exclude keywords with the include field left blank, when the filter is applied, then every listing whose displayed title or company contains "senior", "manager", or "director" is removed, so "Senior Software Engineer", "Engineering Manager", and "Director of Engineering" are gone while a listing titled "Software Engineer" that contains none of those words remains.
4. Given the student is looking at the current pool, when the student applies one filter, then that filter is evaluated against only the listings still in the pool — listings removed by earlier filters are never restored or reconsidered — and the page reports how many listings remain after that single filter.
5. Given the student has applied more than one filter, when the page shows the current pool, then the applied filters are listed in the order they were applied, numbered from the first filter to the most recent, and each entry shows the values the student entered for that filter.
6. Given the student is looking at the current pool, when the student applies a filter that would leave no listings, then the filter is rejected, the page states that the filter would leave zero results and was not applied, the pool and the applied-filter list are exactly as they were before the attempt, and the student can choose a different filter.
7. Given the current pool contains more results than fit on one page, when the results are shown, then at most 20 listings appear on a page, a "Page X of Y" indicator reports the current page and the total number of pages (the result count divided by 20, rounded up), and moving forward and backward through the pages shows every listed result exactly once, with no result repeated or skipped across pages.
8. Given the listing source cannot be reached or does not return a usable set of listings, when the student loads the page or asks for the listings, then the page shows an error that names the source that failed and says the listings could not be retrieved, shows no results, and does not present any previously loaded or partially loaded listings as if they were current.

**Priority:** Must-have (MoSCoW)

**Related requirements:** None yet. Derives from the PM2.1 CLI-to-web enhancement goal; design decision recorded in ADR-0001 (`docs/design/ADR-0001-web-application-architecture.md`).

**Assumptions / dependencies:**
- At least one filter must be applied before any results are shown, matching the current command-line prototype's behavior.
- The SimplifyJobs internship listing source stays publicly fetchable, with no authentication, account, or API key required.
- The web application runs on Node.js 24 with ES modules.
- The default page size is 20 listings per page.
- The underlying listing data carries no separate field-of-study or industry attribute, so Major / field of study, Company type / industry, and include/exclude keyword filters are matched against the listing's title and company text, while Location is matched against the listing's location text.
