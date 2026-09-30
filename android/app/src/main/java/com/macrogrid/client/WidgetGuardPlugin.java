package com.macrogrid.client;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;

/**
 * The web side's window on {@link WidgetGuard}: it reports which plugins have live widgets, asks at start which plugins to keep off and what to tell the
 * person about the last crash, and turns a plugin back on.
 */
@CapacitorPlugin(name = "WidgetGuard")
public class WidgetGuardPlugin extends Plugin {
    private WidgetGuard guard() {
        return new WidgetGuard(getContext());
    }

    private static Set<String> idsOf(JSONArray array) {
        Set<String> out = new HashSet<>();
        if (array == null) return out;
        for (int i = 0; i < array.length(); i++) {
            try {
                out.add(array.getString(i));
            } catch (JSONException ignored) {
                // Not a string: dropped.
            }
        }
        return out;
    }

    @PluginMethod
    public void setRunning(PluginCall call) {
        guard().setRunning(idsOf(call.getArray("plugins")));
        call.resolve();
    }

    @PluginMethod
    public void state(PluginCall call) {
        WidgetGuard.State state = guard().takeState();
        JSObject result = new JSObject();
        result.put("off", new JSArray(state.off));
        result.put("probation", new JSArray(state.probation));
        if (!state.noticePlugins.isEmpty()) {
            JSObject notice = new JSObject();
            notice.put("plugins", new JSArray(state.noticePlugins));
            notice.put("at", state.noticeAt);
            result.put("notice", notice);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void turnOn(PluginCall call) {
        String plugin = call.getString("plugin");
        if (plugin != null) guard().turnOn(plugin);
        call.resolve();
    }

    @PluginMethod
    public void forgive(PluginCall call) {
        String plugin = call.getString("plugin");
        if (plugin != null) guard().forgive(plugin);
        call.resolve();
    }
}
