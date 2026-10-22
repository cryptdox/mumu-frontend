import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, Flag, Globe, MessageCircle, MoreHorizontal, Settings, Share2, UserCheck, UserMinus, UserPlus } from "lucide-react";
import { mu } from "@/api/mu";
import type { ProfileView } from "@/api/types";
import { useAuth, useProfile } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { refreshConnections } from "@/lib/realtime";
import { LoadMore, nextBefore } from "@/lib/infinite";
import { compact } from "@/lib/format";
import { Avatar, Button, Empty, ErrorNote, IconButton, Loading, Name, Sheet, confirmAction, cx, toast, toastError } from "@/components/ui";
import { SheetAction } from "@/pages/chats/Thread";
import { PersonRow } from "@/pages/chats/NewChat";
import { PostCard } from "@/pages/feed/PostCard";

function Relationship({ p }: { p: ProfileView }) {
  const navigate = useNavigate();
  const { handle = p.handle } = useParams();
  type Rel = ProfileView["relationship"];
  // The button flips at once (optimistic); the server's answer then refreshes it.
  const act = useMutation({
    mutationFn: ({ run }: { run: () => Promise<unknown>; next: Partial<Rel> }) => run(),
    onMutate: ({ next }) => {
      const before = queryClient.getQueryData<ProfileView>(["profile-view", handle]);
      queryClient.setQueryData<ProfileView>(["profile-view", handle], (v) => v && { ...v, relationship: { ...v.relationship, ...next } });
      return { before };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.before) queryClient.setQueryData(["profile-view", handle], ctx.before);
      toastError(err);
    },
    onSettled: refreshConnections,
  });
  const busy = act.isPending;
  const message = useMutation({
    mutationFn: () => mu.chats.direct(p.profileId),
    onSuccess: (c) => navigate(`/chats/${c.conversationId}`),
    onError: toastError,
  });
  const r = p.relationship;
  const canFriend = !r.isSelf;
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => message.mutate()} loading={message.isPending}>
        <MessageCircle className="size-4" /> Message
      </Button>
      {canFriend &&
        (r.friendStatus === "FRIENDS" ? (
          <Button variant="secondary" disabled={busy} onClick={() => act.mutate({ run: () => mu.connections.removeFriend(p.profileId), next: { friendStatus: "NONE" } })}>
            <UserCheck className="size-4" /> Connected
          </Button>
        ) : r.friendStatus === "REQUEST_RECEIVED" ? (
          <Button variant="accent" disabled={busy} onClick={() => act.mutate({ run: () => mu.connections.accept(p.profileId), next: { friendStatus: "FRIENDS" } })}>
            <UserPlus className="size-4" /> Accept
          </Button>
        ) : r.friendStatus === "REQUEST_SENT" ? (
          <Button variant="secondary" disabled={busy} onClick={() => act.mutate({ run: () => mu.connections.removeFriend(p.profileId), next: { friendStatus: "NONE" } })}>
            Requested
          </Button>
        ) : (
          <Button variant="secondary" disabled={busy} onClick={() => act.mutate({ run: () => mu.connections.addFriend(p.profileId), next: { friendStatus: "REQUEST_SENT" } })}>
            <UserPlus className="size-4" /> Connect
          </Button>
        ))}
      <Button variant={r.following ? "secondary" : p.kind === "BUSINESS" ? "accent" : "secondary"} disabled={busy} onClick={() => act.mutate({ run: () => (r.following ? mu.connections.unfollow(p.profileId) : mu.connections.follow(p.profileId)), next: { following: !r.following } })}>
        {r.following ? <><UserMinus className="size-4" /> Following</> : "Follow"}
      </Button>
    </div>
  );
}

/** Share the profile link — opening it shows the profile with Connect / Follow / Message. */
async function shareProfile(p: { handle: string; displayName: string }) {
  const url = `${location.origin}/u/${p.handle}`;
  try {
    if (navigator.share) await navigator.share({ title: p.displayName, text: `${p.displayName} on Mu`, url });
    else {
      await navigator.clipboard.writeText(url);
      toast("Profile link copied");
    }
  } catch {
    // share sheet closed
  }
}

export default function ProfilePage() {
  const { handle = "" } = useParams();
  const me = useProfile();
  const { profiles } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [list, setList] = useState<"friends" | "followers" | "following" | null>(null);
  const view = useQuery({ queryKey: ["profile-view", handle], queryFn: () => mu.profiles.get(handle) });
  const p = view.data;
  const posts = useInfiniteQuery({
    queryKey: ["posts", "by", p?.profileId],
    queryFn: ({ pageParam }) => mu.posts.byProfile(p!.profileId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => nextBefore(last),
    enabled: !!p,
  });
  const people = useQuery({ queryKey: ["people", p?.profileId, list], queryFn: () => mu.connections.list(p!.profileId, list!), enabled: !!p && !!list });
  const block = useMutation({
    mutationFn: () => (p!.relationship.blocked ? mu.connections.unblock(p!.profileId) : mu.connections.block(p!.profileId)),
    onSuccess: () => {
      setMenu(false);
      toast(p!.relationship.blocked ? "Unblocked" : "Blocked");
      void queryClient.invalidateQueries({ queryKey: ["profile-view", handle] });
    },
    onError: toastError,
  });

  if (view.isLoading) return <Loading />;
  if (view.error || !p) return <ErrorNote error={view.error ?? new Error("Profile not found")} />;
  const managesIt = profiles.some((x) => x.profileId === p.profileId);
  const all = posts.data?.pages.flat() ?? [];
  const stats = [
    { key: "friends" as const, n: p.counts.friends, label: "Connections" },
    { key: "followers" as const, n: p.counts.followers, label: "Followers" },
    { key: "following" as const, n: p.counts.following, label: "Following" },
  ];

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="relative h-36 bg-gradient-to-br from-brand to-accent sm:h-52">
        {p.coverUrl && <img src={p.coverUrl} alt="" className="size-full object-cover" />}
        <IconButton label="Back" onClick={() => navigate(-1)} className="absolute left-3 top-3 bg-black/30 text-white hover:bg-black/50">
          <ArrowLeft className="size-5" />
        </IconButton>
      </div>
      <div className="mx-auto max-w-[620px]">
        <section className="bg-surface px-4 pb-4 sm:mt-0 sm:rounded-b-3xl">
          <div className="-mt-12 flex items-end justify-between gap-3">
            <span className="rounded-full bg-surface p-1">
              <Avatar profile={p} size={96} online={p.online && !p.relationship.isSelf} />
            </span>
            <div className="flex gap-1 pb-1">
              <IconButton label="Share profile" onClick={() => void shareProfile(p)}><Share2 className="size-5" /></IconButton>
              {managesIt ? (
                <Link to="/settings"><Button variant="secondary" size="sm"><Settings className="size-4" /> Edit profile</Button></Link>
              ) : (
                <IconButton label="More" onClick={() => setMenu(true)}><MoreHorizontal className="size-5" /></IconButton>
              )}
            </div>
          </div>
          <h1 className="mt-2 text-2xl font-bold"><Name profile={p} /></h1>
          <p className="text-muted">@{p.handle}{p.category && ` · ${p.category}`}</p>
          {p.bio && <p className="mt-3 whitespace-pre-wrap">{p.bio}</p>}
          {p.website && (
            <a href={p.website} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
              <Globe className="size-4" /> {p.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          <div className="mt-3 flex gap-5 text-sm">
            {stats.map((s) => (
              <button key={s.key} onClick={() => setList(s.key)} className="hover:underline">
                <b>{compact(s.n)}</b> <span className="text-muted">{s.label}</span>
              </button>
            ))}
          </div>
          {!p.relationship.isSelf && !managesIt && (
            <div className="mt-4">
              {p.relationship.blocked ? (
                <Button variant="secondary" onClick={() => block.mutate()}>Unblock</Button>
              ) : (
                <Relationship p={p} />
              )}
            </div>
          )}
        </section>
        <div className="flex flex-col sm:mt-3 sm:gap-3">
          {all.map((post) => <PostCard key={post.postId} post={post} />)}
          {!posts.isLoading && !all.length && <Empty icon={<MessageCircle className="size-8" />} title="No posts to show" />}
          <LoadMore hasMore={!!posts.hasNextPage} loading={posts.isFetchingNextPage} onMore={() => void posts.fetchNextPage()} />
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={p.displayName}>
        <div className="grid gap-1">
          <SheetAction icon={<Ban />} label={p.relationship.blocked ? "Unblock" : `Block ${p.displayName}`} danger onClick={() => { setMenu(false); if (p.relationship.blocked) return block.mutate(); void confirmAction({ title: `Block ${p.displayName}?`, message: "You won't see each other's posts or lives, and they can't message or call you. Your connection and follows end.", confirmLabel: "Block", danger: true }).then((ok) => ok && block.mutate()); }} />
          <SheetAction
            icon={<Flag />}
            label="Report profile"
            danger
            onClick={() => {
              setMenu(false);
              void mu.report("PROFILE", p.profileId, "Reported from profile").then(() => toast("Thanks — we'll take a look"), toastError);
            }}
          />
        </div>
      </Sheet>
      <Sheet open={!!list} onClose={() => setList(null)} title={list ? list[0].toUpperCase() + list.slice(1) : ""}>
        {people.isLoading ? <Loading /> : people.data?.length ? (
          people.data.map((x) => <PersonRow key={x.profileId} p={x} onClick={() => (setList(null), navigate(`/u/${x.handle}`))} />)
        ) : (
          <p className={cx("py-8 text-center text-sm text-muted")}>Nobody here yet.</p>
        )}
      </Sheet>
      {me && null}
    </div>
  );
}
