# Garb & Grime 1.1.2 — Actors Tab Performance Audit

## Reported symptom

Opening the Cleanliness Manager's **Actors** tab can stall the UI in worlds with many Actors. Repeating the action repeats the cost. The user also suspected that the world remained slower after the tab had been opened.

## Root causes found

### Full-directory detailed hydration

Version 1.1.1 constructed a detailed row for every visible supported Actor before Handlebars rendered the Actors tab. For every Actor this included state normalization, contamination mapping, folder-path construction, localized labels, date formatting, permission checks, portrait resolution, and a roll-context evaluation that the Actors tab did not actually display.

### Full DOM and image population

Every filtered Actor became a full multi-control DOM row. `loading="lazy"` limits image transfer but does not eliminate the cost of constructing, styling, observing, and eventually decoding a very large DOM/image set.

### Repeated work

Switching away and back rebuilt the same Actor directory data. The Manager had no Actor-directory cache.

### Browser-session retention risk

Broken-image source and diagnostic-deduplication sets were session-long and unbounded. This was not the primary stall, but in a world containing many unique invalid image URLs it could grow for the lifetime of the page.

## Corrections

- The Actors tab now builds a lightweight cached index and performs full row hydration only after filtering, sorting, and pagination.
- Default page size is 40, with 20/40/80/120 options.
- Only the current page performs portrait resolution, detailed date formatting, and image diagnostics.
- The Actors tab no longer evaluates scent/roll context because that result is not displayed there. The Overview retains the evaluation it displays.
- `StateService.getDirectorySummary()` reads only primitive directory fields and avoids cloning transaction logs, masking data, and unrelated state.
- Cached Actor rows are invalidated per Actor on relevant updates and wholesale when Actor folders or world definitions change.
- The Manager clears its Actor cache, listener controller, filter timer, and focus reference when closed.
- Session image-failure and warning caches are bounded.

## Behavior deliberately preserved

- All Actor filters, regex search, nested-folder filtering, sorting, selected-Actor workflows, and bulk actions remain available.
- Existing Actor/Token/Scene flags are unchanged.
- The public API and state schema are unchanged.
- No Actor image or module flag is migrated merely for performance.
- The Overview still provides scent notices because it actually displays them.

## Expected scaling behavior

The expensive HTML/image portion is now bounded by the chosen page size instead of total Actor count. Filtering and sorting still inspect the lightweight index so the full world remains searchable, but repeated visits reuse cached summaries until affected Documents change.
