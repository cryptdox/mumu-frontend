import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AudioRenderer, Controls, MumuRoom, VideoTile, useParticipants, useRoom } from "mumu-rtc/react";
import { ArrowLeft, Eye, MessageCircle, Radio, SendHorizontal, Users, X } from "lucide-react";
import { mu } from "@/api/mu";
import type { Audience, Comment, LiveStream, RtcJoin } from "@/api/types";
import { useProfile } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { liveTakeoverStore, useSocket } from "@/lib/realtime";
import { createStore, useStore } from "@/lib/store";
import { useKeepVideosPlaying } from "@/lib/keepPlaying";
import { compact, shortTime } from "@/lib/format";
import { errorCode, errorMessage } from "@/lib/api";
import { rtcErrorText } from "@/lib/rtcError";
import { AudiencePicker, AudienceIcon, Avatar, Button, Empty, ErrorNote, IconButton, Input, Loading, Name, Sheet, audienceLabel, cx, toast, toastError } from "@/components/ui";
import { TopBar } from "@/components/layout";

// ── Live now ────────────────────────────────────────────────────────────────

function StreamCard({ s }: { s: LiveStream }) {
  return (
    <Link to={`/live/${s.liveStreamId}`} className="group overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-navy via-[#273c75] to-accent-strong">
        <Avatar profile={s.host} size={72} />
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">
          <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE
        </span>
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-semibold text-white">
          <Eye className="size-3.5" /> {compact(s.viewerCount)}
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-1 font-semibold">{s.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
          <Name profile={s.host} className="font-medium" /> · {shortTime(s.startedAt)}
        </p>
      </div>
    </Link>
  );
}

export function LiveHome() {
  const me = useProfile();
  const navigate = useNavigate();
  const { openSwitcher } = useOutletContext<{ openSwitcher: () => void }>();
  const live = useQuery({ queryKey: ["live"], queryFn: mu.live.list, refetchInterval: 20_000 });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState<Audience>("PUBLIC");
  const start = useMutation({
    mutationFn: () => mu.live.start(title.trim(), audience),
    onSuccess: ({ stream, rtc }) => {
      queryClient.setQueryData(["live", stream.liveStreamId], stream);
      queryClient.setQueryData(["live-join", stream.liveStreamId, false], { stream, rtc });
      setOpen(false);
      navigate(`/live/${stream.liveStreamId}`);
    },
    onError: toastError,
  });
  const mine = live.data?.find((s) => s.hostProfileId === me.profileId);

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <TopBar title="Live" onAvatar={openSwitcher}>
        {mine ? (
          <Link to={`/live/${mine.liveStreamId}`}>
            {mine.onThisDevice === false ? (
              <Button size="sm" variant="secondary">Live on another device</Button>
            ) : (
              <Button size="sm" variant="danger">Back to your live</Button>
            )}
          </Link>
        ) : (
          <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
            <Radio className="size-4" /> Go live
          </Button>
        )}
      </TopBar>
      <div className="mx-auto max-w-5xl p-4">
        <ErrorNote error={live.error} onRetry={() => live.refetch()} />
        {live.isLoading ? (
          <Loading />
        ) : live.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.data.map((s) => <StreamCard key={s.liveStreamId} s={s} />)}
          </div>
        ) : (
          <Empty icon={<Radio className="size-8" />} title="Nobody's live right now">
            Go live {me.kind === "BUSINESS" ? `as ${me.displayName}` : "yourself"} — your {me.kind === "BUSINESS" ? "followers" : "friends and followers"} get a notification.
          </Empty>
        )}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Go live">
        <form onSubmit={(e) => (e.preventDefault(), start.mutate())} className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
            <Avatar profile={me} size={40} />
            <span className="text-sm">Streaming as <b>{me.displayName}</b></span>
          </div>
          <Input label="Title" placeholder="What's this live about?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required autoFocus />
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Who can watch</p>
            <AudiencePicker value={audience} onChange={setAudience} kind={me.kind} />
          </div>
          <p className="text-xs text-muted">Your camera and microphone turn on when you start. Lives aren't recorded.</p>
          <Button className="w-full" variant="danger" loading={start.isPending} disabled={!title.trim()}>
            <Radio className="size-4" /> Start live
          </Button>
        </form>
      </Sheet>
    </div>
  );
}

// ── Watching / hosting ──────────────────────────────────────────────────────

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

// ── Live chat = comments on the live's post ─────────────────────────────────
// Saved like any comment (so they stay on the post in the feed afterwards) and pushed to
// everyone watching over the socket ("live:comment" / "live:comment-removed").

interface LiveChat {
  messages: { id: string; name: string; text: string; at: string; isLocal: boolean }[];
  send: (text: string) => void;
}
const LiveChatCtx = createContext<LiveChat>({ messages: [], send: () => {} });
const useLiveChat = () => useContext(LiveChatCtx);

function useLiveCommentsState(postId: string | null, meId: string): LiveChat {
  const socket = useSocket();
  const key = ["live-comments", postId];
  const history = useQuery({ queryKey: key, queryFn: () => mu.posts.comments(postId!), enabled: !!postId, staleTime: Infinity });
  const upsert = (c: Comment) =>
    queryClient.setQueryData<Comment[]>(key, (list = []) => (list.some((x) => x.commentId === c.commentId) ? list : [c, ...list]));

  useEffect(() => {
    if (!socket || !postId) return;
    const added = (c: Comment) => c.postId === postId && upsert(c);
    const removed = (r: { commentId: string }) => queryClient.setQueryData<Comment[]>(key, (list = []) => list.filter((x) => x.commentId !== r.commentId));
    socket.on("live:comment", added);
    socket.on("live:comment-removed", removed);
    return () => {
      socket.off("live:comment", added);
      socket.off("live:comment-removed", removed);
    };
  }, [socket, postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const messages = useMemo(
    () =>
      [...(history.data ?? [])].reverse().map((c) => ({
        id: c.commentId,
        name: c.author.displayName,
        text: c.text,
        at: c.createdAt,
        isLocal: c.author.profileId === meId,
      })),
    [history.data, meId],
  );
  const send = (text: string) => {
    if (!postId) return;
    mu.posts.comment(postId, text).then(upsert, toastError);
  };
  return { messages, send };
}

function ChatLine({ name, text, isLocal }: { name: string; text: string; isLocal: boolean }) {
  return (
    <p className="text-sm leading-snug">
      <span className={cx("mr-1.5 font-semibold", isLocal ? "text-brand" : "text-accent")}>{isLocal ? "You" : name}</span>
      <span className="break-words text-white/90">{text}</span>
    </p>
  );
}

/** Bumped when the live video may have been stopped by the browser (chat panel closed…). */
const videoKick = createStore(0);

function ChatForm({ onSend, autoFocus }: { onSend: (text: string) => void; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim().slice(0, 500));
    setText("");
  };
  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        autoFocus={autoFocus}
        placeholder="Say something…"
        aria-label="Live chat message"
        className="h-10 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-sm text-white outline-none placeholder:text-white/60 focus:bg-white/20 focus-visible:outline-none"
      />
      <IconButton type="submit" label="Send" className="bg-brand text-white hover:bg-brand-strong" disabled={!text.trim()}>
        <SendHorizontal className="size-4" />
      </IconButton>
    </form>
  );
}

/** Full chat history (side panel on wide screens, right-hand drawer on phones). */
function ChatHistory() {
  const { messages, send } = useLiveChat();
  const listRef = useRef<HTMLDivElement>(null);
  // Braces matter: newer Chrome returns a Promise from scrollTo(), and an effect that returns
  // anything is called as its cleanup — closing the chat then crashed with "… is not a function".
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length ? messages.map((m) => <ChatLine key={m.id} name={m.name} text={m.text} isLocal={m.isLocal} />) : <p className="pt-8 text-center text-sm text-white/50">No messages yet — say hi 👋</p>}
      </div>
      <div className="safe-bottom flex p-3">
        <ChatForm onSend={(t) => void send(t)} />
      </div>
    </div>
  );
}

/**
 * Phone overlay: the latest few messages float at the bottom of the video, new ones slide in
 * and older ones fade away. Tapping them (or the chat button) opens the full chat on the right.
 */
function ChatOverlay() {
  const { messages, send } = useLiveChat();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const recent = messages.slice(-4);
  // Phones stop decoding video hidden behind the panel; ask for a fresh picture on close.
  const close = () => {
    setOpen(false);
    videoKick.set((n) => n + 1);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open live chat"
        className="block w-full space-y-1.5 px-4 pb-2 text-left [mask-image:linear-gradient(to_bottom,transparent,black_28px)] [text-shadow:0_1px_2px_rgb(0_0_0/0.8)]"
      >
        {recent.map((m, i) => {
          const age = (now - new Date(m.at).getTime()) / 1000;
          // Newest is fully visible; older lines and anything older than ~8 s fade back.
          const opacity = age > 12 ? 0.25 : age > 8 ? 0.5 : 1 - (recent.length - 1 - i) * 0.18;
          return (
            <div key={m.id} className="mu-chat-in transition-opacity duration-700" style={{ opacity }}>
              <ChatLine name={m.name} text={m.text} isLocal={m.isLocal} />
            </div>
          );
        })}
      </button>
      <div className="flex items-center gap-2 px-3 pb-3">
        <IconButton label="Open live chat" onClick={() => setOpen(true)} className="relative bg-white/15 text-white hover:bg-white/25">
          <MessageCircle className="size-5" />
          {messages.length > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand px-1 text-[10px] font-bold leading-4">{messages.length > 99 ? "99+" : messages.length}</span>}
        </IconButton>
        <ChatForm onSend={(t) => void send(t)} />
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => close()}>
          <aside
            role="dialog"
            aria-label="Live chat"
            onClick={(e) => e.stopPropagation()}
            className="mu-drawer-in flex h-full w-[85%] max-w-sm flex-col bg-navy text-white shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 pt-3">
              <p className="font-semibold">Live chat</p>
              <IconButton label="Close chat" onClick={() => close()} className="text-white hover:bg-white/10">
                <X className="size-5" />
              </IconButton>
            </div>
            <ChatHistory />
          </aside>
        </div>
      )}
    </>
  );
}

/** `?debug=1` on a live: the video's state, for diagnosing black screens on a phone. */
function VideoDebug() {
  const [info, setInfo] = useState("");
  useEffect(() => {
    let frames = 0;
    let last = 0;
    const t = setInterval(() => {
      const v = document.querySelector<HTMLVideoElement>(".mu-live-screen video");
      const tr = (v?.srcObject as MediaStream | null)?.getVideoTracks()[0];
      const q = (v as (HTMLVideoElement & { getVideoPlaybackQuality?: () => VideoPlaybackQuality }) | null)?.getVideoPlaybackQuality?.();
      const total = q?.totalVideoFrames ?? 0;
      frames = total - last;
      last = total;
      setInfo(v ? `${v.videoWidth}x${v.videoHeight} ${v.paused ? "PAUSED" : "playing"} ready=${v.readyState} fps≈${frames} track=${tr ? `${tr.readyState}${tr.muted ? " muted" : ""}${tr.enabled ? "" : " disabled"}` : "none"} vis=${document.visibilityState}` : "no <video>");
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return <div className="pointer-events-none absolute left-2 top-16 z-20 rounded bg-black/70 px-2 py-1 font-mono text-[11px] text-ok">{info}</div>;
}
const DEBUG = typeof location !== "undefined" && new URLSearchParams(location.search).has("debug");

function Screen({ stream }: { stream: LiveStream }) {
  const participants = useParticipants();
  const { state, error } = useRoom();
  const failure = state !== "connected" && state !== "connecting" && state !== "reconnecting" ? rtcErrorText(error) : null;
  // During a device takeover the host can briefly be in the room twice: show your own
  // camera if you're the host, otherwise the newest host connection.
  const hosts = participants.filter((p) => p.userId === stream.hostProfileId);
  const host = hosts.find((p) => p.isLocal) ?? hosts[hosts.length - 1];
  const hostHere = !!host;
  useEffect(() => {
    if (!hostHere && state === "connected") void queryClient.invalidateQueries({ queryKey: ["live", stream.liveStreamId] });
  }, [hostHere, state, stream.liveStreamId]);
  const source = host?.tracks.screen ? "screen" : "camera";
  const showing = stream.status === "LIVE" && host && host.tracks[source] && !host.muted[source];
  useKeepVideosPlaying(".mu-live-screen", !!showing);
  const { room } = useRoom();
  const kick = useStore(videoKick);
  const peerId = host?.peerId;
  const track = showing ? host?.tracks[source] : undefined;
  useEffect(() => {
    if (!peerId || !track || host?.isLocal) return;
    // The <video> itself is replaced on every kick (its key changes) — on some phones
    // (MediaTek / vivo) Chrome's video layer stays black after being covered, and only a new
    // element gets a working one. Then pause/resume the consumer on the media server,
    // which requests a keyframe, so the new element gets a picture at once.
    const keyframe = () => void room.setVideoVisible(peerId, source, false).then(() => room.setVideoVisible(peerId, source, true));
    const onVisible = () => document.visibilityState === "visible" && videoKick.set((n) => n + 1);
    if (kick) keyframe();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [kick, peerId, track, source, room, host?.isLocal]);
  return (
    <div className="mu-live-screen absolute inset-0 flex items-center justify-center bg-black">
      {DEBUG && <VideoDebug />}
      <AudioRenderer />
      {showing ? (
        <VideoTile key={`${host.peerId}:${kick}`} participant={host} source={source} showLabel={false} mirror={host.isLocal && source === "camera"} />
      ) : (
        <div className="flex flex-col items-center gap-3 text-white/80">
          <Avatar profile={stream.host} size={96} />
          <p className="max-w-sm px-6 text-center text-sm">{stream.status === "ENDED" ? "This live has ended" : failure ? failure : state !== "connected" ? "Connecting…" : host ? "Camera is off" : "Waiting for the host…"}</p>
        </div>
      )}
    </div>
  );
}

export function LiveRoom() {
  const { id = "" } = useParams();
  const me = useProfile();
  const navigate = useNavigate();
  const socket = useSocket();
  // Your own live open on another device: ask before moving it here.
  const [takeover, setTakeover] = useState(false);
  const cached = queryClient.getQueryData<{ stream: LiveStream; rtc: RtcJoin }>(["live-join", id, false]);
  const join = useQuery({ queryKey: ["live-join", id, takeover], queryFn: () => mu.live.watch(id, takeover), initialData: takeover ? undefined : cached, staleTime: Infinity, gcTime: 0, retry: false });
  const elsewhere = errorCode(join.error) === "LIVE_ON_OTHER_DEVICE";
  // …and if another of your devices takes this live over, step off it here.
  const moved = useStore(liveTakeoverStore);
  const hosting = join.data?.rtc.role === "HOST";
  useEffect(() => {
    if (moved?.liveStreamId !== id) return;
    liveTakeoverStore.set(null);
    // Only the device that was broadcasting steps off — viewers (even the page's team) stay.
    if (!hosting) return;
    toast("Your live continues on your other device");
    navigate("/live", { replace: true });
  }, [moved, id, navigate, hosting]);
  const stream = useQuery({ queryKey: ["live", id], queryFn: () => mu.live.get(id), initialData: join.data?.stream, refetchInterval: 30_000 }).data;
  const isHost = stream?.hostProfileId === me.profileId;
  const wide = useMediaQuery("(min-width: 1024px)");
  const chat = useLiveCommentsState(stream?.postId ?? join.data?.stream.postId ?? null, me.profileId);
  const publish = useMemo(() => (isHost ? { camera: true, mic: true } : { camera: false, mic: false }), [isHost]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("live:watch", { liveStreamId: id });
    return () => void socket.emit("live:unwatch", { liveStreamId: id });
  }, [socket, id]);
  // Viewer count goes down when you leave.
  useEffect(() => () => void (!isHost && mu.live.leave(id).catch(() => {})), [id, isHost]);

  const end = useMutation({
    mutationFn: () => mu.live.end(id),
    onSuccess: () => {
      toast("Live ended");
      void queryClient.invalidateQueries({ queryKey: ["live"] });
      navigate("/live");
    },
    onError: toastError,
  });

  if (join.isLoading) return <div className="flex flex-1 bg-navy"><Loading label="Joining…" /></div>;
  if (elsewhere) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy p-6 text-white md:static md:z-auto md:flex-1">
        <div className="w-full max-w-sm rounded-3xl bg-white/10 p-6 text-center backdrop-blur">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-danger/90">
            <Radio className="size-7" />
          </span>
          <h2 className="text-lg font-bold">You're live on another device</h2>
          <p className="mt-1 text-sm text-white/70">Continue the live here? Your other device will stop broadcasting.</p>
          <div className="mt-5 grid gap-2">
            <Button variant="danger" onClick={() => setTakeover(true)}>
              <Radio className="size-4" /> Go live from here
            </Button>
            <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigate("/live", { replace: true })}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (join.error || !join.data || !stream) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Live" />
        <Empty icon={<Radio className="size-8" />} title="Can't open this live">{errorMessage(join.error)}</Empty>
      </div>
    );
  }
  const ended = stream.status === "ENDED";

  return (
    <div className="fixed inset-0 z-40 flex bg-black text-white md:static md:z-auto md:flex-1">
      <LiveChatCtx.Provider value={chat}>
      <MumuRoom apiUrl={join.data.rtc.apiUrl} token={ended ? null : join.data.rtc.token} publish={publish} onError={(e) => toast(e.message, "error")}>
        {/* The video always fills this stage; header, controls and (on phones) chat float over it,
            so a phone keyboard opening for the chat never squeezes the video away. */}
        <div className="relative min-h-0 min-w-0 flex-1">
          <Screen stream={stream} />
          <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent p-3">
            <IconButton label="Back" onClick={() => navigate("/live")} className="text-white hover:bg-white/10">
              <ArrowLeft className="size-6" />
            </IconButton>
            <Link to={`/u/${stream.host.handle}`} className="flex min-w-0 items-center gap-2">
              <Avatar profile={stream.host} size={36} />
              <span className="min-w-0">
                <Name profile={stream.host} className="text-sm" />
                <span className="block truncate text-xs text-white/70">{stream.title}</span>
              </span>
            </Link>
            <span className="ml-auto flex items-center gap-2">
              {!ended && <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold">LIVE</span>}
              <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-semibold"><Users className="size-3.5" /> {compact(stream.viewerCount)}</span>
              <span className="hidden items-center gap-1 rounded-full bg-black/40 px-2.5 py-0.5 text-xs sm:flex" title={audienceLabel(stream.audience, stream.host.kind)}>
                <AudienceIcon audience={stream.audience} />
              </span>
            </span>
          </header>
          <div className="safe-bottom absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-10">
            {!ended && !wide && <ChatOverlay />}
            {isHost && !ended && (
              <div className="flex justify-center pb-2">
                <Controls onLeave={() => end.mutate()} />
              </div>
            )}
            {ended && !isHost && (
              <div className="p-4 text-center">
                <Button onClick={() => navigate("/live")}>See who else is live</Button>
              </div>
            )}
          </div>
        </div>
        {!ended && wide && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-navy">
            <p className="px-4 pt-4 text-sm font-semibold">Live chat</p>
            <ChatHistory />
          </aside>
        )}
      </MumuRoom>
      </LiveChatCtx.Provider>
    </div>
  );
}
