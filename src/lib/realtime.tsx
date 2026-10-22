import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import type { InfiniteData } from "@tanstack/react-query";
import { config } from "@/config";
import { queryClient } from "./query";
import { refreshOnce } from "./api";
import { endSessionHere, getAccessToken, useAuth } from "./auth";
import { deviceId } from "./device";
import { createStore } from "./store";
import type { CallInfo, Conversation, LiveStream, Message, RtcJoin } from "@/api/types";

// ── App-wide realtime state ─────────────────────────────────────────────────

/** conversationId → profileIds typing (cleared after 4 s of silence). */
export const typingStore = createStore<Record<string, string[]>>({});
/** A call ringing for you, and the call you're in. */
export const callStore = createStore<{ incoming: CallInfo | null; active: { call: CallInfo; rtc: RtcJoin } | null }>({ incoming: null, active: null });
export const unreadStore = createStore({ notifications: 0 });

/** Anything showing a connection state: the requests list, profiles, connection lists. */
export function refreshConnections() {
  for (const key of ["friend-requests", "profile-view", "people"]) void queryClient.invalidateQueries({ queryKey: [key] });
}
/** Set when one of your lives moved to another of your devices. */
export const liveTakeoverStore = createStore<{ liveStreamId: string } | null>(null);

/** How long an incoming call rings (matches the server's CALL_RING_SECONDS default). */
const RING_MS = 45_000;

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
function markTyping(conversationId: string, profileId: string) {
  const key = `${conversationId}:${profileId}`;
  typingStore.set((s) => ({ ...s, [conversationId]: [...new Set([...(s[conversationId] ?? []), profileId])] }));
  clearTimeout(typingTimers.get(key));
  typingTimers.set(key, setTimeout(() => clearTyping(conversationId, profileId), 4000));
}
function clearTyping(conversationId: string, profileId: string) {
  typingStore.set((s) => ({ ...s, [conversationId]: (s[conversationId] ?? []).filter((id) => id !== profileId) }));
}

type Pages = InfiniteData<Message[], string | undefined>;

/** Insert or replace a message in a chat's cached pages (newest first). */
export function upsertMessage(m: Message) {
  queryClient.setQueryData<Pages>(["messages", m.conversationId], (data) => {
    if (!data) return data;
    const exists = data.pages.some((p) => p.some((x) => x.messageId === m.messageId));
    if (exists) return { ...data, pages: data.pages.map((p) => p.map((x) => (x.messageId === m.messageId ? m : x))) };
    const [first = [], ...rest] = data.pages;
    return { ...data, pages: [[m, ...first], ...rest] };
  });
}

function patchChats(fn: (c: Conversation) => Conversation) {
  queryClient.setQueryData<Conversation[]>(["chats"], (list) => list?.map(fn));
}

// ── Socket ──────────────────────────────────────────────────────────────────

const SocketCtx = createContext<Socket | null>(null);
export const useSocket = () => useContext(SocketCtx);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user) return;
    const s = io(config.apiUrl, {
      transports: ["websocket"],
      // Read the token on every (re)connect — it's refreshed in the background.
      auth: (cb) => cb({ token: getAccessToken(), deviceId: deviceId() }),
    });

    s.on("connect_error", async (err) => {
      if (err.message === "unauthorized" && (await refreshOnce())) s.connect();
    });
    s.on("connect", () => {
      // Catch up on anything missed while offline.
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    });

    s.on("message:new", (m: Message) => {
      upsertMessage(m);
      clearTyping(m.conversationId, m.sender.profileId);
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
    });
    s.on("message:updated", (m: Message) => {
      upsertMessage(m);
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
    });
    s.on("read", (r: { conversationId: string }) => void queryClient.invalidateQueries({ queryKey: ["chat", r.conversationId] }));
    s.on("conversation:updated", (r: { conversationId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({ queryKey: ["chat", r.conversationId] });
    });
    s.on("typing", (t: { conversationId: string; profileId: string }) => markTyping(t.conversationId, t.profileId));
    s.on("presence", (p: { profileId: string; online: boolean }) =>
      patchChats((c) => (c.partner?.profileId === p.profileId ? { ...c, partner: { ...c.partner, online: p.online } } : c)),
    );
    s.on("notification", (n: { type?: string }) => {
      unreadStore.set((u) => ({ ...u, notifications: u.notifications + 1 }));
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // Connect requests/accepts change buttons on screen right away (requests list, profiles).
      if (n?.type === "FRIEND_REQUEST" || n?.type === "FRIEND_ACCEPTED" || n?.type === "NEW_FOLLOWER") refreshConnections();
    });

    s.on("call:ring", (call: CallInfo) => {
      if (callStore.get().active) return;
      callStore.set((c) => ({ ...c, incoming: call }));
      // Stop ringing after a while even if nobody tells us (group calls keep going without you).
      setTimeout(() => callStore.set((c) => (c.incoming?.callId === call.callId ? { ...c, incoming: null } : c)), RING_MS);
    });
    s.on("call:updated", (call: CallInfo) => {
      const over = call.status === "ENDED" || call.status === "MISSED";
      // A 1:1 call that turned ONGOING was answered (maybe on your other device) — stop ringing.
      // A group call turning ONGOING just means someone else picked up: keep ringing here.
      const answeredElsewhere = call.status === "ONGOING" && call.conversation?.type !== "GROUP";
      callStore.set((c) => ({
        incoming: c.incoming?.callId === call.callId && (over || answeredElsewhere) ? null : c.incoming,
        active: c.active?.call.callId === call.callId ? (over ? null : { ...c.active, call }) : c.active,
      }));
    });

    s.on("live:takeover", (t: { liveStreamId: string; deviceId: string }) => {
      if (t.deviceId !== deviceId()) liveTakeoverStore.set({ liveStreamId: t.liveStreamId });
    });
    s.on("device:signed-out", (d: { deviceId: string }) => {
      if (d.deviceId === deviceId()) endSessionHere();
    });

    s.on("live:updated", (stream: LiveStream) => {
      queryClient.setQueryData(["live", stream.liveStreamId], stream);
      void queryClient.invalidateQueries({ queryKey: ["live"], exact: true });
    });

    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <SocketCtx.Provider value={socket}>{children}</SocketCtx.Provider>;
}
