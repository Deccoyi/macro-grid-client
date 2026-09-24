/**
 * Every localStorage key the app owns. The names are the on-device data format: renaming one silently
 * drops what users already have stored, so they only change together with a migration.
 * (Other modules own their private keys: settings, server list, device id, asset cache.)
 */

/** The server the app last connected to. */
export const HOST_KEY = "macro-grid.host";
/** Vertical position (0..1 of the screen height) of the drawer handle. */
export const HANDLE_Y_KEY = "macro-grid.drawerHandleY";

/** One pairing token per server host, so switching between two Macro Grid servers doesn't require re-pairing every time you go back to one you've already paired with. */
export const tokenKey = (host: string) => `macro-grid.token.${host}`;
/** Last-known layout per host, so a cold start (app relaunch, not just a live reconnect) shows the
 * deck immediately instead of the connect screen while the first real layout.full is still in flight. */
export const layoutCacheKey = (host: string) => `macro-grid.layoutCache.${host}`;
