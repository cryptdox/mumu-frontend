package mu.cryptdox.com;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** On screen right now — the web app rings by itself then, so push doesn't double-ring. */
    static volatile boolean inForeground;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CallAudioPlugin.class);
        registerPlugin(MuPushPlugin.class);
        super.onCreate(savedInstanceState);
        handleCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCallIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        inForeground = true;
    }

    @Override
    public void onPause() {
        inForeground = false;
        super.onPause();
    }

    /**
     * Opened from a notification. Message → open that chat. Call → show over the lock screen and
     * hand the call to the web app.
     */
    private void handleCallIntent(Intent intent) {
        String chatId = intent == null ? null : intent.getStringExtra(MessageNotifications.EXTRA_CONVERSATION_ID);
        if (chatId != null) {
            intent.removeExtra(MessageNotifications.EXTRA_CONVERSATION_ID);
            MuPushPlugin.openChat(chatId, intent.getStringExtra(CallNotifications.EXTRA_PROFILE_ID));
            return;
        }
        String callId = intent == null ? null : intent.getStringExtra(CallNotifications.EXTRA_CALL_ID);
        if (callId == null) return;
        String profileId = intent.getStringExtra(CallNotifications.EXTRA_PROFILE_ID);
        boolean answer = intent.getBooleanExtra(CallNotifications.EXTRA_ANSWER, false);
        intent.removeExtra(CallNotifications.EXTRA_CALL_ID); // not again on rotation / recreate
        CallNotifications.cancel(this, callId); // the app rings / joins from here
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        MuPushPlugin.callAction(callId, profileId, answer);
    }
}
