import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { api } from "@/lib/api";
import { mu } from "@/api/mu";
import { callStore } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { startCall } from "@/pages/chats/CallScreen";

/** Native push (Android app only): calls ring on the phone even when the app is closed. */
interface MuPushPlugin {
  getToken(): Promise<{ available: boolean; token?: string }>;
  requestPermission(): Promise<{ granted: boolean }>;
  fullScreenAllowed(): Promise<{ allowed: boolean }>;
  openFullScreenSettings(): Promise<void>;
  cancelCall(o: { callId: string }): Promise<void>;
  cancelChat(o: { conversationId: string }): Promise<void>;
  addListener(event: "openChat", fn: (a: { conversationId: string; profileId?: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "callAction", fn: (a: { callId: string; profileId: string; answer: boolean }) => void): Promise<PluginListenerHandle>;
  addListener(event: "token", fn: (t: { token: string }) => void): Promise<PluginListenerHandle>;
}

const MuPush = registerPlugin<MuPushPlugin>("MuPush");
export const hasPush = () => Capacitor.isPluginAvailable("MuPush");

const savePushToken = (token: string | null) => api("/api/me/devices/current/push", { method: "PUT", body: { token } }).catch(() => {});

/** Stop the phone's ringing notification for a call (answered / declined in the app). */
export const cancelCallNotification = (callId: string) => (hasPush() ? MuPush.cancelCall({ callId }).catch(() => {}) : undefined);

/**
 * Once signed in: ask for the notification permission, send this phone's push token to the
 * server, and handle taps on notifications (message → that chat; call → ringing screen, Answer → join).
 */
export function usePhonePush() {
  const { profile, switchProfile } = useAuth();
  const signedIn = !!profile;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Looking at a chat clears its message notification.
  const openChatId = /^\/chats\/([^/]+)/.exec(pathname)?.[1];
  useEffect(() => {
    if (openChatId && hasPush()) void MuPush.cancelChat({ conversationId: openChatId }).catch(() => {});
  }, [openChatId]);

  useEffect(() => {
    if (!signedIn || !hasPush()) return;
    const sub = MuPush.addListener("openChat", ({ conversationId, profileId }) => {
      if (profileId && profileId !== profile?.profileId) switchProfile(profileId);
      navigate(`/chats/${conversationId}`);
    });
    return () => void sub.then((s) => s.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one listener per sign-in
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !hasPush()) return;
    void (async () => {
      const { granted } = await MuPush.requestPermission().catch(() => ({ granted: false }));
      if (!granted) return;
      const { available, token } = await MuPush.getToken().catch(() => ({ available: false, token: undefined }));
      if (available && token) await savePushToken(token);
    })();
    const sub = MuPush.addListener("token", ({ token }) => void savePushToken(token));
    return () => void sub.then((s) => s.remove());
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !hasPush()) return;
    const sub = MuPush.addListener("callAction", async ({ callId, profileId, answer }) => {
      if (profileId && profileId !== profile?.profileId) switchProfile(profileId);
      if (answer) return void startCall.join(callId, profileId);
      // Opened (not answered): show the in-app ringing banner if it's still ringing.
      const call = await mu.calls.get(callId).catch(() => null);
      if (call?.status === "RINGING" && !callStore.get().active) callStore.set((c) => ({ ...c, incoming: { ...call, to: profileId } }));
    });
    return () => void sub.then((s) => s.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one listener per sign-in
  }, [signedIn]);
}
