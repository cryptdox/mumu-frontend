import { useEffect } from "react";
import { Link, useOutletContext } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Check, X } from "lucide-react";
import { mu } from "@/api/mu";
import type { Notification } from "@/api/types";
import { queryClient } from "@/lib/query";
import { unreadStore } from "@/lib/realtime";
import { shortTime } from "@/lib/format";
import { Avatar, Empty, ErrorNote, IconButton, Loading, cx, toastError } from "@/components/ui";
import { TopBar } from "@/components/layout";

const text: Record<Notification["type"], string> = {
  FRIEND_REQUEST: "sent you a friend request",
  FRIEND_ACCEPTED: "accepted your friend request",
  NEW_FOLLOWER: "started following you",
  POST_REACTION: "reacted to your post",
  POST_COMMENT: "commented on your post",
  COMMENT_REPLY: "replied to your comment",
  LIVE_STARTED: "is live now",
  MISSED_CALL: "tried to call you",
  ADDED_TO_GROUP: "added you to a group",
};

function linkOf(n: Notification) {
  switch (n.type) {
    case "POST_REACTION":
    case "POST_COMMENT":
    case "COMMENT_REPLY":
      return `/posts/${n.entityId}`;
    case "LIVE_STARTED":
      return `/live/${n.entityId}`;
    case "MISSED_CALL":
    case "ADDED_TO_GROUP":
      return `/chats/${n.entityId}`;
    default:
      return n.actor ? `/u/${n.actor.handle}` : "#";
  }
}

function Requests() {
  const reqs = useQuery({ queryKey: ["friend-requests"], queryFn: () => mu.connections.requests("in") });
  const act = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => (accept ? mu.connections.accept(id) : mu.connections.removeFriend(id)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["friend-requests"] }),
    onError: toastError,
  });
  if (!reqs.data?.length) return null;
  return (
    <section className="border-b border-line bg-surface px-4 py-3 sm:rounded-3xl sm:border">
      <h2 className="mb-2 text-sm font-bold">Friend requests · {reqs.data.length}</h2>
      {reqs.data.map(({ profile }) => (
        <div key={profile.profileId} className="flex items-center gap-3 py-1.5">
          <Link to={`/u/${profile.handle}`}><Avatar profile={profile} size={44} /></Link>
          <Link to={`/u/${profile.handle}`} className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{profile.displayName}</span>
            <span className="block truncate text-sm text-muted">@{profile.handle}</span>
          </Link>
          <IconButton label="Accept" onClick={() => act.mutate({ id: profile.profileId, accept: true })} className="bg-brand text-white hover:bg-brand-strong"><Check className="size-5" /></IconButton>
          <IconButton label="Decline" onClick={() => act.mutate({ id: profile.profileId, accept: false })} className="bg-surface-2"><X className="size-5" /></IconButton>
        </div>
      ))}
    </section>
  );
}

export default function Notifications() {
  const { openSwitcher } = useOutletContext<{ openSwitcher: () => void }>();
  const notes = useQuery({ queryKey: ["notifications"], queryFn: () => mu.notifications.list() });

  // Opening the tab marks everything read.
  useEffect(() => {
    if (!notes.data?.unread) return;
    void mu.notifications.readAll().then(() => {
      unreadStore.set({ notifications: 0 });
      queryClient.setQueryData(["notifications"], (d: { items: Notification[]; unread: number } | undefined) => d && { ...d, unread: 0 });
    });
  }, [notes.data?.unread]);

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <TopBar title="Notifications" onAvatar={openSwitcher} />
      <div className="mx-auto flex max-w-[620px] flex-col sm:gap-3 sm:p-4">
        <Requests />
        <ErrorNote error={notes.error} onRetry={() => notes.refetch()} />
        {notes.isLoading ? (
          <Loading />
        ) : notes.data?.items.length ? (
          <ul className="bg-surface sm:rounded-3xl sm:border sm:border-line">
            {notes.data.items.map((n) => (
              <li key={n.notificationId}>
                <Link to={linkOf(n)} className={cx("flex items-center gap-3 px-4 py-3 hover:bg-surface-2 sm:first:rounded-t-3xl sm:last:rounded-b-3xl", !n.readAt && "bg-brand/5")}>
                  {n.actor ? <Avatar profile={n.actor} size={44} /> : <span className="size-11 rounded-full bg-surface-2" />}
                  <p className="min-w-0 flex-1 text-[15px]">
                    <b>{n.actor?.displayName ?? "Someone"}</b> {text[n.type]}
                    <span className="block text-xs text-muted">{shortTime(n.createdAt)}</span>
                  </p>
                  {!n.readAt && <span className="size-2.5 shrink-0 rounded-full bg-brand" />}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={<Bell className="size-8" />} title="You're all caught up">Reactions, comments, follows and lives show up here.</Empty>
        )}
      </div>
    </div>
  );
}
