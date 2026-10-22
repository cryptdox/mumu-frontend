package mu.cryptdox.com;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Push for the web app: the FCM token (sent to the backend), the notification permission, and
 * "callAction" events when the person taps a call notification (open / Answer).
 */
@CapacitorPlugin(name = "MuPush", permissions = @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications"))
public class MuPushPlugin extends Plugin {
    private static MuPushPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** A tapped call notification. Kept until the web app listens, so a cold start doesn't lose it. */
    static void callAction(String callId, String profileId, boolean answer) {
        if (instance == null) return;
        JSObject a = new JSObject();
        a.put("callId", callId);
        a.put("profileId", profileId);
        a.put("answer", answer);
        instance.notifyListeners("callAction", a, true);
    }

    /** A tapped message notification. */
    static void openChat(String conversationId, String profileId) {
        if (instance == null) return;
        JSObject a = new JSObject();
        a.put("conversationId", conversationId);
        a.put("profileId", profileId);
        instance.notifyListeners("openChat", a, true);
    }

    static void tokenChanged(String token) {
        if (instance == null) return;
        JSObject t = new JSObject();
        t.put("token", token);
        instance.notifyListeners("token", t, true);
    }

    @PluginMethod
    public void getToken(PluginCall call) {
        if (FirebaseApp.getApps(getContext()).isEmpty()) {
            // Built without google-services.json: push is off.
            JSObject r = new JSObject();
            r.put("available", false);
            call.resolve(r);
            return;
        }
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                call.reject("Couldn't get a push token", task.getException());
                return;
            }
            JSObject r = new JSObject();
            r.put("available", true);
            r.put("token", task.getResult());
            call.resolve(r);
        });
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            resolveGranted(call, true);
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        resolveGranted(call, getPermissionState("notifications") == PermissionState.GRANTED);
    }

    private void resolveGranted(PluginCall call, boolean granted) {
        JSObject r = new JSObject();
        r.put("granted", granted);
        call.resolve(r);
    }

    /** Android 14+: may the app show the full-screen incoming-call screen? */
    @PluginMethod
    public void fullScreenAllowed(PluginCall call) {
        boolean ok = true;
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            ok = nm == null || nm.canUseFullScreenIntent();
        }
        JSObject r = new JSObject();
        r.put("allowed", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void openFullScreenSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34) {
            Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    /** Chat opened in the app: clear its message notification. */
    @PluginMethod
    public void cancelChat(PluginCall call) {
        MessageNotifications.cancel(getContext(), call.getString("conversationId"));
        call.resolve();
    }

    /** The web app answered / declined itself: stop the phone notification too. */
    @PluginMethod
    public void cancelCall(PluginCall call) {
        CallNotifications.cancel(getContext(), call.getString("callId"));
        call.resolve();
    }
}
