# ADR-0001: Serve the internship finder as a server-rendered Node/Express web application

- **Status:** Proposed
- **Date:** 2026-10-22
- **Deciders:** Team lead, Backend/API owner, Frontend/UX owner, QA/test owner

## Context

**Current state.** The repository holds a terminal-only prototype of the internship finder. Its strengths are structural, not cosmetic:

- **A pure filter core.** `src/filters.js` exposes predicate functions that take a pool array plus user input and return a new array. There is no I/O, no rendering, and no terminal dependency in that module, so each filter step is unit-testable in isolation.
- **A documented source adapter contract.** `src/sources/simplify.js` states the listing shape that the rest of the system depends on — title, company, location, URL, posting date, terms, and a lowercased free-text tag field — and notes that additional sources are expected to conform to the same shape.
- **A funnel interaction with real semantics.** `src/index.js` applies exactly one filter step at a time to the current pool, records a human-readable label per applied step, keeps a stack of prior pools so "undo last filter" restores the previous pool exactly, refuses a step that would leave zero results (the pool is unchanged and the user is told to try something else), and requires at least one applied filter before results are shown.
- **Pagination with a stable page indicator.** `src/display.js` slices the pool at 20 listings per page and shows "Page X of Y", with navigation that clears and redraws the terminal.

What the prototype cannot do is reach the audience it was built for. It requires a Node 24 installation and an interactive terminal; it cannot be linked, bookmarked, or shared with a classmate, an advisor, or a recruiter; it is unusable on phones and tablets and on locked-down machines where students cannot install a runtime. The product intent in `README.md` — survey-driven internship search that improves on the existing campus tooling — is a browser experience, so the terminal was always a stand-in for a web interface.

**Constraints.**

- **Team and schedule:** three students working part-time, delivering one semester milestone at a time. Any option that adds a second toolchain or a new deployment target competes for the same limited hours.
- **Runtime:** Node.js 24 with ES modules; the project is `"type": "module"`. The current dependencies (`chalk`, `cli-table3`, `inquirer`) are terminal presentation libraries and have no role in a browser UI.
- **Data:** a single external public listing source, fetched over HTTPS as a static JSON document that is already intended to be consumed programmatically. There is no backend, no database, and no authentication in the system today.
- **Behavior that must be preserved:** include keywords combine with AND, exclude keywords combine with OR, each step narrows the current pool (never widens it), a step that would empty the pool is rejected rather than accepted, undo restores the exact previous pool, and at least one filter step is required before results.
- **Budget:** no paid hosting services. The deployment target must fit a no-cost tier.

**Quality attributes driving the decision.**

| Attribute | Why it matters here |
|---|---|
| Usability and accessibility for a browser-only audience | The interface exists to be used by students on whatever device they have, including assistive technology. |
| Maintainability for a three-person team | Two interfaces (CLI and web) and a small number of shared modules must stay understandable by whoever picks up the milestone next. |
| Testability of filter logic | The funnel semantics are the product's actual value; they must be verifiable without driving a UI. |
| Graceful behavior when the upstream source is down | The listing source is outside our control and can fail or change shape at any time. |

**Facts, assumptions, and unknowns.**

- *Fact:* `src/filters.js` and `src/sources/simplify.js` contain no terminal-specific code; only `src/index.js` and `src/display.js` are tied to the terminal.
- *Fact:* the filter core operates on an in-memory array of the whole pool, so any server-side design must hold the pool somewhere for the duration of a request.
- *Fact:* the existing dependencies are presentation-only for the terminal and provide nothing reusable in a browser.
- *Assumption:* expected traffic is small — a course demonstration plus classmates — but this is unmeasured, so no capacity or cost claim in this record rests on it.
- *Unknown, must be measured:* upstream fetch latency and freshness, upstream failure rate, server render time per page, and the actual limits of whichever no-cost hosting tier is selected. Nothing in this decision depends on a specific value for these; they are required inputs to the eventual deployment and caching decisions.

## Decision

We will serve the internship finder as a Node/Express web application that renders the search page on the server and uses small amounts of vanilla JavaScript plus JSON endpoints for filter application; filtering runs server-side by reusing `src/filters.js` and `src/sources/simplify.js` unchanged.

At the design level the application has one rendering surface and two JSON interactions:

- **Initial page request.** The server obtains the current listing pool, applies no filter, and renders the page: the total listing count and the four filter options the prototype already offers (major/field of study, include/exclude keywords, company type/industry, location). The filter summary area and the results area are rendered as server-produced HTML, so the page is meaningful and navigable before any script runs.
- **Filter-step endpoint.** A request carries one filter step — the filter kind plus the user's values — together with the ordered list of steps already applied. The server replays that list from the full pool through the existing predicates, applies the new step, and returns JSON containing the resulting applied-filter list, the remaining count, an acceptance flag, and the first page of results. A step that would leave zero results is refused: the returned state is the state before the step, and the response carries the same "that filter would leave 0 results" guidance the CLI prints. Undo is expressed as the same endpoint with the last step removed from the list, so the server re-derives the earlier pool by replay rather than by trusting client-held data. Because the applied list travels with each request, no per-user session state is required.
- **Results-page endpoint.** A request carries the applied-filter list and a page number; the server slices the current pool at 20 listings per page and returns that slice with the page indicator "Page X of Y" and the total count.
- **Browser behavior.** Vanilla JavaScript collects the filter form, calls the two endpoints, and replaces the filter summary and results regions by hand. No framework, no bundler, no client build step. Browsers call only the application's own origin, so no cross-origin configuration is introduced.
- **CLI retained as reference.** `src/index.js` and `src/display.js` stay in the repository as the executable specification of funnel, undo, and zero-result behavior, and as the parity target for tests. They are not the deployment artifact.

## Consequences

- **Positive:**
  - No client build toolchain: nothing to install, version, or debug beyond Node and the server dependencies, which matches the team's available hours.
  - No cross-origin problem: the browser talks only to the same origin that served the page, so no CORS policy, token scheme, or proxy layer is needed.
  - `src/filters.js` and the listing contract in `src/sources/simplify.js` are reused unchanged, so the funnel semantics stay in one place and remain unit-testable without HTTP or DOM.
  - One deployable artifact: a single Node process serving HTML and JSON.
  - Server-side ownership of the listing pool makes a shared fetch cache or scheduled refresh possible, which is what allows the upstream source to fail without taking the page down.
  - Pages are linkable and usable on mobile browsers, which is the primary reason for the change.
- **Negative:**
  - Dynamic interaction is hand-written DOM and JavaScript rather than a component framework; state updates, focus handling, and error display are our responsibility on every screen.
  - The server now owns request handling and any listing cache state, so concurrency and cache invalidation become real concerns that the CLI never had.
  - UI work becomes manual and therefore slower per screen than a component library would make it.
  - The CLI and web paths can drift unless they continue to share `src/filters.js` and the listing contract; duplication of filter logic would silently break parity.
- **Follow-ups:**
  - Define the HTTP contract for a filter step and for a results page: request fields, response fields, and the representation of an accepted versus refused step.
  - Decide the caching and refresh policy for the upstream listings, including what the page shows when the source is unreachable.
  - Run an accessibility and usability-heuristic review of the generated page before the milestone demo.
  - Keep `src/filters.js` and the listing contract as the single shared source of truth, and treat any change to them as a change to both interfaces.
  - Add tests for the server routes covering accepted steps, refused zero-result steps, undo, and page boundaries.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| React + Vite SPA with the existing filter core moved behind a new JSON API | Introduces a second toolchain (bundler, client dependency tree, separate build output) and two deployable artifacts for a three-person team on a one-semester cadence, while the required interaction — pick a filter, see a smaller pool, undo — needs no component model. It also makes the initial page dependent on client script execution, which works against the accessibility goal. |
| Next.js full-stack | Its value is server rendering, routing, and build conventions we would use a small fraction of; the framework's routing and rendering model would have to be learned and maintained by the whole team, and it adds framework-specific conventions around the very endpoints we want to keep thin. The cost is disproportionate to a single search page. |
| Client-only SPA fetching the SimplifyJobs JSON directly from the browser | Puts the upstream document in the browser's origin and dependency path: the source is a third-party host we do not control, so availability, response shape, and any access policy become a runtime failure mode on every page load, and the user-visible failure would be an empty page. It also forces the filter logic to be duplicated into the browser or newly bundled for it, breaking the "reuse `src/filters.js` unchanged" requirement, and it gives up any server-side cache. |
| Keeping the CLI and wrapping it / shipping a terminal-only tool | Does not address the reason for the change: no linkable URL, no use on a phone or a machine without Node, and no way to share a filtered view. A wrapper around terminal output would also inherit its raw-mode keyboard handling and terminal-specific rendering, none of which survives in a browser. |

## Links

- US-001 — web funnel search requirement: `docs/requirements/US-001-web-funnel-search.md`
- `README.md` — product intent, include-AND/exclude-OR semantics, pagination and example output
- `src/filters.js` — pure filter predicates reused unchanged by the server
- `src/sources/simplify.js` — listing contract and the single upstream source
- `src/display.js` — terminal pagination behavior that the web page indicator and 20-per-page slicing must match
