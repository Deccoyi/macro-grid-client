# Dead code review (left in place)

Nothing was deleted here that was not proven unused. Candidates that need a decision:

- `packages/renderer/demo` (workspace): a small demo app for the renderer; not built by CI or the app. Keep if it is still used for manual checks, otherwise remove.
- `src/i18n/index.ts` exports `language` and `Language`; nothing imports them yet. Kept as the module's public surface.
- `packages/renderer` exports (`ButtonContent`, `ImageContent`, `SliderContent`, `KnobContent`, `PlaceholderContent`, `ShadowHost`, `sanitizeWidgetCss`, `widgetBaseCss`, `usePressGesture`) are not all used by this app. They are used by the server editor, so they must be checked against the server repo before any pruning.
- `android/app/src/androidTest` and `android/app/src/test` still hold the template example tests from project creation.
- `docs/release-notes-client-v0.x-alpha.md`: one-off release text; could move to `docs/done/` if no longer edited.
