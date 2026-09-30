package com.macrogrid.client;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

/**
 * What the app does when the web view's renderer process dies while plugin widgets were running, kept free of Android classes so it is unit tested.
 *
 * <p>The web side writes the ids of the plugins and web sites (`web:<host>`) that have live widgets to the device before each worker starts. When the renderer is lost in a
 * crash (not when the system only took its memory away), every plugin on that list is a suspect and gets a strike. A plugin that is the only
 * suspect, or has two strikes, is switched off until the person turns it back on. The other suspects stay off for the next session only, so a
 * plugin that merely ran next to the guilty one comes back. A plugin that then runs a whole session without a crash loses its strikes.
 */
final class WidgetCrashRules {
    private WidgetCrashRules() {}

    /** A crash counts as part of a loop when this many happen within {@link #LOOP_WINDOW_MS}. */
    static final int LOOP_CRASHES = 3;
    static final long LOOP_WINDOW_MS = 60_000L;
    /** A plugin with this many strikes stays off. */
    static final int STRIKES_TO_STAY_OFF = 2;

    private static final Pattern PLUGIN_ID = Pattern.compile("^[A-Za-z0-9._-]{1,64}$");
    /** A web page is blamed by its site: `web:` and the lower-case host, nothing else (an address may carry a secret). A plugin id cannot hold a colon, so the two never clash. */
    private static final Pattern WEB_ID = Pattern.compile("^web:(?:[a-z0-9._-]{1,253}|\\[[0-9a-f:.]{2,45}\\])$");

    static boolean isPluginId(String id) {
        return id != null && PLUGIN_ID.matcher(id).matches();
    }

    static boolean isWebId(String id) {
        return id != null && WEB_ID.matcher(id).matches();
    }

    /** Only ids a plugin or a web site can really have are stored; anything else the web side passes in is dropped. */
    static boolean isSuspectId(String id) {
        return isPluginId(id) || isWebId(id);
    }

    static Set<String> validIds(Iterable<String> ids) {
        Set<String> out = new TreeSet<>();
        if (ids != null) for (String id : ids) if (isSuspectId(id)) out.add(id);
        return out;
    }

    static final class Outcome {
        /** The plugins to blame; empty when nobody is (the system took the memory, or no widget was running). */
        final Set<String> suspects;
        /** Plugins that are now off until the person turns them on. */
        final Set<String> off;
        /** Plugins that stay off for the next session only. */
        final Set<String> probation;
        final Map<String, Integer> strikes;
        /** False when crashes come one after the other: the app must not start again and again. */
        final boolean restart;

        Outcome(Set<String> suspects, Set<String> off, Set<String> probation, Map<String, Integer> strikes, boolean restart) {
            this.suspects = suspects;
            this.off = off;
            this.probation = probation;
            this.strikes = strikes;
            this.restart = restart;
        }
    }

    /**
     * @param didCrash   the system's answer: true for a crash, false when the renderer was killed to free memory
     * @param running    the plugins that had live widgets when the renderer was lost
     * @param strikes    the strikes so far (not changed)
     * @param off        the plugins already off (not changed)
     * @param crashTimes when the earlier crashes happened, in milliseconds (not changed)
     */
    static Outcome onRendererGone(boolean didCrash, Set<String> running, Map<String, Integer> strikes, Set<String> off, List<Long> crashTimes, long now) {
        Map<String, Integer> nextStrikes = new HashMap<>(strikes);
        Set<String> nextOff = new TreeSet<>(off);
        Set<String> probation = new TreeSet<>();
        Set<String> suspects = new TreeSet<>();
        if (didCrash) suspects.addAll(validIds(running));
        for (String id : suspects) nextStrikes.merge(id, 1, Integer::sum);
        for (String id : suspects) {
            if (suspects.size() == 1 || nextStrikes.get(id) >= STRIKES_TO_STAY_OFF) nextOff.add(id);
            else probation.add(id);
        }
        return new Outcome(suspects, nextOff, probation, nextStrikes, !isLoop(crashTimes, now));
    }

    /** True when this crash is the {@link #LOOP_CRASHES}th within the window: the widgets are off (or were not the cause) and it still happens. */
    static boolean isLoop(List<Long> crashTimes, long now) {
        int recent = 1;
        for (long t : crashTimes) if (now - t <= LOOP_WINDOW_MS) recent++;
        return recent >= LOOP_CRASHES;
    }

    /** The crash times still worth remembering: the ones inside the window. */
    static List<Long> pruned(List<Long> crashTimes, long now) {
        List<Long> out = new ArrayList<>();
        for (long t : crashTimes) if (now - t <= LOOP_WINDOW_MS) out.add(t);
        Collections.sort(out);
        return out;
    }
}
