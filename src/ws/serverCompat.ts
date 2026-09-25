import { parseVersion } from "../update/releaseVersion";

/**
 * How this app's server version relates to what the app needs (docs/versioning.md). The app declares the oldest Macro Grid it
 * works with in `package.json` (`macroGrid`, MAJOR.MINOR.PATCH); it works with every later version of the same MAJOR, the same rule a
 * server-side plugin follows.
 *
 * - `ok`: the server is at least that version and has the same MAJOR (or its version is not readable, which is never a reason to warn).
 * - `server-too-old`: the server has an older version or an older MAJOR, so the person has to update Macro Grid on the computer.
 * - `app-too-old`: the server has a newer MAJOR, so the person has to update this app.
 *
 * A label such as "-beta" on the server version is ignored.
 */
export type ServerCompat = "ok" | "server-too-old" | "app-too-old";

export function checkServerVersion(serverVersion: string, required: string): ServerCompat {
  const server = parseVersion(serverVersion);
  const wanted = parseVersion(required);
  if (!server || !wanted) return "ok";
  if (server.major !== wanted.major) return server.major > wanted.major ? "app-too-old" : "server-too-old";
  if (server.minor !== wanted.minor) return server.minor > wanted.minor ? "ok" : "server-too-old";
  return server.patch >= wanted.patch ? "ok" : "server-too-old";
}
