package mu.cryptdox.com;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Chat message notifications, one per chat (newest lines stacked, like other messengers). */
final class MessageNotifications {
    static final String CHANNEL = "messages";
    static final String EXTRA_CONVERSATION_ID = "mu.conversationId";
    private static final int MAX_LINES = 6;
    private static final Map<String, List<String[]>> lines = new HashMap<>(); // conversationId → [sender, text]

    private MessageNotifications() {}

    static int idFor(String conversationId) {
        return ("chat:" + conversationId).hashCode();
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Messages", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("New chat messages");
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }

    static synchronized void show(Context c, Map<String, String> d) {
        String conversationId = d.get("conversationId");
        String profileId = d.get("profileId");
        if (conversationId == null) return;
        ensureChannel(c);

        String title = orElse(d.get("title"), "Mu");
        String sender = orElse(d.get("sender"), title);
        String body = orElse(d.get("body"), "New message");
        boolean group = !title.equals(sender);
        // Group bodies come as "Name: text" — the style shows the name itself.
        if (group && body.startsWith(sender + ": ")) body = body.substring(sender.length() + 2);

        List<String[]> list = lines.get(conversationId);
        if (list == null) lines.put(conversationId, list = new ArrayList<>());
        list.add(new String[] { sender, body });
        while (list.size() > MAX_LINES) list.remove(0);

        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(new Person.Builder().setName("You").build());
        if (group) style.setConversationTitle(title).setGroupConversation(true);
        long now = System.currentTimeMillis();
        for (String[] l : list) style.addMessage(l[1], now, new Person.Builder().setName(l[0]).build());

        Intent open = new Intent(c, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(EXTRA_CONVERSATION_ID, conversationId)
            .putExtra(CallNotifications.EXTRA_PROFILE_ID, profileId);
        PendingIntent tap = PendingIntent.getActivity(c, idFor(conversationId), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_message)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(style)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setNumber(list.size())
            .setContentIntent(tap);
        try {
            NotificationManagerCompat.from(c).notify(idFor(conversationId), b.build());
        } catch (SecurityException ignored) {
            // Notifications not allowed.
        }
    }

    /** Opened / read in the app: clear that chat's notification. */
    static synchronized void cancel(Context c, String conversationId) {
        if (conversationId == null) return;
        lines.remove(conversationId);
        NotificationManagerCompat.from(c).cancel(idFor(conversationId));
    }

    private static String orElse(String s, String fallback) {
        return s == null || s.isEmpty() ? fallback : s;
    }
}
