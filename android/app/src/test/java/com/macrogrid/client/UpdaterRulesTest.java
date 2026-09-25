package com.macrogrid.client;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;

public class UpdaterRulesTest {
    @Test
    public void allowsHttpsOnGithubHostsOnly() {
        assertTrue(UpdaterRules.isAllowedUrl("https://github.com/Deccoyi/macro-grid-client/releases/download/client-v0.2.0/MacroGrid-0.2.0.apk"));
        assertTrue(UpdaterRules.isAllowedUrl("https://objects.githubusercontent.com/x/y?token=1"));
        assertTrue(UpdaterRules.isAllowedUrl("https://release-assets.githubusercontent.com/x"));
        assertTrue(UpdaterRules.isAllowedUrl("https://GitHub.com/x"));
    }

    @Test
    public void refusesEverythingElse() {
        assertFalse(UpdaterRules.isAllowedUrl(null));
        assertFalse(UpdaterRules.isAllowedUrl(""));
        assertFalse(UpdaterRules.isAllowedUrl("http://github.com/x"));
        assertFalse(UpdaterRules.isAllowedUrl("https://example.com/x"));
        assertFalse(UpdaterRules.isAllowedUrl("https://github.com.evil.example/x"));
        assertFalse(UpdaterRules.isAllowedUrl("https://evilgithub.com/x"));
        assertFalse(UpdaterRules.isAllowedUrl("https://github.com@evil.example/x"));
        assertFalse(UpdaterRules.isAllowedUrl("https://user@github.com/x"));
        assertFalse(UpdaterRules.isAllowedUrl("file:///sdcard/x.apk"));
        assertFalse(UpdaterRules.isAllowedUrl("not a url"));
    }

    @Test
    public void versionsAreThreePlainNumbers() {
        assertTrue(UpdaterRules.isPlainVersion("0.2.0"));
        assertTrue(UpdaterRules.isPlainVersion("12.34.56"));
        assertFalse(UpdaterRules.isPlainVersion("0.2.0-alpha"));
        assertFalse(UpdaterRules.isPlainVersion("../0.2.0"));
        assertFalse(UpdaterRules.isPlainVersion("0.2"));
        assertFalse(UpdaterRules.isPlainVersion(null));
    }

    @Test
    public void digestIsSixtyFourLowerCaseHexDigits() {
        assertTrue(UpdaterRules.isSha256("844f516f89149cacc58ef28e05d1a1407b5d05fc7d3f328d95c342b076ff0aec"));
        assertFalse(UpdaterRules.isSha256("844F516F89149CACC58EF28E05D1A1407B5D05FC7D3F328D95C342B076FF0AEC"));
        assertFalse(UpdaterRules.isSha256("abc"));
        assertFalse(UpdaterRules.isSha256(null));
    }

    @Test
    public void cleanupKeepsOnlyTheNamedVersionFolder() {
        String[] names = {"0.1.1", "0.2.0", "0.3.0", "notes", "0.2.0-alpha"};
        assertEquals(Arrays.asList("0.1.1", "0.3.0"), UpdaterRules.foldersToDelete(names, "0.2.0"));
    }

    @Test
    public void cleanupWithNothingToKeepRemovesAllVersionFoldersButNotOtherEntries() {
        String[] names = {"0.1.1", "0.2.0", "saved.apk"};
        assertEquals(Arrays.asList("0.1.1", "0.2.0"), UpdaterRules.foldersToDelete(names, null));
        assertEquals(Collections.emptyList(), UpdaterRules.foldersToDelete(null, null));
    }

    @Test
    public void wholeNumbersAreReadWhateverTheirBoxedType() {
        assertEquals(Long.valueOf(26774160L), UpdaterRules.asLong(26774160)); // JSON gives an Integer below 2 GB
        assertEquals(Long.valueOf(26774160L), UpdaterRules.asLong(26774160L));
        assertEquals(Long.valueOf(26774160L), UpdaterRules.asLong(26774160.0));
        assertEquals(Long.valueOf(5_000_000_000L), UpdaterRules.asLong(5_000_000_000L));
        assertNull(UpdaterRules.asLong(1.5));
        assertNull(UpdaterRules.asLong("26774160"));
        assertNull(UpdaterRules.asLong(null));
    }

    @Test
    public void apkFileNameMatchesTheReleaseAssetName() {
        assertEquals("MacroGrid-0.2.0.apk", UpdaterRules.apkFileName("0.2.0"));
    }
}
