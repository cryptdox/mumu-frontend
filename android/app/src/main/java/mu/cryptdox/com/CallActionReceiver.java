package mu.cryptdox.com;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** "Decline" on the call notification: tells the server (signed by the push) without opening the app. */
public class CallActionReceiver extends BroadcastReceiver {
    static final String DECLINE = "mu.cryptdox.com.DECLINE_CALL";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!DECLINE.equals(intent.getAction())) return;
        String callId = intent.getStringExtra(CallNotifications.EXTRA_CALL_ID);
        CallNotifications.cancel(context, callId);
        String url = intent.getStringExtra(CallNotifications.EXTRA_DECLINE_URL);
        String profileId = intent.getStringExtra(CallNotifications.EXTRA_PROFILE_ID);
        String sig = intent.getStringExtra(CallNotifications.EXTRA_SIG);
        if (url == null || profileId == null || sig == null) return;
        PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
                con.setRequestMethod("POST");
                con.setConnectTimeout(8000);
                con.setReadTimeout(8000);
                con.setDoOutput(true);
                con.setRequestProperty("content-type", "application/json");
                byte[] body = new JSONObject().put("profileId", profileId).put("sig", sig).toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream out = con.getOutputStream()) {
                    out.write(body);
                }
                con.getResponseCode();
                con.disconnect();
            } catch (Exception ignored) {
                // Offline: the call just rings out on the caller's side.
            } finally {
                pending.finish();
            }
        }).start();
    }
}
