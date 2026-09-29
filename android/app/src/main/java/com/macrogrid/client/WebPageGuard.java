package com.macrogrid.client;

import android.net.Uri;
import com.getcapacitor.Bridge;

/**
 * The second lock for the {@code web} widget (docs/plans/web-widget-plan.md in the server repository). A web widget shows an untrusted page in an
 * iframe. The iframe's own {@code sandbox} is the first lock; the Android layer must not open a hole if that ever fails, so what the framework
 * would do by default for a page (grant a permission, open the system browser or another app, show a dialog, open a file picker, open a window)
 * is refused here. See {@link SafeWebChromeClient}, {@link SafeWebViewClient} and {@link WebPagesPlugin}.
 */
final class WebPageGuard {
    private WebPageGuard() {}

    /** True when the address is on the app's own origin (the page the app itself serves), false for anything else, including a bad or empty address. */
    static boolean isAppOrigin(Bridge bridge, String url) {
        if (url == null || url.isEmpty()) return false;
        return sameOrigin(Uri.parse(bridge.getAppUrl()), Uri.parse(url));
    }

    static boolean sameOrigin(Uri a, Uri b) {
        String schemeA = a.getScheme();
        String hostA = a.getHost();
        return schemeA != null && hostA != null
            && schemeA.equalsIgnoreCase(b.getScheme())
            && hostA.equalsIgnoreCase(b.getHost())
            && effectivePort(a) == effectivePort(b);
    }

    private static int effectivePort(Uri uri) {
        if (uri.getPort() != -1) return uri.getPort();
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }

    /** A navigation that is not in the top frame (an iframe of a web widget) may only load an http or https address; anything else, an app link
     * or an intent for example, is dropped. */
    static boolean isWebScheme(Uri uri) {
        String scheme = uri.getScheme();
        return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
    }
}
