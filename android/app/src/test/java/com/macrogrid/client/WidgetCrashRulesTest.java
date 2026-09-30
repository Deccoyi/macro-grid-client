package com.macrogrid.client;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.Test;

public class WidgetCrashRulesTest {
    private static Set<String> set(String... ids) {
        return new HashSet<>(Arrays.asList(ids));
    }

    private static final Map<String, Integer> NO_STRIKES = new HashMap<>();
    private static final List<Long> NO_CRASHES = Collections.emptyList();

    @Test
    public void aSystemKillBlamesNobody() {
        WidgetCrashRules.Outcome o = WidgetCrashRules.onRendererGone(false, set("gauges"), NO_STRIKES, set(), NO_CRASHES, 1000);

        assertTrue(o.suspects.isEmpty());
        assertTrue(o.off.isEmpty());
        assertTrue(o.strikes.isEmpty());
        assertTrue(o.restart);
    }

    @Test
    public void aCrashWithNoWidgetRunningBlamesNobody() {
        assertTrue(WidgetCrashRules.onRendererGone(true, set(), NO_STRIKES, set(), NO_CRASHES, 1000).suspects.isEmpty());
    }

    @Test
    public void theOnlySuspectStaysOffUntilThePersonTurnsItOn() {
        WidgetCrashRules.Outcome o = WidgetCrashRules.onRendererGone(true, set("gauges"), NO_STRIKES, set(), NO_CRASHES, 1000);

        assertEquals(set("gauges"), o.suspects);
        assertEquals(set("gauges"), o.off);
        assertTrue(o.probation.isEmpty());
        assertEquals(Integer.valueOf(1), o.strikes.get("gauges"));
    }

    @Test
    public void severalSuspectsAreOnlyOffForOneSessionTheFirstTime() {
        WidgetCrashRules.Outcome o = WidgetCrashRules.onRendererGone(true, set("gauges", "clock", "weather"), NO_STRIKES, set(), NO_CRASHES, 1000);

        assertEquals(set("clock", "gauges", "weather"), o.suspects);
        assertTrue(o.off.isEmpty());
        assertEquals(set("clock", "gauges", "weather"), o.probation);
    }

    @Test
    public void aSuspectWithASecondStrikeStaysOffWhileTheOthersComeBack() {
        Map<String, Integer> strikes = new HashMap<>();
        strikes.put("gauges", 1);

        WidgetCrashRules.Outcome o = WidgetCrashRules.onRendererGone(true, set("gauges", "clock"), strikes, set(), NO_CRASHES, 1000);

        assertEquals(set("gauges"), o.off);
        assertEquals(set("clock"), o.probation);
        assertEquals(Integer.valueOf(2), o.strikes.get("gauges"));
    }

    @Test
    public void whatWasAlreadyOffStaysOff() {
        WidgetCrashRules.Outcome o = WidgetCrashRules.onRendererGone(true, set("clock"), NO_STRIKES, set("gauges"), NO_CRASHES, 1000);

        assertEquals(set("clock", "gauges"), o.off);
    }

    @Test
    public void idsThatCannotBePluginIdsAreIgnored() {
        WidgetCrashRules.Outcome o = WidgetCrashRules.onRendererGone(true, set("ok.plugin-1", "../etc", "", "a b", "x,y"), NO_STRIKES, set(), NO_CRASHES, 1000);

        assertEquals(set("ok.plugin-1"), o.suspects);
    }

    @Test
    public void thirdCrashInAMinuteStopsTheRestarts() {
        List<Long> earlier = Arrays.asList(10_000L, 30_000L);

        assertTrue(WidgetCrashRules.onRendererGone(true, set(), NO_STRIKES, set(), Arrays.asList(10_000L), 40_000).restart);
        assertFalse(WidgetCrashRules.onRendererGone(true, set(), NO_STRIKES, set(), earlier, 50_000).restart);
        // Crashes long ago do not count.
        assertTrue(WidgetCrashRules.onRendererGone(true, set(), NO_STRIKES, set(), earlier, 200_000).restart);
    }

    @Test
    public void oldCrashTimesAreDropped() {
        assertEquals(Arrays.asList(150_000L), WidgetCrashRules.pruned(Arrays.asList(10_000L, 150_000L), 160_000));
    }
}
