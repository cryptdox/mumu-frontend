package mu.cryptdox.com;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** Push from the Mu backend when the app isn't open: ring for calls (and stop), show new messages. */
public class CallMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> d = message.getData();
        String kind = d.get("kind");
        if ("call".equals(kind)) {
            // App on screen: it rings itself (live connection), no double ring.
            if (!MainActivity.inForeground) CallNotifications.show(this, d);
        } else if ("message".equals(kind)) {
            if (!MainActivity.inForeground) MessageNotifications.show(this, d);
        } else if ("call-stop".equals(kind)) {
            CallNotifications.cancel(this, d.get("callId"));
        }
    }

    @Override
    public void onNewToken(String token) {
        MuPushPlugin.tokenChanged(token);
    }
}
