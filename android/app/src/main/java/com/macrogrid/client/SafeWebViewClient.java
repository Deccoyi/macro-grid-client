package com.macrogrid.client;

import android.app.Activity;
import android.content.Context;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * The framework's client sends every navigation to another host out of the app: it opens the system browser or whatever program is registered for
 * the link ({@code tel:}, {@code sms:}, {@code intent:}, a store link). It may be asked about an iframe's navigation too, and the iframe {@code sandbox}
 * does not stop a frame from navigating itself, so a click or a script inside a web widget could start another app. Here a navigation that is not in
 * the top frame loads in place when it is http or https and is dropped otherwise; it never starts anything. The top frame behaves as before.
 */
final class SafeWebViewClient extends BridgeWebViewClient {
    static final String CRASH_PREFS = "render_crash";

    private final Bridge ownBridge;

    SafeWebViewClient(Bridge bridge) {
        super(bridge);
        this.ownBridge = bridge;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (request.isForMainFrame()) return super.shouldOverrideUrlLoading(view, request);
        // true = "handled, do not load"; false = load it here, in the frame.
        return !WebPageGuard.isWebScheme(request.getUrl());
    }

    /**
     * The web view's renderer process can die (a page or a widget script ran out of memory). Left unhandled, Android then closes the whole app.
     * Returning true tells the system the loss is handled; the dead WebView cannot be reused, so the activity is recreated with a fresh one. The time
     * is kept in the {@value #CRASH_PREFS} preferences so the next start can tell the person what happened.
     */
    @Override
    public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        Log.w("SafeWebViewClient", "render process gone, crashed=" + detail.didCrash());
        Activity activity = ownBridge.getActivity();
        activity.getSharedPreferences(CRASH_PREFS, Context.MODE_PRIVATE).edit().putLong("renderGoneAt", System.currentTimeMillis()).apply();
        activity.runOnUiThread(activity::recreate);
        return true;
    }
}
