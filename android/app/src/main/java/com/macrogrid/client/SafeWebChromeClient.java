package com.macrogrid.client;

import android.net.Uri;
import android.os.Message;
import android.webkit.GeolocationPermissions;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * The framework's client answers a page's requests generously: camera and microphone are granted when the app already holds the permission (it holds the
 * camera for pairing), any other media request is granted without asking, alert/confirm/prompt open native dialogs for any frame, a file input opens the
 * system file picker and location can be switched on. Here a request that does not come from the app's own origin is refused. The app itself uses none of
 * these through the WebView (the pairing camera is a native scanner, not a page request), so nothing the app needs is lost. See {@link WebPageGuard}.
 */
final class SafeWebChromeClient extends BridgeWebChromeClient {
    private final Bridge bridge;

    SafeWebChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public void onPermissionRequest(PermissionRequest request) {
        Uri origin = request.getOrigin();
        if (origin != null && WebPageGuard.isAppOrigin(bridge, origin.toString())) super.onPermissionRequest(request);
        else request.deny();
    }

    @Override
    public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        // Neither the app nor a page may use the location.
        callback.invoke(origin, false, false);
    }

    @Override
    public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
        if (WebPageGuard.isAppOrigin(bridge, url)) return super.onJsAlert(view, url, message, result);
        result.cancel();
        return true;
    }

    @Override
    public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
        if (WebPageGuard.isAppOrigin(bridge, url)) return super.onJsConfirm(view, url, message, result);
        result.cancel();
        return true;
    }

    @Override
    public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
        if (WebPageGuard.isAppOrigin(bridge, url)) return super.onJsPrompt(view, url, message, defaultValue, result);
        result.cancel();
        return true;
    }

    @Override
    public boolean onJsBeforeUnload(WebView view, String url, String message, JsResult result) {
        result.cancel();
        return true;
    }

    /** The app has no file input, so no page may open the system file picker. */
    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
        filePathCallback.onReceiveValue(null);
        return true;
    }

    /** A request to open a new window ({@code window.open}, {@code target="_blank"}) is refused. */
    @Override
    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        return false;
    }
}
