package com.macrogrid.client;

import android.graphics.Rect;
import android.os.Build;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;
import java.util.List;

/**
 * Tells Android not to intercept the edge-swipe-back gesture inside a given screen rectangle — the
 * profile-drawer handle sits near the screen edge, where Android's own gesture-nav back swipe normally
 * wins over any touch listener in the WebView. System gesture exclusion rects (API 29+) are the
 * documented way an app opts a specific region out of that: see
 * https://developer.android.com/reference/android/view/View#setSystemGestureExclusionRects(java.util.List)
 * No-ops below API 29 — there's no equivalent there, the handle just has to live with the conflict.
 */
@CapacitorPlugin(name = "GestureExclusion")
public class GestureExclusionPlugin extends Plugin {

    @PluginMethod
    public void setZone(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.resolve();
            return;
        }

        double top = call.getDouble("top", 0.0);
        double height = call.getDouble("height", 0.0);
        double width = call.getDouble("width", 24.0);
        boolean rightEdge = Boolean.TRUE.equals(call.getBoolean("rightEdge", true));

        getActivity().runOnUiThread(() -> {
            WebView webView = getBridge().getWebView();
            if (webView == null) {
                call.resolve();
                return;
            }
            float density = getContext().getResources().getDisplayMetrics().density;
            int t = (int) Math.round(top * density);
            int h = (int) Math.round(height * density);
            int w = (int) Math.round(width * density);
            int viewWidth = webView.getWidth();

            Rect rect = rightEdge
                ? new Rect(Math.max(0, viewWidth - w), t, viewWidth, t + h)
                : new Rect(0, t, w, t + h);
            webView.setSystemGestureExclusionRects(Collections.singletonList(rect));
            call.resolve();
        });
    }

    @PluginMethod
    public void clear(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.resolve();
            return;
        }
        getActivity().runOnUiThread(() -> {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                List<Rect> empty = Collections.emptyList();
                webView.setSystemGestureExclusionRects(empty);
            }
            call.resolve();
        });
    }
}
