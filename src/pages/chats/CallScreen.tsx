import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AudioRenderer, Controls, MumuRoom, VideoTile, useParticipants, useRoom, type Participant } from "mumu-rtc/react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { mu } from "@/api/mu";
import type { CallInfo } from "@/api/types";
import { useAuth } from "@/lib/auth";
import { callStore } from "@/lib/realtime";
import { useStore } from "@/lib/store";
import { errorMessage } from "@/lib/api";
import { rtcErrorText } from "@/lib/rtcError";
import { Avatar, cx, toast } from "@/components/ui";
import { useKeepVideosPlaying } from "@/lib/keepPlaying";

/** Start or join a call; the call screen opens as soon as there's a token. */
export const startCall = {
  async start(conversationId: string, type: "AUDIO" | "VIDEO") {
    if (callStore.get().active) return toast("You're already in a call");
    try {
      const { call, rtc } = await mu.calls.start(conversationId, type);
      callStore.set({ incoming: null, active: { call, rtc } });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  },
  async join(callId: string) {
    try {
      const { call, rtc } = await mu.calls.join(callId);
      callStore.set({ incoming: null, active: { call, rtc } });
    } catch (err) {
      toast(errorMessage(err), "error");
      callStore.set((c) => ({ ...c, incoming: null }));
    }
  },
};

/** Soft two-tone ring made with WebAudio (no audio files). */
function useRingtone(on: boolean, outgoing = false) {
  useEffect(() => {
    if (!on) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    const beep = () => {
      if (!ctx) return;
      const now = ctx.currentTime;
      for (const [i, f] of (outgoing ? [440] : [660, 880]).entries()) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, now + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.08, now + i * 0.18 + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + i * 0.18 + (outgoing ? 0.9 : 0.16));
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 1);
      }
    };
    beep();
    const t = setInterval(beep, outgoing ? 3000 : 1600);
    return () => {
      clearInterval(t);
      void ctx?.close();
    };
  }, [on, outgoing]);
}

function useProfileName(profileId: string) {
  const q = useQuery({ queryKey: ["profile", profileId], queryFn: () => mu.profiles.get(profileId), staleTime: 5 * 60_000 });
  return q.data;
}

function Tile({ p, big }: { p: Participant; big?: boolean }) {
  const profile = useProfileName(p.userId);
  const name = p.isLocal ? "You" : profile?.displayName ?? "…";
  const cameraOn = !!p.tracks.camera && !p.muted.camera;
  return (
    <div className={cx("relative overflow-hidden rounded-3xl bg-[#273c75]", big ? "h-full min-h-0 w-full" : "aspect-[3/4] w-24 sm:aspect-video sm:w-48")}>
      {cameraOn ? (
        <VideoTile participant={p} showLabel={false} className="!aspect-auto h-full !rounded-none" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          {profile ? <Avatar profile={profile} size={big ? 112 : 56} /> : <span className="size-14 rounded-full bg-white/10" />}
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2.5 py-0.5 text-xs font-medium text-white">
        {name}
        {p.muted.mic && " · muted"}
      </span>
    </div>
  );
}

/** Grid columns: phones in portrait stack 2 people and go 2-wide after that; wide screens go wider. */
function columns(count: number, portrait: boolean) {
  if (portrait) return count <= 2 ? 1 : 2;
  return count <= 1 ? 1 : count <= 4 ? 2 : 3;
}

function usePortrait() {
  const query = "(orientation: portrait)";
  const [portrait, setPortrait] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setPortrait(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return portrait;
}

function Stage({ call }: { call: CallInfo }) {
  const participants = useParticipants();
  const { state, error } = useRoom();
  const failure = state !== "connected" && state !== "connecting" && state !== "reconnecting" ? rtcErrorText(error) : null;
  const remote = participants.filter((p) => !p.isLocal);
  const local = participants.find((p) => p.isLocal);
  const waiting = remote.length === 0;
  const portrait = usePortrait();
  const tiles = local ? [...remote, local] : remote;
  useKeepVideosPlaying(".mu-call-stage");
  useRingtone(waiting && call.status === "RINGING" && state === "connected", true);

  return (
    <div className="mu-call-stage relative flex min-h-0 flex-1 flex-col p-3 sm:p-4">
      <AudioRenderer />
      {waiting ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-white">
          {call.conversation && <CallTitle call={call} />}
          <p className="max-w-sm px-6 text-center text-white/70">{failure ? failure : state !== "connected" ? "Connecting…" : call.status === "RINGING" ? "Ringing…" : "Waiting for others…"}</p>
        </div>
      ) : remote.length === 1 ? (
        // 1:1 — the other person fills the screen, you're a small picture in the corner.
        <>
          <Tile p={remote[0]} big />
          {local && (
            <div className="absolute bottom-5 right-5 shadow-2xl sm:bottom-auto sm:right-7 sm:top-7">
              <Tile p={local} />
            </div>
          )}
        </>
      ) : (
        // Group — everyone (you included) is a tile, so nothing covers anyone.
        <div className="grid min-h-0 flex-1 auto-rows-fr gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${columns(tiles.length, portrait)}, minmax(0, 1fr))` }}>
          {tiles.map((p) => (
            <Tile key={p.peerId} p={p} big />
          ))}
        </div>
      )}
    </div>
  );
}

function CallTitle({ call }: { call: CallInfo }) {
  const caller = call.startedBy;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {caller && <Avatar profile={caller} size={96} />}
      <p className="text-2xl font-bold text-white">{call.conversation?.type === "GROUP" ? call.conversation.title : caller?.displayName}</p>
    </div>
  );
}

/** Full-screen call. Hanging up ends 1:1 calls for both; in groups you just leave. */
export function ActiveCall() {
  const { active } = useStore(callStore);
  const ended = useRef(false);
  const { profile } = useAuth();
  useEffect(() => {
    ended.current = false;
  }, [active?.call.callId]);
  const publish = useMemo(() => ({ camera: active?.call.type === "VIDEO", mic: true }), [active?.call.type]);
  if (!active) return null;

  const hangUp = () => {
    if (ended.current) return;
    ended.current = true;
    const { call } = active;
    callStore.set((c) => ({ ...c, active: null }));
    const canEnd = call.conversation?.type !== "GROUP" || call.startedBy?.profileId === profile?.profileId;
    if (canEnd) void mu.calls.end(call.callId).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy">
      <MumuRoom apiUrl={active.rtc.apiUrl} token={active.rtc.token} publish={publish} onError={(e) => toast(e.message, "error")}>
        <Stage call={active.call} />
        <div className="safe-bottom flex justify-center pb-4">
          <Controls onLeave={hangUp} screenShare={active.call.type === "VIDEO"} />
        </div>
      </MumuRoom>
    </div>
  );
}

/** "X is calling" — shown over any screen. */
export function IncomingCall() {
  const { incoming, active } = useStore(callStore);
  const { profile, switchProfile } = useAuth();
  useRingtone(!!incoming && !active);
  if (!incoming || active) return <ActiveCall />;
  const caller = incoming.startedBy;
  const decline = () => {
    callStore.set((c) => ({ ...c, incoming: null }));
    void mu.calls.decline(incoming.callId).catch(() => {});
  };
  const accept = () => {
    // Answer as the profile that was called (you may be looking at another one).
    if (incoming.to && incoming.to !== profile?.profileId) switchProfile(incoming.to);
    void startCall.join(incoming.callId);
  };
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-3">
      <div className="flex w-full max-w-md items-center gap-3 rounded-3xl bg-navy p-3 pl-4 text-white shadow-2xl ring-1 ring-white/10">
        {caller && <Avatar profile={caller} size={48} />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{incoming.conversation?.type === "GROUP" ? incoming.conversation.title : caller?.displayName}</p>
          <p className="text-sm text-white/70">Incoming {incoming.type === "VIDEO" ? "video" : "voice"} call…</p>
        </div>
        <button onClick={decline} aria-label="Decline" className="flex size-12 items-center justify-center rounded-full bg-danger active:scale-95">
          <PhoneOff className="size-5" />
        </button>
        <button onClick={accept} aria-label="Accept" className="flex size-12 animate-pulse items-center justify-center rounded-full bg-ok active:scale-95">
          {incoming.type === "VIDEO" ? <Video className="size-5" /> : <Phone className="size-5" />}
        </button>
      </div>
    </div>
  );
}
