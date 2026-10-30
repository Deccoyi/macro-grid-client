package com.macrogrid.client;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * What the app remembers about plugin widgets across a crash of the web view (see {@link WidgetCrashRules} for the rules). It is kept in the app's
 * preferences, written synchronously, because the web side is gone when it is needed. The web side writes the list of running plugins and reads the
 * result at the next start.
 */
final class WidgetGuard {
    private static final String PREFS = "widget_guard";
    private static final String RUNNING = "running";
    private static final String OFF = "off";
    private static final String PROBATION = "probation";
    private static final String STRIKE = "strike.";
    private static final String CRASH_TIMES = "crashTimes";
    private static final String NOTICE_PLUGINS = "noticePlugins";
    private static final String NOTICE_AT = "noticeAt";

    private final SharedPreferences prefs;

    WidgetGuard(Context context) {
        this.prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** The plugins that have live widgets now; written before a worker starts. */
    void setRunning(Set<String> plugins) {
        prefs.edit().putStringSet(RUNNING, WidgetCrashRules.validIds(plugins)).commit();
    }

    /** The renderer was lost: works out who to blame, keeps the result and the notice for the next start. Returns whether the app may start again. */
    boolean onRendererGone(boolean didCrash, long now) {
        Set<String> running = new HashSet<>(prefs.getStringSet(RUNNING, new HashSet<>()));
        List<Long> crashTimes = readCrashTimes();
        WidgetCrashRules.Outcome outcome = WidgetCrashRules.onRendererGone(didCrash, running, readStrikes(), readSet(OFF), crashTimes, now);

        List<Long> times = WidgetCrashRules.pruned(crashTimes, now);
        times.add(now);
        SharedPreferences.Editor edit = prefs.edit();
        // The renderer that ran them is gone.
        edit.putStringSet(RUNNING, new HashSet<>());
        edit.putString(CRASH_TIMES, joinTimes(times));
        for (Map.Entry<String, Integer> strike : outcome.strikes.entrySet()) edit.putInt(STRIKE + strike.getKey(), strike.getValue());
        edit.putStringSet(OFF, outcome.off);
        if (!outcome.suspects.isEmpty()) {
            Set<String> probation = readSet(PROBATION);
            probation.addAll(outcome.probation);
            edit.putStringSet(PROBATION, probation);
            Set<String> notice = readSet(NOTICE_PLUGINS);
            notice.addAll(outcome.suspects);
            edit.putStringSet(NOTICE_PLUGINS, notice);
            edit.putLong(NOTICE_AT, now);
        }
        edit.commit();
        return outcome.restart;
    }

    /** What the web side needs at start: the plugins to keep off, and (once) the plugins blamed for the last crash. */
    State takeState() {
        Set<String> off = readSet(OFF);
        Set<String> probation = readSet(PROBATION);
        Set<String> noticePlugins = readSet(NOTICE_PLUGINS);
        long noticeAt = prefs.getLong(NOTICE_AT, 0L);
        // The next session gets them back; the notice is shown once.
        prefs.edit().remove(PROBATION).remove(NOTICE_PLUGINS).remove(NOTICE_AT).commit();
        return new State(off, probation, noticePlugins, noticeAt);
    }

    /** The person turned a plugin's widgets back on. */
    void turnOn(String plugin) {
        if (!WidgetCrashRules.isSuspectId(plugin)) return;
        Set<String> off = readSet(OFF);
        off.remove(plugin);
        prefs.edit().putStringSet(OFF, off).remove(STRIKE + plugin).commit();
    }

    /** A plugin's widgets ran a whole while without a crash: its strikes are forgiven. */
    void forgive(String plugin) {
        if (WidgetCrashRules.isSuspectId(plugin)) prefs.edit().remove(STRIKE + plugin).apply();
    }

    private Set<String> readSet(String key) {
        return new TreeSet<>(prefs.getStringSet(key, new HashSet<>()));
    }

    private Map<String, Integer> readStrikes() {
        Map<String, Integer> out = new HashMap<>();
        for (Map.Entry<String, ?> e : prefs.getAll().entrySet()) {
            if (e.getKey().startsWith(STRIKE) && e.getValue() instanceof Integer) out.put(e.getKey().substring(STRIKE.length()), (Integer) e.getValue());
        }
        return out;
    }

    private List<Long> readCrashTimes() {
        List<Long> out = new ArrayList<>();
        String stored = prefs.getString(CRASH_TIMES, "");
        if (stored == null || stored.isEmpty()) return out;
        for (String part : stored.split(",")) {
            try {
                out.add(Long.parseLong(part));
            } catch (NumberFormatException ignored) {
                // A damaged value is just forgotten.
            }
        }
        return out;
    }

    private static String joinTimes(List<Long> times) {
        StringBuilder sb = new StringBuilder();
        for (long t : times) sb.append(sb.length() == 0 ? "" : ",").append(t);
        return sb.toString();
    }

    static final class State {
        final Set<String> off;
        final Set<String> probation;
        final Set<String> noticePlugins;
        final long noticeAt;

        State(Set<String> off, Set<String> probation, Set<String> noticePlugins, long noticeAt) {
            this.off = off;
            this.probation = probation;
            this.noticePlugins = noticePlugins;
            this.noticeAt = noticeAt;
        }
    }
}
