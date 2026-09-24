package com.macrogrid.client;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GestureExclusionPlugin.class);
        registerPlugin(KioskPlugin.class);
        super.onCreate(savedInstanceState);
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
