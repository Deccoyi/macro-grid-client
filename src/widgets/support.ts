/**
 * Whether this WebView can run plugin widgets: a canvas that can be handed to a worker (`OffscreenCanvas`), sandboxed frames and workers.
 * A phone that cannot says nothing of the capability, and the server then draws the placeholder instead of sending a widget's code.
 */
export function pluginWidgetsSupported(): boolean {
  try {
    return (
      typeof Worker === "function" &&
      typeof OffscreenCanvas === "function" &&
      typeof HTMLCanvasElement !== "undefined" &&
      typeof HTMLCanvasElement.prototype.transferControlToOffscreen === "function" &&
      typeof MessageChannel === "function"
    );
  } catch {
    return false;
  }
}
