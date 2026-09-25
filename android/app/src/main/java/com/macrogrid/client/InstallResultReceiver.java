package com.macrogrid.client;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.util.Log;

/**
 * Receives the answer of Android's package installer for a session that {@link UpdaterPlugin} committed. Android first asks for
 * the person's confirmation (STATUS_PENDING_USER_ACTION, which carries the dialog's intent: it is started here), then reports
 * success or a failure. The result is passed on to the web side as an event.
 */
public class InstallResultReceiver extends BroadcastReceiver {
    private static final String TAG = "InstallResult";

    @Override
    public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);

        switch (status) {
            case PackageInstaller.STATUS_PENDING_USER_ACTION:
                Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirm == null) {
                    UpdaterPlugin.deliverInstallResult("failed", message);
                    return;
                }
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(confirm);
                } catch (RuntimeException e) {
                    Log.w(TAG, "The confirmation could not be shown", e);
                    UpdaterPlugin.deliverInstallResult("failed", message);
                }
                break;
            case PackageInstaller.STATUS_SUCCESS:
                UpdaterPlugin.deliverInstallResult("success", message);
                break;
            case PackageInstaller.STATUS_FAILURE_ABORTED:
                UpdaterPlugin.deliverInstallResult("cancelled", message);
                break;
            case PackageInstaller.STATUS_FAILURE_CONFLICT:
            case PackageInstaller.STATUS_FAILURE_INCOMPATIBLE:
                UpdaterPlugin.deliverInstallResult("incompatible", message);
                break;
            case PackageInstaller.STATUS_FAILURE_STORAGE:
                UpdaterPlugin.deliverInstallResult("storage", message);
                break;
            default:
                UpdaterPlugin.deliverInstallResult("failed", message);
        }
    }
}
