# Garb & Grime 1.1.1 — Actor Asset Resilience Audit

## Trigger

The supplied Foundry VTT 13 log shows `modules/garb-and-grime/templates/manager.hbs` rendering successfully and then, when the Actors tab is selected, the browser requesting many Actor portraits under `modules/retired-package/assets/portraits/`. Those requests return HTTP 404 and recur on later Manager renders.

## Root cause

Garb & Grime did not own those portrait paths, but the Manager copied `Actor.img` directly into its own `<img>` elements. Actors retained image references to a module ID that is no longer installed after the the predecessor modules → Order of Severance rename. Every Garb & Grime rerender therefore caused the browser to retry every stale URL.

## Correction

- Added a central Actor-display-image resolver used by both the Manager and Actor panel.
- Module-owned URLs are checked against Foundry's installed package registry before HTML is rendered.
- A portrait from an unavailable module is never inserted into Garb & Grime HTML.
- If the Actor's prototype Token has a usable independent texture, that is used instead.
- Otherwise Garb & Grime uses its bundled `assets/icons/actor-fallback.svg`.
- Actual load failures from paths that could not be classified in advance are cached for the browser session. Later module rerenders go directly to the fallback instead of retrying the broken URL.
- Diagnostics are grouped and deduplicated, and always start with `[garb-and-grime]`.

## Rename safety

Known retired IDs can point to known successor package IDs for diagnostics. Garb & Grime deliberately does not replace path text automatically because a package rename can also change directory layout, filenames, or asset ownership. Guessing would risk another set of requests and could hide bad Actor data.

No Actor or Token document is modified by this patch.

## Unrelated supplied-log findings

The supplied log also attributes separate issues to packages including `playlist_import`, `objects-interactions-fx`, DAE/Midi-QOL integrations, Token Replacer, and deprecated APIs in other modules. Garb & Grime does not monkey-patch, suppress, or work around those failures.
