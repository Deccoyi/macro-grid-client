package com.macrostation.client;

import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hides the status bar and navigation bar (Android's "immersive sticky" mode) so the deck fills the
 * whole screen and a stray edge-swipe doesn't permanently bring the system bars back. This is what
 * "kiosk mode" means for this app — there's no app-triggerable screen-pinning/task-lock API on Android
 * (that requires the user's own long-press-on-Overview gesture), just full-screen immersion.
 *
 * The system clears the immersive flags whenever the window loses and regains focus (e.g. pulling down
 * the notification shade, an incoming call), so {@link MainActivity#onWindowFocusChanged} re-applies the
 * last requested state via {@link #reapplyIfEnabled()} — otherwise kiosk mode would silently "turn off"
 * the first time the user's finger strays near the top of the screen.
 */
@CapacitorPlugin(name = "Kiosk")
public class KioskPlugin extends Plugin {
    private boolean immersiveEnabled = false;

    @PluginMethod
    public void setImmersive(PluginCall call) {
        immersiveEnabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> apply(immersiveEnabled));
        call.resolve();
    }

    void reapplyIfEnabled() {
        if (immersiveEnabled) getActivity().runOnUiThread(() -> apply(true));
    }

    private void apply(boolean enabled) {
        View decor = getActivity().getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = decor.getWindowInsetsController();
            if (controller == null) return;
            if (enabled) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
            } else {
                controller.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
            }
        } else {
            //noinspection deprecation
            decor.setSystemUiVisibility(enabled
                ? (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN)
                : View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }
}
