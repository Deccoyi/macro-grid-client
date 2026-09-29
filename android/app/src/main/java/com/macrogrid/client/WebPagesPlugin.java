package com.macrogrid.client;

import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import android.webkit.WebView;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native side of the {@code web} widget: tells the app whether a web page may run on this phone at all, and clears what embedded sites stored.
 *
 * <p>The app's web layer talks to native code through a bridge object. On a current system WebView the framework registers it only for the app's own
 * origin and only for the top frame, so a page in an iframe cannot see it. When the WebView lacks the "web message listener" feature the framework falls
 * back to an older way of registering the bridge that is visible in <em>every</em> frame with no origin check: a page in a web widget could then call every
 * native method of the app. In that case (or when the app config lists extra allowed origins, which widens the safe mode) {@link #status} answers
 * {@code safe: false} and the app draws no web widget at all.
 */
@CapacitorPlugin(name = "WebPages")
public class WebPagesPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("safe", isSafe(getBridge()));
        call.resolve(result);
    }

    /** True only when the bridge is registered per origin (not the all-frames fallback) and only for the app's own origin. */
    static boolean isSafe(Bridge bridge) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return false;
        if (bridge.getConfig().isUsingLegacyBridge()) return false;
        Uri app = Uri.parse(bridge.getAppUrl());
        for (String rule : bridge.getAllowedOriginRules()) {
            if (!WebPageGuard.sameOrigin(app, Uri.parse(rule))) return false;
        }
        return true;
    }

    /** Removes cookies, the cache and the stored data of every origin except the app's own (its storage holds the device token). */
    @PluginMethod
    @SuppressWarnings("deprecation")
    public void clearData(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                CookieManager cookies = CookieManager.getInstance();
                cookies.removeAllCookies(null);
                cookies.flush();
                WebView view = getBridge().getWebView();
                view.clearCache(true);
                Uri app = Uri.parse(getBridge().getAppUrl());
                WebStorage storage = WebStorage.getInstance();
                storage.getOrigins(origins -> {
                    if (origins == null) return;
                    for (Object origin : origins.keySet()) {
                        if (!WebPageGuard.sameOrigin(app, Uri.parse(String.valueOf(origin)))) storage.deleteOrigin(String.valueOf(origin));
                    }
                });
                call.resolve();
            } catch (RuntimeException ex) {
                call.reject("Could not clear the web page data.");
            }
        });
    }
}
