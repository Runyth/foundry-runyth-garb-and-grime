# Garb & Grime 1.1.5 — Incremental Best-Practice Changelog

- Never access a private static class member through an ApplicationV2 action handler's instance-bound `this` receiver.
- Keep action handler instance state and class/static state explicit and separate.
- Share selected-Document resolution through receiver-independent helpers when no application state is required.
- Serialize rapid mutating UI actions when concurrent read-modify-write operations could race, while retaining every deliberate click.
- Attach a module-owned rejection boundary to asynchronous mutation actions so failures cannot become unhandled promises.
- Prefix console diagnostics with the stable module ID and pair them with localized user-facing notifications.
- Re-test persisted selection independently of the currently filtered/paginated view.
