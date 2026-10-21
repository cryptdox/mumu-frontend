package mu.cryptdox.com;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.PowerManager;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Call audio for the web app: earpiece vs loud speaker (headsets win over the earpiece),
 * screen off near the ear on earpiece calls, and the screen kept on during a call.
 */
@CapacitorPlugin(name = "CallAudio")
public class CallAudioPlugin extends Plugin {
    private static final int[] HEADSETS = {
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_BLE_HEADSET,
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
    };

    private AudioManager audio;
    private PowerManager.WakeLock proximity;
    private boolean active;
    private boolean speaker;

    @Override
    public void load() {
        audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        PowerManager power = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (power != null && power.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) {
            proximity = power.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "mumu:call-proximity");
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        active = true;
        keepScreenOn(true);
        audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
        route(call.getBoolean("speaker", false));
        call.resolve(state());
    }

    @PluginMethod
    public void setSpeaker(PluginCall call) {
        if (active) route(call.getBoolean("on", false));
        call.resolve(state());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        release();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        release();
    }

    private void release() {
        if (!active) return;
        active = false;
        speaker = false;
        if (Build.VERSION.SDK_INT >= 31) audio.clearCommunicationDevice();
        else audio.setSpeakerphoneOn(false);
        audio.setMode(AudioManager.MODE_NORMAL);
        setProximity(false);
        keepScreenOn(false);
    }

    private void route(boolean toSpeaker) {
        speaker = toSpeaker;
        boolean headset = false;
        if (Build.VERSION.SDK_INT >= 31) {
            AudioDeviceInfo target = null;
            for (AudioDeviceInfo d : audio.getAvailableCommunicationDevices()) {
                if (toSpeaker && d.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) target = d;
                if (!toSpeaker && isHeadset(d.getType())) {
                    target = d;
                    headset = true;
                    break;
                }
                if (!toSpeaker && target == null && d.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) target = d;
            }
            if (target != null) audio.setCommunicationDevice(target);
        } else {
            headset = audio.isWiredHeadsetOn() || audio.isBluetoothScoOn();
            audio.setSpeakerphoneOn(toSpeaker);
        }
        // Earpiece only: blank the screen when it's against your ear.
        setProximity(!toSpeaker && !headset);
    }

    private static boolean isHeadset(int type) {
        for (int t : HEADSETS) if (t == type) return true;
        return false;
    }

    private void setProximity(boolean on) {
        if (proximity == null) return;
        if (on && !proximity.isHeld()) proximity.acquire(4 * 60 * 60 * 1000L);
        else if (!on && proximity.isHeld()) proximity.release();
    }

    private void keepScreenOn(boolean on) {
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    private JSObject state() {
        JSObject o = new JSObject();
        o.put("speaker", speaker);
        return o;
    }
}
