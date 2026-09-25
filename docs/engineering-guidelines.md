# Engineering guidelines (client)

Applied checklist for this repo. Kept short on purpose; each item is something the code actually follows.

## TypeScript
- `strict` stays on, plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. The renderer also uses `noUncheckedIndexedAccess`.
- Prefer `interface` for object shapes that are extended or implemented, `type` for unions and aliases.
- Narrow unknown data (parsed JSON, wire messages) at the boundary; do not spread `as` casts through the code.
- Export only what another file imports. A symbol used in one file stays private to it.
- Use `satisfies` to check a literal against a type without widening it.
- Constants (limits, timings, storage keys) live in a named module, never as magic numbers inline.

## React 19
- One component per file, named like the file; files grouped by role: `screens/`, `components/`, `hooks/`.
- Keep state as close as possible to where it is used; lift it only when two siblings need it.
- Extract stateful logic into a `useXxx` hook with one responsibility; avoid hooks that own unrelated concerns.
- Props are typed with a named interface next to the component.
- Effects only synchronise with something outside React (sockets, timers, native bridges, window events) and always return a cleanup.
- Static style objects are hoisted to module-level typed `CSSProperties` constants; only truly dynamic values are built inline.
- Every hook runs on every render; early returns come after all hooks.

## Storage helpers
- All `localStorage` access goes through one small module that catches the "unavailable or full" error and offers typed JSON read/write. Storage key names are part of the on-device data format and never change without a migration.
- Storage is best-effort: a failed write never breaks the UI.

## Native bridge wrappers
- One file per native plugin under `src/native/`; the plugin interface is declared next to `registerPlugin`.
- Wrappers are fire-and-forget functions that no-op off-device and swallow bridge rejections, so callers stay platform-agnostic.
- Native plugin names and method names are a contract with the Java side and do not change silently.

## Vite and build
- The app is built with the bundler's defaults; environment-specific behaviour goes through `import.meta.env`, not ad-hoc flags.
- Typecheck, unit tests and the production build all run in CI on every change; the renderer package has its own typecheck.

## Networking
- One class owns the socket, the reconnect backoff and message dispatch. UI code talks to it through typed callbacks and small command methods.
- Pure logic (patching a layout, resolving asset references) stays free of I/O so it can be unit tested.
