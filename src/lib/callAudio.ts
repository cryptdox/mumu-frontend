import { Capacitor, registerPlugin } from "@capacitor/core";

/** Native call audio (Android app only): earpiece ⇄ loud speaker, proximity screen-off, screen kept on. */
interface CallAudioPlugin {
  start(o: { speaker: boolean }): Promise<{ speaker: boolean }>;
  setSpeaker(o: { on: boolean }): Promise<{ speaker: boolean }>;
  stop(): Promise<void>;
}

const CallAudio = registerPlugin<CallAudioPlugin>("CallAudio");

/** Browsers can't pick the earpiece; older app builds don't have the plugin. */
export const hasCallAudio = () => Capacitor.isPluginAvailable("CallAudio");

export const callAudio = {
  start: (speaker: boolean) => CallAudio.start({ speaker }).catch(() => null),
  setSpeaker: (on: boolean) => CallAudio.setSpeaker({ on }).catch(() => null),
  stop: () => CallAudio.stop().catch(() => {}),
};
