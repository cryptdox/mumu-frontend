import { useMemo, useState } from "react";
import { NavLink, Outlet, useOutletContext, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { BellOff, Camera, MessageCirclePlus, MessageCircle, Phone, PhoneMissed, Search, Video } from "lucide-react";
import { mu } from "@/api/mu";
import type { Conversation, Message } from "@/api/types";
import { useProfile } from "@/lib/auth";
import { typingStore } from "@/lib/realtime";
import { useStore } from "@/lib/store";
import { shortTime } from "@/lib/format";
import { Avatar, Empty, ErrorNote, IconButton, Loading, cx } from "@/components/ui";
import { TopBar } from "@/components/layout";
import { NewChatSheet } from "./NewChat";

export function preview(m: Message | null, me: string) {
  if (!m) return "No messages yet";
  const who = m.sender.profileId === me ? "You: " : "";
  if (m.deletedAt) return `${who}Message deleted`;
  if (m.kind === "SYSTEM") return `${m.sender.profileId === me ? "You" : m.sender.displayName} ${m.text}`;
  if (m.kind === "CALL" && m.call) {
    const kind = m.call.type === "VIDEO" ? "Video call" : "Voice call";
    return m.call.status === "MISSED" ? `Missed ${kind.toLowerCase()}` : m.call.status === "ENDED" ? kind : `${kind} · ongoing`;
  }
  if (m.media && !m.text) return `${who}📷 Photo`;
  return `${who}${m.text ?? ""}`;
}

function PreviewIcon({ m }: { m: Message | null }) {
  if (!m) return null;
  if (m.kind === "CALL" && m.call) {
    if (m.call.status === "MISSED") return <PhoneMissed className="size-4 shrink-0 text-danger" />;
    return m.call.type === "VIDEO" ? <Video className="size-4 shrink-0" /> : <Phone className="size-4 shrink-0" />;
  }
  if (m.media && !m.deletedAt) return <Camera className="size-4 shrink-0" />;
  return null;
}

function ChatRow({ c, me }: { c: Conversation; me: string }) {
  const typing = useStore(typingStore)[c.conversationId]?.filter((id) => id !== me) ?? [];
  const avatar = c.partner ?? { displayName: c.title, avatarUrl: c.avatarUrl, kind: "PERSONAL" as const };
  return (
    <NavLink
      to={`/chats/${c.conversationId}`}
      className={({ isActive }) => cx("flex items-center gap-3 rounded-2xl px-3 py-2.5 transition", isActive ? "bg-brand/10" : "hover:bg-surface-2")}
    >
      <Avatar profile={avatar} size={52} online={c.partner?.online} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="flex-1 truncate font-semibold">{c.title}</span>
          <span className={cx("shrink-0 text-xs", c.unread ? "font-semibold text-brand" : "text-muted")}>{shortTime(c.lastMessageAt)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {typing.length ? (
            <span className="flex-1 truncate text-sm font-medium text-brand">typing…</span>
          ) : (
            <span className={cx("flex min-w-0 flex-1 items-center gap-1 text-sm", c.unread ? "font-medium text-ink" : "text-muted")}>
              <PreviewIcon m={c.lastMessage} />
              <span className="truncate">{preview(c.lastMessage, me)}</span>
            </span>
          )}
          {c.mutedUntil && <BellOff className="size-3.5 shrink-0 text-muted" />}
          {c.unread > 0 && <span className={cx("min-w-5 shrink-0 rounded-full px-1.5 text-center text-xs font-bold leading-5 text-white", c.mutedUntil ? "bg-muted" : "bg-brand")}>{c.unread}</span>}
        </div>
      </div>
    </NavLink>
  );
}

/** Chats: list on the left (or full screen on phones), the open chat on the right. */
export default function ChatsLayout() {
  const me = useProfile();
  const { id } = useParams();
  const { openSwitcher } = useOutletContext<{ openSwitcher: () => void }>();
  const [q, setQ] = useState("");
  const [newChat, setNewChat] = useState(false);
  const chats = useQuery({ queryKey: ["chats"], queryFn: mu.chats.list });
  const list = useMemo(() => (chats.data ?? []).filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase())), [chats.data, q]);

  return (
    <div className="flex min-h-0 flex-1">
      <section className={cx("flex min-h-0 w-full flex-col border-r border-line bg-surface md:w-[360px] md:shrink-0 lg:w-[400px]", id && "hidden md:flex")}>
        <TopBar title={me.kind === "BUSINESS" ? `${me.displayName} inbox` : "Chats"} onAvatar={openSwitcher}>
          <IconButton label="New chat" onClick={() => setNewChat(true)} className="text-brand">
            <MessageCirclePlus className="size-6" />
          </IconButton>
        </TopBar>
        <div className="px-4 pb-2 pt-3">
          <label className="flex h-10 items-center gap-2 rounded-full bg-surface-2 px-4 text-muted">
            <Search className="size-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted focus-visible:outline-none" />
          </label>
        </div>
        <ErrorNote error={chats.error} onRetry={() => chats.refetch()} />
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {chats.isLoading ? (
            <Loading />
          ) : list.length ? (
            list.map((c) => <ChatRow key={c.conversationId} c={c} me={me.profileId} />)
          ) : (
            <Empty icon={<MessageCircle className="size-8" />} title={q ? "No matches" : "No chats yet"}>
              {!q && (
                <button onClick={() => setNewChat(true)} className="font-semibold text-brand">
                  Start a conversation
                </button>
              )}
            </Empty>
          )}
        </div>
      </section>
      <section className={cx("min-h-0 min-w-0 flex-1 flex-col", id ? "flex" : "hidden md:flex")}>
        <Outlet />
      </section>
      <NewChatSheet open={newChat} onClose={() => setNewChat(false)} />
    </div>
  );
}

export function NoChatSelected() {
  return (
    <Empty icon={<MessageCircle className="size-8" />} title="Your messages">
      Pick a chat, or start a new one with a friend or a business.
    </Empty>
  );
}
