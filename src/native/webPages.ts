import { Capacitor, registerPlugin } from "@capacitor/core";

interface WebPagesPlugin {
  /** `safe` is false when the phone's system WebView is too old to keep the app's native bridge away from a web page (see WebPagesPlugin.java). */
  status(): Promise<{ safe: boolean }>;
  /** Removes the cookies, cache and stored data that embedded sites left on the phone (the app's own data stays). */
  clearData(): Promise<void>;
}

const WebPages = registerPlugin<WebPagesPlugin>("WebPages");

/** Whether web widgets may run on this phone. In a browser (the dev server, the browser deck) the browser's own rules apply, so it is always true there;
 * on a phone it is only true when the native side says the bridge cannot reach a page. A failed call counts as "not safe": a web page is never shown on a guess. */
export async function webPagesSafe(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    return (await WebPages.status()).safe === true;
  } catch {
    return false;
  }
}

/** Clears what embedded sites stored on the phone. Resolves false when it could not be done. */
export async function clearWebPageData(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    await WebPages.clearData();
    return true;
  } catch {
    return false;
  }
}
