package com.macrogrid.client;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GestureExclusionPlugin.class);
        registerPlugin(KioskPlugin.class);
        registerPlugin(PinnedSocketPlugin.class);
        registerPlugin(UpdaterPlugin.class);
        registerPlugin(WebPagesPlugin.class);
        registerPlugin(WidgetGuardPlugin.class);
        super.onCreate(savedInstanceState);
        lockDownWebPages();
    }

    /**
     * The second lock for the web widget: a page in an iframe gets no permission, no dialog, no file picker, no new window, no download, no location, and
     * cannot start another app (see WebPageGuard). The iframe's own sandbox is the first lock. Never add an allowNavigation list to the app config: it
     * widens the origins the native bridge is registered for (WebPagesPlugin.isSafe turns web pages off when it does).
     */
    private void lockDownWebPages() {
        Bridge bridge = getBridge();
        WebView webView = bridge.getWebView();
        bridge.setWebViewClient(new SafeWebViewClient(bridge));
        webView.setWebChromeClient(new SafeWebChromeClient(bridge));
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {});
        WebSettings settings = webView.getSettings();
        settings.setGeolocationEnabled(false);
        settings.setSupportMultipleWindows(false);
        // A page in a web widget is a third-party frame of the app's own origin. Without this its cookies are dropped, so a cookie notice
        // came back every time and a login was never kept. The cookies stay in the jar of the site that set them; the app's own data is not cookie based.
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
    }

    // Re-applies kiosk immersive mode after it gets cleared by a focus loss (notification shade, an
    // incoming call, ...) — see KioskPlugin's class doc.
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (!hasFocus) return;
        Plugin plugin = getBridge().getPlugin("Kiosk").getInstance();
        if (plugin instanceof KioskPlugin) ((KioskPlugin) plugin).reapplyIfEnabled();
    }
}
