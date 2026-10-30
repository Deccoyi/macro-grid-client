package com.macrogrid.client;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
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
        routeBackToPages();
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

    /**
     * Without this, back (button or edge swipe) finished the activity even while a full-screen page such as Settings was open. A page opened
     * with useBackToClose owns a history entry marked macroGridPage: back pops that entry and the page closes. Otherwise back leaves the app as
     * before. Only the marker is checked, not WebView.canGoBack(): a web widget's iframe also adds history entries, and back must not step those.
     */
    private void routeBackToPages() {
        WebView webView = getBridge().getWebView();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                webView.evaluateJavascript(
                    "(function(){var s=history.state;if(s&&s.macroGridPage){history.back();return true}return false})()",
                    result -> {
                        if ("true".equals(result)) return;
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                );
            }
        });
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
