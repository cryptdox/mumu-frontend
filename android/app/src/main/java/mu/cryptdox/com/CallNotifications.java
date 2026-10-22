package mu.cryptdox.com;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

/** The phone's incoming-call notification: rings, shows on the lock screen, Answer / Decline. */
final class CallNotifications {
    static final String CHANNEL = "calls";
    static final String EXTRA_CALL_ID = "mu.callId";
    static final String EXTRA_PROFILE_ID = "mu.profileId";
    static final String EXTRA_ANSWER = "mu.answer";
    static final String EXTRA_DECLINE_URL = "mu.declineUrl";
    static final String EXTRA_SIG = "mu.sig";

    private CallNotifications() {}

    static int idFor(String callId) {
        return ("call:" + callId).hashCode();
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Rings when someone calls you on Mu");
        ch.setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[] { 0, 800, 800 });
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    /** From an FCM "call" message. Skips calls that already stopped ringing. */
    static void show(Context c, Map<String, String> d) {
        String callId = d.get("callId");
        String profileId = d.get("profileId");
        if (callId == null || profileId == null) return;
        long left = parseLong(d.get("expiresAt")) - System.currentTimeMillis();
        if (left < 2000) return;
        ensureChannel(c);

        String title = orElse(d.get("title"), "Mu");
        boolean video = "1".equals(d.get("video"));
        PendingIntent open = activity(c, callId, profileId, false);
        PendingIntent answer = activity(c, callId, profileId, true);
        Intent dec = new Intent(c, CallActionReceiver.class)
            .setAction(CallActionReceiver.DECLINE)
            .putExtra(EXTRA_CALL_ID, callId)
            .putExtra(EXTRA_PROFILE_ID, profileId)
            .putExtra(EXTRA_DECLINE_URL, d.get("declineUrl"))
            .putExtra(EXTRA_SIG, d.get("sig"));
        PendingIntent decline = PendingIntent.getBroadcast(c, idFor(callId), dec, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Person.Builder caller = new Person.Builder().setName(title).setImportant(true);
        Bitmap avatar = loadAvatar(d.get("avatarUrl"));
        if (avatar != null) caller.setIcon(IconCompat.createWithBitmap(avatar));

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle(title)
            .setContentText(orElse(d.get("body"), video ? "Incoming video call" : "Incoming voice call"))
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .setTimeoutAfter(left)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller.build(), decline, answer).setIsVideo(video));
        if (Build.VERSION.SDK_INT < 26) {
            b.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)).setVibrate(new long[] { 0, 800, 800 });
        }
        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT; // keep ringing until answered / declined / timed out
        try {
            NotificationManagerCompat.from(c).notify(idFor(callId), n);
        } catch (SecurityException ignored) {
            // Notifications not allowed — nothing to show.
        }
    }

    static void cancel(Context c, String callId) {
        if (callId != null) NotificationManagerCompat.from(c).cancel(idFor(callId));
    }

    private static PendingIntent activity(Context c, String callId, String profileId, boolean answer) {
        Intent i = new Intent(c, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(EXTRA_CALL_ID, callId)
            .putExtra(EXTRA_PROFILE_ID, profileId)
            .putExtra(EXTRA_ANSWER, answer);
        return PendingIntent.getActivity(c, idFor(callId) + (answer ? 2 : 1), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static Bitmap loadAvatar(String url) {
        if (url == null || url.isEmpty()) return null;
        try {
            HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
            con.setConnectTimeout(3000);
            con.setReadTimeout(3000);
            try (InputStream in = con.getInputStream()) {
                return BitmapFactory.decodeStream(in);
            } finally {
                con.disconnect();
            }
        } catch (Exception e) {
            return null;
        }
    }

    private static long parseLong(String s) {
        try {
            return Long.parseLong(s);
        } catch (Exception e) {
            return 0;
        }
    }

    private static String orElse(String s, String fallback) {
        return s == null || s.isEmpty() ? fallback : s;
    }
}
