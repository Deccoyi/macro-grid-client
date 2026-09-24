# Refactor notes (branch refactor/cleanup)

Behavior is meant to be identical. Short list of what moved or changed.

## Structure
- `src/App.tsx` (935 lines) split: connection state into `hooks/useServerConnection.ts`, swipe handling into `hooks/useDeckSwipe.ts`, wake lock into `hooks/useKeepAwake.ts`.
- Screens in `src/screens/` (`ConnectScreen`, `DeckScreen`, `QrScanScreen`, moved from `QrScan.tsx`); components in `src/components/` (`ProfileDrawer`, `DrawerHandle`, `StatusBadge`, `ActionErrorToast`, `SettingsPanel`).
- Gesture and timing constants in `src/constants.ts`; palette and shared style fragments in `src/theme.ts`; inline style objects hoisted into typed `CSSProperties` constants.
- `src/storage/` holds `storage.ts` (the one place with the localStorage try/catch), `keys.ts`, `layoutCache.ts`, `servers.ts`, `settings.ts`, `deviceId.ts`.
- `src/native/` holds `bridge.ts` (`callNative`), `kiosk.ts`, `gestureExclusion.ts`, `orientation.ts`.

## Unchanged contracts
- localStorage key names, protocol message and field names, native plugin names (`GestureExclusion`, `Kiosk`) and their methods, and all `@macro/renderer` exports are unchanged.

## Small behavior notes
- Storage writes that used to be unguarded (host, pairing token, device id) are now best-effort like the others; a full or blocked storage no longer throws there.
- The keep-awake effect now depends on "a profile is loaded" instead of the profile object, so a layout patch no longer releases and re-acquires the wake lock.
- The layout cache is parsed once at start-up instead of three times.

## Removed
- `@capacitor/app` dependency (no code used it), its `licenses/capacitor-app/` text and notice entry; the Android plugin lists were regenerated with `cap sync` and a debug APK still assembles.
- `export` dropped from symbols only used in their own file (`hasAsset`, `getAsset`, and a few types).

## Tooling
- Unit tests for the app code (`vitest.config.ts`, `src/**/*.test.ts`): layout patch, asset cache, connection dispatch, storage, servers, layout cache. `npm test` runs them and the renderer suite.
- `npm run typecheck` now also typechecks the renderer package (CI runs it).
- Renderer `peerDependencies` for React/React DOM now say `^19.0.0` (they said `^18.3.0` while the code is built and tested on 19).
