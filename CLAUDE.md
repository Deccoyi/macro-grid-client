# Project rules

## Language
- Everything in the project is written in **English**: code, identifiers (variables, functions, types, components, files), comments, documentation, changelogs, log messages and commit messages. Do not use Turkish in any of them.
- User-facing UI text is the only exception, and only through the i18n files (for example `tr.ts` / `en.ts`), never hard-coded in components.
- Existing Turkish text is migrated gradually: when you come across Turkish in code, comments, identifiers or docs while working or reviewing, translate it on the way (only the part you are already touching). Do not start a dedicated bulk-translation pass or a translation-only agent.
- The conversation with the user is in Turkish. That does not affect anything written into the project.

## Changelogs
- Keep two changelogs in `docs/`: `CHANGELOG.md` (short, public, for non-developers) and `CHANGELOG-developer.md` (only what developers need and git history cannot carry).
- `CHANGELOG.md` uses short, simple sentences, one line per change ("New / Changed / Fixed"). No code, file or API names. Leave out small bug fixes and stability or internal improvements.
- `CHANGELOG-developer.md` records only: changes to the WebSocket protocol or the capabilities the app announces to the server, breaking or incompatible changes, migrations, and anything a plugin author, integrator or maintainer has to do differently. Everything else (how a feature was built, refactors, internal details, small fixes) goes in the commit message and the pull request description, not in this file. Entries already there stay as they are.
- When a change is finished, update `CHANGELOG.md` under `[Unreleased]`, and `CHANGELOG-developer.md` only if the change is one of the kinds above. See `docs/versioning.md` and the `commit-all` skill.

## Versions, releases and signing
- Any version, release, tag or signing work: read the central guide first, `docs/guides/release.md` in the server repository (`macro-grid`, https://github.com/Deccoyi/macro-grid/blob/main/docs/guides/release.md). It has the tag table, the order of a release and the signing keys. `docs/release.md` here only has the APK-specific steps; do not copy the shared content into it.
- The app's own version is `version` in `package.json`; the Macro Grid it needs is `macroGrid` there. Signing keys never go into the repository or into chat.
- Tags and APK releases are outward-facing: ask the owner before each one.

## Commits
- Conventional Commits (`type(scope): description`), always in English.

## Names
- Never mention third-party product or brand names in code, comments, docs or commits. Describe the pattern generically.