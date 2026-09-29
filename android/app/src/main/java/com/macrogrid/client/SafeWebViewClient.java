package com.macrogrid.client;

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
    SafeWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (request.isForMainFrame()) return super.shouldOverrideUrlLoading(view, request);
        // true = "handled, do not load"; false = load it here, in the frame.
        return !WebPageGuard.isWebScheme(request.getUrl());
    }
}
