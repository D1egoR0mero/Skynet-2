# Sequence Diagram: Switch between light and dark themes

One diagram per scenario; this diagram covers page load with restoration plus both directions of a manual switch.

## Diagram

```
[ Student ]       [:ThemeControl #theme]    [:Browser document.body]       [:LocalStorage]          [:StyleSheet]
     :                       :                          :                          :                       :
== Fragment A: page load - first paint, then deferred restore ==
     : 1. navigate to /      :                          :                          :                       :
     |------------------------------------------------->|                          :                       :
     :                       :                          |                          :                       :
     :                       :                          | 2. first paint (:root)   :                       :
     :                       :                          |------------------------------------------------->|
     :                       :                          |                          :                       :
     :                       :                          | 3. deferred app.js runs  :                       :
     :                       :                          |----+                     :                       :
     :                       :                          |<---+                     :                       :
     :                       :                          |                          :                       :
alt [skynet-dark = "true"]
     :                       :                          | 4. getItem skynet-dark   :                       :
     :                       :                          |------------------------->|                       :
     :                       :                          | 5. return "true"         :                       :
     :                       :                          |<-------------------------|                       :
     :                       :                          |                          :                       :
     :                       :                          | 6. classList.add('dark') :                       :
     :                       :                          |----+                     :                       :
     :                       :                          |<---+                     :                       :
     :                       :                          |                          :                       :
     :                       :                          | 7. repaint under .dark   :                       :
     :                       :                          |------------------------------------------------->|
     :                       : 8. label <- "Light mode" |                          :                       :
     :                       |<-------------------------|                          :                       :
[else]
     :                       :                          | 9. getItem skynet-dark   :                       :
     :                       :                          |------------------------->|                       :
     :                       :                          | 10. return null -> false :                       :
     :                       :                          |<-------------------------|                       :
     :                       : 11. label unchanged      |                          :                       :
     :                       |<-------------------------|                          :                       :
end

== Fragment B: click light -> dark ==
     : 12. click             :                          :                          :                       :
     |---------------------->|                          :                          :                       :
     :                       | 13. toggle -> true       |                          :                       :
     :                       |------------------------->|                          :                       :
     :                       |                          | 14. setItem dark=true    :                       :
     :                       |                          |------------------------->|                       :
     :                       | 15. label <- "Light mode"|                          :                       :
     :                       |<-------------------------|                          :                       :
     :                       |                          | 16. repaint under .dark  :                       :
     :                       |                          |------------------------------------------------->|

== Fragment C: click dark -> light ==
     : 17. click             :                          :                          :                       :
     |---------------------->|                          :                          :                       :
     :                       | 18. toggle -> false      |                          :                       :
     :                       |------------------------->|                          :                       :
     :                       |                          | 19. setItem dark=false   :                       :
     :                       |                          |------------------------->|                       :
     :                       | 20. label <- "Dark mode" |                          :                       :
     :                       |<-------------------------|                          :                       :
     :                       |                          | 21. repaint under :root  :                       :
     :                       |                          |------------------------------------------------->|
```

## Notation
- header row — participants (actors and system components); components carry a `:Type` suffix, and `#theme` names the element id
- vertical line — lifeline (time flows downward)
- `|` block between two lifeline points — activation bar (the participant is executing); idle lifelines are drawn as `:` so that active segments read as bars
- `--->` solid arrow — synchronous message / call
- `<---` arrow back — return message
- `----+` / `<---+` — corner of a self-message loop (a participant acting on itself)
- number every message in time order (`1.`, `2.`, ...)
- `alt [condition]` ... `[else]` ... `end` — alternative fragment; only one branch executes
- `== ... ==` — scenario fragment label; it delimits the three sub-flows and carries no messages

## Scenario
- **Use case:** `US-003` — switch between light and dark themes (required by `US-001` acceptance criterion 10)
- **Preconditions:** The static client is served (`index.html`, `app.js`, `style.css`); `#theme` exists in the header with the light-theme tokens on `:root`; `public/app.js` has executed, binding the click handler and reading `skynet-dark` through `read(key,fallback)`; `localStorage` is either available or failing safely under that helper's `try/catch`.
- **Outcome:** `<body>` carries the `dark` class exactly when the chosen theme is dark; `skynet-dark` holds the JSON boolean `true` or `false`; the visible label reads "Light mode" (sun glyph) in the dark theme and "Dark mode" (moon glyph) in the light theme; a subsequent load restores the same theme — after first paint, which is the documented flash.

## Messages

| # | From → To | Message | Kind |
|---|-----------|---------|------|
| 1 | [ Student ] → [:Browser document.body] | navigate to `/`; the browser requests and parses `index.html` | call |
| 2 | [:Browser document.body] → [:StyleSheet] | first paint with `:root` light tokens (the module script has not run yet) | call |
| 3 | [:Browser document.body] → [:Browser document.body] | deferred module `/app.js` executes after first paint | self-call |
| 4 | [:Browser document.body] → [:LocalStorage] | `getItem('skynet-dark')` via `read()`, alt branch `skynet-dark = "true"` | call |
| 5 | [:LocalStorage] → [:Browser document.body] | returns `"true"`, which `JSON.parse` turns into `true` | return |
| 6 | [:Browser document.body] → [:Browser document.body] | `document.body.classList.add('dark')` | self-call |
| 7 | [:Browser document.body] → [:StyleSheet] | re-resolve `--panel --text --muted --line --bg` from `body.dark` and repaint (the flash ends here) | call |
| 8 | [:Browser document.body] → [:ThemeControl #theme] | set `textContent` to the sun glyph + "Light mode" | call |
| 9 | [:Browser document.body] → [:LocalStorage] | `getItem('skynet-dark')` via `read()`, else branch (key absent or invalid) | call |
| 10 | [:LocalStorage] → [:Browser document.body] | returns `null`; `read()` substitutes the fallback `false` | return |
| 11 | [:Browser document.body] → [:ThemeControl #theme] | no class applied; label stays the moon glyph + "Dark mode" | call |
| 12 | [ Student ] → [:ThemeControl #theme] | click the toggle while the light theme is active | call |
| 13 | [:ThemeControl #theme] → [:Browser document.body] | `classList.toggle('dark')` returns `true` | call |
| 14 | [:Browser document.body] → [:LocalStorage] | `setItem('skynet-dark', JSON.stringify(true))` | call |
| 15 | [:Browser document.body] → [:ThemeControl #theme] | set `textContent` to the sun glyph + "Light mode" | call |
| 16 | [:Browser document.body] → [:StyleSheet] | repaint with the `body.dark` tokens (the `aria-label` is unchanged) | call |
| 17 | [ Student ] → [:ThemeControl #theme] | click the toggle while the dark theme is active | call |
| 18 | [:ThemeControl #theme] → [:Browser document.body] | `classList.toggle('dark')` returns `false` | call |
| 19 | [:Browser document.body] → [:LocalStorage] | `setItem('skynet-dark', JSON.stringify(false))` | call |
| 20 | [:Browser document.body] → [:ThemeControl #theme] | set `textContent` to the moon glyph + "Dark mode" | call |
| 21 | [:Browser document.body] → [:StyleSheet] | repaint from `:root` tokens only | call |

Messages 9–11 belong to the `[else]` branch and are mutually exclusive with 4–8; numbering continues in reading order so every step has one identifier.
