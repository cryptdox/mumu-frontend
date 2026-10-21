import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Bell, BellOff, Check, CheckCheck, CornerUpLeft, Flag, ImagePlus, Info, Loader2, LogOut, MoreVertical,
  Pencil, Phone, PhoneMissed, SendHorizontal, Trash2, Video, X,
} from "lucide-react";
import { mu } from "@/api/mu";
import type { Conversation, Message } from "@/api/types";
import { useProfile } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { typingStore, upsertMessage, useSocket } from "@/lib/realtime";
import { useStore } from "@/lib/store";
import { clock, dayLabel, duration } from "@/lib/format";
import { IMAGE_ACCEPT, prepareImage } from "@/lib/image";
import { Avatar, CharCounter, Empty, ErrorNote, IconButton, Loading, Name, Sheet, confirmAction, cx, toast, toastError } from "@/components/ui";
import { charCount } from "@/lib/format";
import { LIMITS } from "@/config";
import { startCall } from "./CallScreen";
import { GroupInfo } from "./GroupInfo";

type Pages = { pages: Message[][]; pageParams: (string | undefined)[] };

function useMessages(id: string) {
  return useInfiniteQuery({
    queryKey: ["messages", id],
    queryFn: ({ pageParam }) => mu.chats.messages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length < 30 ? undefined : last[last.length - 1].createdAt),
    staleTime: Infinity,
  });
}

// ── Message bubble ──────────────────────────────────────────────────────────

function CallBubble({ m, mine }: { m: Message; mine: boolean }) {
  const c = m.call!;
  const missed = c.status === "MISSED";
  const Icon = missed ? PhoneMissed : c.type === "VIDEO" ? Video : Phone;
  const label = missed ? (mine ? "No answer" : `Missed ${c.type === "VIDEO" ? "video" : "voice"} call`) : `${c.type === "VIDEO" ? "Video" : "Voice"} call`;
  const detail = c.status === "ENDED" && c.answeredAt ? duration(c.answeredAt, c.endedAt) : c.status === "RINGING" || c.status === "ONGOING" ? "Tap to join" : clock(m.createdAt);
  const live = c.status === "RINGING" || c.status === "ONGOING";
  return (
    <button
      disabled={!live}
      onClick={() => live && void startCall.join(c.callId)}
      className={cx("flex items-center gap-3 rounded-2xl px-4 py-3 text-left", mine ? "bg-brand/10" : "bg-bubble-in shadow-sm", live && "ring-2 ring-ok")}
    >
      <span className={cx("flex size-10 items-center justify-center rounded-full", missed ? "bg-danger/10 text-danger" : "bg-ok/15 text-ok")}>
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
    </button>
  );
}

function Bubble({
  m, mine, showSender, read, onAction,
}: { m: Message; mine: boolean; showSender: boolean; read?: boolean; onAction: (m: Message) => void }) {
  const [zoom, setZoom] = useState(false);
  if (m.kind === "SYSTEM") {
    return (
      <div className="my-2 text-center">
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
          {mine ? "You" : m.sender.displayName} {m.text}
        </span>
      </div>
    );
  }
  return (
    <div className={cx("group flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && <span className="w-8 shrink-0">{showSender && <Avatar profile={m.sender} size={32} />}</span>}
      <div className={cx("flex max-w-[78%] flex-col sm:max-w-[65%]", mine ? "items-end" : "items-start")}>
        {showSender && !mine && <span className="mb-0.5 ml-3 text-xs font-semibold text-accent-strong">{m.sender.displayName}</span>}
        {m.kind === "CALL" && m.call ? (
          <CallBubble m={m} mine={mine} />
        ) : (
          <div
            onContextMenu={(e) => {
              e.preventDefault();
              if (!m.deletedAt) onAction(m);
            }}
            className={cx(
              "relative overflow-hidden rounded-3xl text-[15px] leading-snug",
              mine ? "rounded-br-lg bg-brand text-white" : "rounded-bl-lg bg-bubble-in text-ink shadow-sm",
              m.deletedAt && "!bg-transparent italic text-muted ring-1 ring-line",
            )}
          >
            {m.replyTo && !m.deletedAt && (
              <div className={cx("mx-1.5 mt-1.5 rounded-2xl border-l-4 px-3 py-1.5 text-xs", mine ? "border-white/70 bg-white/15" : "border-accent bg-surface-2")}>
                <span className="block font-semibold">{m.replyTo.sender.displayName}</span>
                <span className="line-clamp-2 opacity-80">{m.replyTo.deleted ? "Message deleted" : m.replyTo.text ?? (m.replyTo.hasImage ? "📷 Photo" : "")}</span>
              </div>
            )}
            {m.media && (
              <button onClick={() => setZoom(true)} className="block p-1">
                <img
                  src={m.media.url}
                  alt=""
                  onLoad={(e) => e.currentTarget.closest("[data-scroller]")?.dispatchEvent(new Event("pin"))}
                  className="max-h-80 w-full rounded-[20px] object-cover"
                  style={m.media.width && m.media.height ? { aspectRatio: `${m.media.width} / ${m.media.height}` } : undefined}
                />
              </button>
            )}
            {(m.text || m.deletedAt) && <p className="whitespace-pre-wrap break-words px-4 py-2">{m.deletedAt ? "This message was deleted" : m.text}</p>}
          </div>
        )}
        <span className="mt-0.5 flex items-center gap-1 px-2 text-[11px] text-muted">
          {m.editedAt && !m.deletedAt && "edited ·"} {clock(m.createdAt)}
          {mine && m.kind === "TEXT" && !m.deletedAt && (read ? <CheckCheck className="size-3.5 text-brand" /> : <Check className="size-3.5" />)}
        </span>
      </div>
      {m.kind === "TEXT" && !m.deletedAt && (
        <IconButton label="Message actions" onClick={() => onAction(m)} className="size-8 opacity-0 transition group-hover:opacity-100 focus:opacity-100">
          <MoreVertical className="size-4 text-muted" />
        </IconButton>
      )}
      {zoom && m.media && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(false)}>
          <img src={m.media.url} alt="" className="max-h-full max-w-full rounded-xl" />
          <IconButton label="Close" className="absolute right-4 top-4 text-white hover:bg-white/10">
            <X className="size-6" />
          </IconButton>
        </div>
      )}
    </div>
  );
}

// ── Composer ────────────────────────────────────────────────────────────────

function Composer({
  chat, replyTo, editing, onDone,
}: { chat: Conversation; replyTo: Message | null; editing: Message | null; onDone: () => void }) {
  const me = useProfile();
  const socket = useSocket();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);

  useEffect(() => {
    if (editing) {
      setText(editing.text ?? "");
      areaRef.current?.focus();
    }
  }, [editing]);
  useEffect(() => {
    if (replyTo) areaRef.current?.focus();
  }, [replyTo]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const tooLong = charCount(text) > LIMITS.text;
  const canSend = !busy && !tooLong && (!!text.trim() || (!!file && !editing));

  function typing(value: string) {
    setText(value);
    if (socket && Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      socket.emit("typing", { conversationId: chat.conversationId, profileId: me.profileId });
    }
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    try {
      const ready = await prepareImage(f);
      setFile(ready);
      setPreview(URL.createObjectURL(ready));
    } catch (err) {
      toastError(err);
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    setBusy(true);
    const body = text.trim();
    try {
      if (editing) {
        upsertMessage(await mu.chats.edit(editing.messageId, body));
      } else {
        const mediaId = file ? (await mu.media.upload(file, file.name)).mediaId : undefined;
        upsertMessage(await mu.chats.send(chat.conversationId, { text: body || undefined, mediaId, replyToId: replyTo?.messageId }));
        void queryClient.invalidateQueries({ queryKey: ["chats"] });
      }
      setText("");
      setFile(null);
      setPreview(null);
      onDone();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
      areaRef.current?.focus();
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on devices with a keyboard; phones use the button.
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
      e.preventDefault();
      void send();
    }
    if (e.key === "Escape" && (editing || replyTo)) onDone();
  };

  return (
    <form onSubmit={send} className="safe-bottom shrink-0 border-t border-line bg-surface px-3 pb-2 pt-2">
      {(replyTo || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm">
          {editing ? <Pencil className="size-4 text-brand" /> : <CornerUpLeft className="size-4 text-brand" />}
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-brand">{editing ? "Editing" : `Replying to ${replyTo!.sender.profileId === me.profileId ? "yourself" : replyTo!.sender.displayName}`}</span>
            <span className="block truncate text-muted">{(editing ?? replyTo)!.text ?? "📷 Photo"}</span>
          </span>
          <IconButton
            type="button"
            label="Cancel"
            className="size-8"
            onClick={() => {
              if (editing) setText("");
              onDone();
            }}
          >
            <X className="size-4" />
          </IconButton>
        </div>
      )}
      {preview && (
        <div className="relative mb-2 inline-block">
          <img src={preview} alt="Selected" className="h-24 rounded-2xl object-cover" />
          <button type="button" onClick={() => (setFile(null), setPreview(null))} aria-label="Remove image" className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-ink text-surface">
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1.5">
        {!editing && (
          <>
            <IconButton type="button" label="Add a photo" onClick={() => fileRef.current?.click()} disabled={!!file} className="text-muted hover:text-brand">
              <ImagePlus className="size-6" />
            </IconButton>
            <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ""))} />
          </>
        )}
        <div className="flex min-h-11 flex-1 items-end rounded-3xl bg-surface-2 px-4 py-2.5">
          <textarea
            ref={areaRef}
            rows={1}
            value={text}
            onChange={(e) => typing(e.target.value)}
            onKeyDown={onKey}
            placeholder="Message"
            aria-label="Message"
            className="max-h-40 w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted focus-visible:outline-none"
          />
          <CharCounter text={text} />
        </div>
        <button
          type="submit"
          disabled={!canSend}
          aria-label={editing ? "Save" : "Send"}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-md shadow-brand/30 transition active:scale-95 disabled:bg-line disabled:shadow-none"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : editing ? <Check className="size-5" /> : <SendHorizontal className="size-5" />}
        </button>
      </div>
    </form>
  );
}

// ── Thread ──────────────────────────────────────────────────────────────────

export default function Thread() {
  const { id = "" } = useParams();
  const me = useProfile();
  const navigate = useNavigate();
  const chat = useQuery({ queryKey: ["chat", id], queryFn: () => mu.chats.get(id) });
  const messages = useMessages(id);
  const typing = (useStore(typingStore)[id] ?? []).filter((p) => p !== me.profileId);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [action, setAction] = useState<Message | null>(null);
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const list = useMemo(() => [...(messages.data?.pages.flat() ?? [])].reverse(), [messages.data]);
  const newest = list[list.length - 1];

  // Keep pinned to the bottom unless the user scrolled up.
  const ready = !!chat.data && !messages.isLoading;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [list.length, typing.length, ready]);
  // A photo finishing loading shouldn't push the newest message out of view.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const pin = () => stick.current && (el.scrollTop = el.scrollHeight);
    el.addEventListener("pin", pin);
    return () => el.removeEventListener("pin", pin);
  }, [ready]);
  useEffect(() => {
    stick.current = true;
    setReplyTo(null);
    setEditing(null);
  }, [id]);

  // Read receipts: mark read when something new shows up while the chat is open.
  useEffect(() => {
    if (!newest || newest.sender.profileId === me.profileId || document.hidden) return;
    mu.chats.read(id).then(() => {
      queryClient.setQueryData<Conversation[]>(["chats"], (l) => l?.map((c) => (c.conversationId === id ? { ...c, unread: 0 } : c)));
    }).catch(() => {});
  }, [id, newest?.messageId]); // eslint-disable-line react-hooks/exhaustive-deps

  function onScroll() {
    const el = scroller.current!;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 120 && messages.hasNextPage && !messages.isFetchingNextPage) {
      const before = el.scrollHeight;
      void messages.fetchNextPage().then(() => requestAnimationFrame(() => (el.scrollTop += el.scrollHeight - before)));
    }
  }

  const remove = useMutation({
    mutationFn: (m: Message) => mu.chats.remove(m.messageId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["messages", id] }),
    onError: toastError,
  });
  const mute = useMutation({
    mutationFn: (muted: boolean) => mu.chats.mute(id, muted ? null : new Date(Date.now() + 365 * 86400e3).toISOString()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat", id] });
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
  const leave = useMutation({
    mutationFn: () => mu.chats.removeMember(id, me.profileId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      navigate("/chats");
    },
    onError: toastError,
  });

  if (chat.isLoading) return <Loading />;
  if (chat.error || !chat.data) return <ErrorNote error={chat.error ?? new Error("Chat not found")} />;
  const c = chat.data;
  const partner = c.partner;
  const partnerRead = c.type === "DIRECT" ? c.members.find((m) => m.profileId === partner?.profileId)?.lastReadAt : null;
  const typingNames = typing.map((p) => c.members.find((m) => m.profileId === p)?.displayName ?? "Someone");
  const status = typingNames.length
    ? `${c.type === "GROUP" ? typingNames.join(", ") + " " : ""}typing…`
    : partner
      ? partner.online ? "online" : `@${partner.handle}`
      : `${c.memberCount} members`;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-2">
        <IconButton label="Back" onClick={() => navigate("/chats")} className="md:hidden">
          <ArrowLeft className="size-6" />
        </IconButton>
        <Link
          to={partner ? `/u/${partner.handle}` : "#"}
          onClick={(e) => c.type === "GROUP" && (e.preventDefault(), setInfo(true))}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 pl-2 hover:bg-surface-2"
        >
          <Avatar profile={partner ?? { displayName: c.title, avatarUrl: c.avatarUrl }} size={42} online={partner?.online} />
          <span className="min-w-0">
            {partner ? <Name profile={partner} /> : <span className="block truncate font-semibold">{c.title}</span>}
            <span className={cx("block truncate text-xs", typingNames.length || partner?.online ? "text-brand" : "text-muted")}>{status}</span>
          </span>
        </Link>
        <IconButton label="Voice call" onClick={() => void startCall.start(id, "AUDIO")} className="text-brand">
          <Phone className="size-5" />
        </IconButton>
        <IconButton label="Video call" onClick={() => void startCall.start(id, "VIDEO")} className="text-brand">
          <Video className="size-5" />
        </IconButton>
        <IconButton label="More" onClick={() => setMenu(true)}>
          <MoreVertical className="size-5" />
        </IconButton>
      </header>

      <div ref={scroller} data-scroller onScroll={onScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.isFetchingNextPage && <Loader2 className="mx-auto mb-3 size-5 animate-spin text-muted" />}
        {messages.isLoading ? (
          <Loading />
        ) : !list.length ? (
          <Empty icon={<SendHorizontal className="size-7" />} title="Say hello 👋">
            Messages are up to 500 characters, with one photo each.
          </Empty>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
            {list.map((m, i) => {
              const prev = list[i - 1];
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              const mine = m.sender.profileId === me.profileId;
              const showSender = c.type === "GROUP" && !mine && (newDay || prev?.sender.profileId !== m.sender.profileId || prev.kind === "SYSTEM");
              return (
                <Fragment key={m.messageId}>
                  {newDay && (
                    <div className="sticky top-0 z-10 my-3 text-center">
                      <span className="rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold text-muted shadow-sm backdrop-blur">{dayLabel(m.createdAt)}</span>
                    </div>
                  )}
                  <Bubble m={m} mine={mine} showSender={showSender} read={!!partnerRead && partnerRead >= m.createdAt} onAction={setAction} />
                </Fragment>
              );
            })}
            {typingNames.length > 0 && (
              <div className="ml-10 flex w-16 items-center justify-center gap-1 rounded-3xl rounded-bl-lg bg-bubble-in py-3 shadow-sm" aria-label="typing">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="size-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 120}ms` }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Composer chat={c} replyTo={replyTo} editing={editing} onDone={() => (setReplyTo(null), setEditing(null))} />

      <Sheet open={!!action} onClose={() => setAction(null)} title="Message">
        {action && (
          <div className="grid gap-1">
            <SheetAction icon={<CornerUpLeft />} label="Reply" onClick={() => (setReplyTo(action), setEditing(null), setAction(null))} />
            {action.sender.profileId === me.profileId && action.text && (
              <SheetAction icon={<Pencil />} label="Edit" onClick={() => (setEditing(action), setReplyTo(null), setAction(null))} />
            )}
            {action.sender.profileId === me.profileId && (
              <SheetAction icon={<Trash2 />} label="Delete for everyone" danger onClick={() => { const m = action; setAction(null); void confirmAction({ title: "Delete for everyone?", message: "Everyone in this chat will see “This message was deleted”.", confirmLabel: "Delete", danger: true }).then((ok) => ok && remove.mutate(m)); }} />
            )}
            {action.sender.profileId !== me.profileId && (
              <SheetAction
                icon={<Flag />}
                label="Report"
                danger
                onClick={() => {
                  void mu.report("MESSAGE", action.messageId, "Reported from chat").then(() => toast("Thanks — we'll take a look"), toastError);
                  setAction(null);
                }}
              />
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={menu} onClose={() => setMenu(false)} title={c.title}>
        <div className="grid gap-1">
          {c.type === "GROUP" && <SheetAction icon={<Info />} label="Group info" onClick={() => (setMenu(false), setInfo(true))} />}
          {partner && <SheetAction icon={<Info />} label="View profile" onClick={() => navigate(`/u/${partner.handle}`)} />}
          <SheetAction
            icon={c.mutedUntil ? <Bell /> : <BellOff />}
            label={c.mutedUntil ? "Unmute" : "Mute notifications"}
            onClick={() => (mute.mutate(!!c.mutedUntil), setMenu(false))}
          />
          {c.type === "GROUP" && <SheetAction icon={<LogOut />} label="Leave group" danger onClick={() => (setMenu(false), void confirmAction({ title: `Leave "${c.title}"?`, message: "You'll stop getting its messages. An admin can add you back.", confirmLabel: "Leave", danger: true }).then((ok) => ok && leave.mutate()))} />}
        </div>
      </Sheet>
      {c.type === "GROUP" && <GroupInfo chat={c} open={info} onClose={() => setInfo(false)} />}
    </div>
  );
}

export function SheetAction({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cx("flex items-center gap-3 rounded-2xl px-3 py-3 text-left font-medium hover:bg-surface-2 [&_svg]:size-5", danger && "text-danger")}>
      {icon}
      {label}
    </button>
  );
}

export type { Pages };
