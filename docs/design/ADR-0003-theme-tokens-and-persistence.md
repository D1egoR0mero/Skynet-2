# ADR-0003: Implement light and dark themes with CSS custom properties and browser-local persistence

- **Status:** Accepted
- **Date:** 2026-11-18
- **Deciders:** Frontend/UX owner, QA/test owner, Requirements analyst, System architect

## Context

This is a retrospective record. The web client already ships a light/dark theme toggle; this document fixes the single decision of *how* that theme is expressed and remembered. The browser experience, the three-file static client, and the JSON API were settled in `ADR-0001`; no part of that architecture changes here.

Facts that shape the decision:

- `public/style.css` line 1 puts the light palette on `:root` as custom properties — `--panel:#fff; --text:#202b43; --muted:#758197; --line:#e8edf5; --blue:#5865e8; --bg:#f7f9fd` — and the `body` rule on line 3 consumes them via `body{margin:0;background:var(--bg);color:var(--text)}`. The sidebar, cards, controls, tags, stats, and the `.empty` state are all painted through `var(--panel)`, `var(--text)`, `var(--muted)`, and `var(--line)`.
- Line 4 re-declares exactly five of those six properties on `body.dark`: `--panel:#202a40; --text:#edf2ff; --muted:#a7b3ca; --line:#35425a; --bg:#151d2d`. `--blue` is not re-declared, so the brand accent stays `#5865e8` in both themes (brand icon, eyebrow text, `h1 em`).
- The control is declared in `public/index.html` as `<button id="theme" class="theme" aria-label="Toggle dark mode">☾ &nbsp; Dark mode</button>`. The `aria-label` is a static attribute; only the button's text content is ever rewritten.
- `public/app.js` line 6 defines `read(key,fallback)`, which wraps `JSON.parse(localStorage.getItem(key))` in `try/catch` and coalesces `null` to the fallback. Line 8 restores state: `if(read('skynet-dark',false))document.body.classList.add('dark')`. Lines 53–54 are the handler and its load-time correction: toggle the class, write `localStorage.setItem('skynet-dark', JSON.stringify(dark))`, set the visible label to `'☀  Light mode'` or `'☾  Dark mode'`, and fix the label when the class is already present.
- `public/index.html` loads `<script type="module" src="/app.js">` as the last element of `<body>`. Module scripts are deferred, so the document is parsed and painted with `:root` light tokens before line 8 can run.
- There is no bundler. `server.js` maps only three static assets (`const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}`) — the same file-map constraint recorded in `ADR-0002`. No server, API, cache-format, or CLI change is involved, and the terminal program in `src/` has no theme concept at all.
- The token layer is not complete. `.company-logo{background:#eef0ff;color:#5865e8}` bypasses it and is not overridden under `.dark`; `.save.is-saved` (`#e45a7b`), `.online` (`#2c9c77`), and `.dot` (`#36bc91`) are likewise fixed colours. `.nav.active` is the exception that was handled: `.dark .nav.active{background:#303d6b;color:#bdc7ff}` overrides it explicitly.
- `color-scheme` is never declared, so native `<select>` popups, scrollbars, and form-control chrome keep light rendering while the page is dark.
- There is no `prefers-color-scheme` handling, no authentication, and no account model, so the theme is per-browser and per-device.
- Behaviour is already covered: `test/pm21-ui.test.js`, test "PM2.1 favorites and theme persist and restore through storage", drives the control through the DOM harness in `test/helpers/browser.js`; `docs/testing/PM2.1-test-coverage.md` maps `public/app.js` theme behaviour to that test.
- `US-001` acceptance criterion 10 requires the toggle and its persistence; `US-003` is the dedicated requirements artifact for theme switching.

Assumptions:

- Two themes are sufficient for this milestone; a "system/auto" third state is out of scope.
- The five re-declared properties are the surfaces the team treats as themed; the accent is deliberately shared across themes, and the fixed accents on the logo tile, save heart, and online dot are accepted as brand marks rather than theme colours.
- The preference is display-only and non-sensitive, so client storage is an appropriate home for it, and a student clearing site data accepting a reset to light is acceptable.
- The audience's browsers support CSS custom properties and `Element.classList`, both long-baseline features.

Quality attributes driving the decision: **immediacy** of switching (a theme change must be visible in the same interaction, with no reload, no network call, and no re-render of the listing cards), **maintainability without a build step** (one stylesheet, one token block per theme, served unchanged by `server.js`), **preservation of the no-API architecture** (a presentation preference must not create a new endpoint, cache field, or account concept), **privacy** (the preference stays on the device), and **testability** through the existing deterministic DOM harness.

## Decision

We will implement theming as a single token layer with a class-scoped override: `:root` holds the light values, `body.dark` re-declares the same custom properties, one click handler in `public/app.js` toggles the `dark` class on `<body>` and persists the boolean as JSON under `skynet-dark`, and a load-time `read('skynet-dark', false)` re-applies the class. No server, API, cache, or CLI change is made.

The path from token layer to restored theme:

```
  Student
     |
     |  click #theme  (app.js:53)
     v
  theme handler
     |
     +--> document.body.classList.toggle('dark')
     |          |
     |          v
     |    body.dark overrides --panel --text --muted --line --bg   (style.css:4)
     |          |                                    (--blue unchanged)
     |          v
     |    every rule using var(--*) repaints with the dark values
     |
     +--> localStorage.setItem('skynet-dark', JSON.stringify(dark))  (key: "true"/"false")
                |
                |  next page load, after first paint
                v
        read('skynet-dark', false) -> body.classList.add('dark')    (app.js:8)
```

Every themed rule reads a custom property, so a theme change is one class mutation rather than a per-component decision; `read()` is the only storage access on the restore path and falls back to light on a missing key, invalid JSON, or a storage error.

## Consequences

- **Positive:** The entire page flips from five property re-declarations, so no component rule is duplicated per theme and the single stylesheet stays compatible with the no-bundler file map. Switching is immediate — one class toggle plus one storage write inside the click handler, with no reload, no network round trip, and no re-render of the card list. Persistence is device-local and needs no schema, account, or API surface. `read()` degrades safely: a missing key, malformed JSON, or a blocked storage API yields the light theme instead of an error. The feature added no dependency and no build step, and it is regression-protected by an existing deterministic test that needs no live browser.
- **Negative:** First paint for a dark-theme user is light. Because `/app.js` is a deferred module, the class from line 8 lands after the initial paint, so reloading produces a brief light flash before the dark palette applies; the flash scales with how long the module takes to execute, and it cannot be removed from inside `app.js`. The accessible name is decoupled from the visible label: `aria-label="Toggle dark mode"` never changes, so assistive technology always announces the same string while the visible text alternates between "Dark mode" and "Light mode". The token layer is incomplete — `.company-logo` keeps `#eef0ff`/`#5865e8` under dark and reads as a bright tile on the dark panel, `.save.is-saved`, `.online`, and `.dot` keep fixed accents, and `--blue` is shared, so those surfaces were never reviewed against a dark palette. `color-scheme` is never declared, so native `<select>` popups and scrollbars stay light while the page is dark. The theme ignores the operating-system preference because there is no `prefers-color-scheme` rule, and there is no account-level preference, so a student's choice does not follow them to another browser or machine and clearing site data reverts them to light. Only two themes exist, and there is no way to track the system setting automatically.
- **Follow-ups:** Declare `color-scheme: light` on `:root` and `color-scheme: dark` on `body.dark` so native controls and scrollbars match the page. Replace the static `aria-label` with one that updates with the state (or move to `aria-pressed` with a stable name), and decide whether the visible label should name the current theme or the mode the click will switch to. Tokenise `.company-logo`, and either tokenise or explicitly document `.save.is-saved`, `.online`, and `.dot`. Attack the flash if it is judged unacceptable: an inline bootstrap in `<head>` that applies the stored class before first paint, or a `prefers-color-scheme` default with an explicit user override — either must keep the no-bundler constraint and the existing test green. Consider `prefers-color-scheme` as the default when `skynet-dark` is absent. If the storage key, the class name, or the label text changes, update `US-003`, `test/pm21-ui.test.js`, and `docs/testing/PM2.1-test-coverage.md` together.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| A second stylesheet for dark mode, swapped at runtime via the `<link>` element | Doubles the CSS to maintain: either every component rule is duplicated in a second file that silently drifts from the first, or the dark file must be generated by a build step the project does not have. A runtime swap also costs a fetch and a re-parse at the moment of switching, so it is less immediate than a class toggle, and it would require `server.js`'s explicit three-asset file map to grow a fourth asset. |
| `prefers-color-scheme` only, with no manual control | Follows the operating system but removes student choice: on a shared or lab machine set to light, a student who wants dark has no way to get it, and `US-001` acceptance criterion 10 requires a toggle. It also has nothing to persist, so it cannot express a per-device choice that differs from the OS. |
| Server- or account-stored preference (cookie, session, or user record) | There are no accounts, no authentication, and no user store (`ADR-0001`); creating one for a display flag adds identity, storage, and privacy surface far out of proportion to the feature, plus a request on the load path. A static-file server that serves three assets has no place to apply a per-user preference anyway. |
| `data-theme="dark"` attribute on `<html>` instead of a class on `<body>` | Functionally equivalent and arguably tidier, but the shipped CSS scopes the override with `body.dark` and the descendant selector `.dark .nav.active`, so adopting the attribute means rewriting the token block and that override for no user-visible gain. It also moves the DOM write from `<body>`, which `app.js` already owns, to `<html>`, and it invalidates the class assertion in `test/pm21-ui.test.js` — cost with no benefit. |
| A CSS-only checkbox hack (`#theme:checked ~ ...`) | Removes the handler but cannot persist across reloads at all, failing the storage criterion, and cannot rewrite the button's own label because a checkbox has no text content to rewrite. It also forces the control to precede everything it styles in the DOM, which the current header layout does not do. |

## Links

- `US-003` — theme switching requirement: `docs/requirements/US-003-theme-switching.md`
- `US-001` — web search and filtering requirement, acceptance criterion 10 (theme toggle and persistence): `docs/requirements/US-001-web-funnel-search.md`
- `ADR-0001` — web application architecture (buildless static client over a small JSON API): `docs/design/ADR-0001-web-application-architecture.md`
- `public/app.js` — `read()` (line 6), load-time restore (line 8), toggle/persist/label handler and label correction (lines 53–54)
- `public/style.css` — `:root` light tokens (line 1), `body.dark` overrides (line 4), fixed accents (`.company-logo`, `.save.is-saved`, `.online`, `.dot`)
- `public/index.html` — `#theme` control with its static `aria-label`, and the deferred `<script type="module" src="/app.js">`
- `test/pm21-ui.test.js` — test "PM2.1 favorites and theme persist and restore through storage"
- `docs/testing/PM2.1-test-coverage.md` — maps `public/app.js` theme behaviour to that test
- `docs/design/theme-toggle-sequence.md` — sequence diagram for switching themes
