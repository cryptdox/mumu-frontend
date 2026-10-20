import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AudioRenderer, Controls, MumuRoom, VideoTile, useChat, useParticipants, useRoom } from "mumu-rtc/react";
import { ArrowLeft, Eye, Radio, SendHorizontal, Users } from "lucide-react";
import { mu } from "@/api/mu";
import type { Audience, LiveStream, RtcJoin } from "@/api/types";
import { useProfile } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { useSocket } from "@/lib/realtime";
import { compact, shortTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
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
      queryClient.setQueryData(["live-join", stream.liveStreamId], { stream, rtc });
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
          <Link to={`/live/${mine.liveStreamId}`}><Button size="sm" variant="danger">Back to your live</Button></Link>
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

function useProfileCard(profileId: string) {
  return useQuery({ queryKey: ["profile", profileId], queryFn: () => mu.profiles.get(profileId), staleTime: 5 * 60_000 }).data;
}

function ChatLine({ userId, text, isLocal }: { userId: string; text: string; isLocal: boolean }) {
  const p = useProfileCard(userId);
  return (
    <p className="text-sm leading-snug">
      <span className={cx("mr-1.5 font-semibold", isLocal ? "text-brand" : "text-accent")}>{isLocal ? "You" : p?.displayName ?? "…"}</span>
      <span className="break-words text-white/90">{text}</span>
    </p>
  );
}

function LiveChat() {
  const { messages, send } = useChat();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), [messages.length]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    void send(text.trim().slice(0, 500));
    setText("");
  };
  return (
    <div className="flex min-h-0 flex-col">
      <div ref={listRef} className="scrollbar-thin max-h-40 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-2 [mask-image:linear-gradient(to_bottom,transparent,black_24px)] lg:max-h-none">
        {messages.map((m, i) => <ChatLine key={i} userId={m.userId} text={m.text} isLocal={m.isLocal} />)}
      </div>
      <form onSubmit={submit} className="flex gap-2 p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Say something…" aria-label="Live chat message" className="h-10 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-sm text-white outline-none placeholder:text-white/60 focus:bg-white/20 focus-visible:outline-none" />
        <IconButton type="submit" label="Send" className="bg-brand text-white hover:bg-brand-strong" disabled={!text.trim()}>
          <SendHorizontal className="size-4" />
        </IconButton>
      </form>
    </div>
  );
}

function Screen({ stream }: { stream: LiveStream }) {
  const participants = useParticipants();
  const { state, error } = useRoom();
  const failure = state !== "connected" && state !== "connecting" && state !== "reconnecting" ? rtcErrorText(error) : null;
  const host = participants.find((p) => p.userId === stream.hostProfileId);
  const source = host?.tracks.screen ? "screen" : "camera";
  const showing = stream.status === "LIVE" && host && host.tracks[source] && !host.muted[source];
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
      <AudioRenderer />
      {showing ? (
        <VideoTile participant={host} source={source} showLabel={false} mirror={host.isLocal && source === "camera"} className="!aspect-auto h-full !max-h-full !rounded-none [&_video]:object-contain" />
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
  const cached = queryClient.getQueryData<{ stream: LiveStream; rtc: RtcJoin }>(["live-join", id]);
  const join = useQuery({ queryKey: ["live-join", id], queryFn: () => mu.live.watch(id), initialData: cached, staleTime: Infinity, gcTime: 0, retry: false });
  const stream = useQuery({ queryKey: ["live", id], queryFn: () => mu.live.get(id), initialData: join.data?.stream, refetchInterval: 30_000 }).data;
  const isHost = stream?.hostProfileId === me.profileId;
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
    <div className="fixed inset-0 z-40 flex flex-col bg-navy text-white lg:flex-row md:static md:z-auto md:flex-1">
      <MumuRoom apiUrl={join.data.rtc.apiUrl} token={ended ? null : join.data.rtc.token} publish={publish} onError={(e) => toast(e.message, "error")}>
        <div className="relative flex min-h-0 flex-1 flex-col">
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
          <Screen stream={stream} />
          {isHost && !ended && (
            <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/60 to-transparent pb-3 pt-8">
              <Controls onLeave={() => end.mutate()} />
            </div>
          )}
        </div>
        {!ended && (
          <aside className="safe-bottom flex shrink-0 flex-col border-white/10 bg-navy lg:w-80 lg:border-l">
            <p className="hidden px-4 pt-4 text-sm font-semibold lg:block">Live chat</p>
            <LiveChat />
          </aside>
        )}
      </MumuRoom>
      {ended && !isHost && (
        <div className="absolute inset-x-0 bottom-0 p-4 text-center lg:static">
          <Button onClick={() => navigate("/live")}>See who else is live</Button>
        </div>
      )}
    </div>
  );
}
