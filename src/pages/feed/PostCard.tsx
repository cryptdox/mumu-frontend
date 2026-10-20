import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Flag, Heart, MessageCircle, MoreHorizontal, Pencil, Radio, Share2, Trash2 } from "lucide-react";
import { mu } from "@/api/mu";
import type { Post, ReactionType } from "@/api/types";
import { useProfile } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { compact, shortTime } from "@/lib/format";
import { Avatar, AudienceIcon, Button, CharCounter, IconButton, Name, Sheet, Textarea, audienceLabel, cx, toast, toastError } from "@/components/ui";
import { SheetAction } from "@/pages/chats/Thread";
import { charCount } from "@/lib/format";
import { LIMITS } from "@/config";

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "LIKE", emoji: "👍", label: "Like" },
  { type: "LOVE", emoji: "❤️", label: "Love" },
  { type: "HAHA", emoji: "😂", label: "Haha" },
  { type: "WOW", emoji: "😮", label: "Wow" },
  { type: "SAD", emoji: "😢", label: "Sad" },
];

/** Update a post wherever it's cached (feeds, profile lists, the post page). */
export function patchPost(postId: string, fn: (p: Post) => Post | null) {
  queryClient.setQueriesData<{ pages: Post[][]; pageParams: unknown[] }>({ queryKey: ["posts"] }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => page.map((p) => (p.postId === postId ? fn(p) : p)).filter((p): p is Post => !!p)) } : data,
  );
  queryClient.setQueryData<Post>(["post", postId], (p) => (p ? fn(p) ?? undefined : p));
}

export function PostCard({ post, linked = true }: { post: Post; linked?: boolean }) {
  const me = useProfile();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.text ?? "");
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mine = post.author.profileId === me.profileId;
  const current = REACTIONS.find((r) => r.type === post.myReaction);

  const react = useMutation({
    mutationFn: (type: ReactionType | null): Promise<{ myReaction: ReactionType | null; reactionCount: number }> =>
      type ? mu.posts.react(post.postId, type) : mu.posts.unreact(post.postId),
    onMutate: (type) => {
      const delta = type && !post.myReaction ? 1 : !type && post.myReaction ? -1 : 0;
      patchPost(post.postId, (p) => ({ ...p, myReaction: type, reactionCount: p.reactionCount + delta }));
    },
    onSuccess: (r) => patchPost(post.postId, (p) => ({ ...p, ...r })),
    onError: (err) => {
      patchPost(post.postId, (p) => ({ ...p, myReaction: post.myReaction, reactionCount: post.reactionCount }));
      toastError(err);
    },
  });
  const remove = useMutation({
    mutationFn: () => mu.posts.remove(post.postId),
    onSuccess: () => {
      patchPost(post.postId, () => null);
      toast("Post deleted");
      if (!linked) navigate(-1);
    },
    onError: toastError,
  });
  const save = useMutation({
    mutationFn: () => mu.posts.update(post.postId, { text: draft.trim() || null }),
    onSuccess: (p) => (patchPost(post.postId, () => p), setEditing(false)),
    onError: toastError,
  });

  const open = () => linked && navigate(`/posts/${post.postId}`);
  const share = async () => {
    const url = `${location.origin}/posts/${post.postId}`;
    try {
      if (navigator.share) await navigator.share({ url, text: post.text ?? undefined });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      // cancelled
    }
  };

  return (
    <article className="border-b border-line bg-surface px-4 py-3.5 sm:rounded-3xl sm:border sm:shadow-sm">
      <header className="flex items-center gap-3">
        <Link to={`/u/${post.author.handle}`}>
          <Avatar profile={post.author} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${post.author.handle}`} className="hover:underline">
            <Name profile={post.author} />
          </Link>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span>{shortTime(post.createdAt)}</span>·
            <span className="inline-flex items-center gap-1" title={audienceLabel(post.audience, post.author.kind)}>
              <AudienceIcon audience={post.audience} />
            </span>
            {post.editedAt && <span>· edited</span>}
          </p>
        </div>
        <IconButton label="Post options" onClick={() => setMenu(true)}>
          <MoreHorizontal className="size-5 text-muted" />
        </IconButton>
      </header>

      {post.liveStream && (
        <Link
          to={`/live/${post.liveStream.liveStreamId}`}
          className={cx("mt-3 flex items-center gap-3 rounded-2xl p-3", post.liveStream.status === "LIVE" ? "bg-gradient-to-r from-danger to-accent text-white" : "bg-surface-2 text-muted")}
        >
          <Radio className="size-5" />
          <span className="flex-1 font-semibold">{post.liveStream.status === "LIVE" ? `Live now · ${compact(post.liveStream.viewerCount)} watching` : "Live ended"}</span>
          {post.liveStream.status === "LIVE" && <span className="rounded-full bg-white/25 px-3 py-1 text-sm font-semibold">Watch</span>}
        </Link>
      )}

      {editing ? (
        <form onSubmit={(e) => (e.preventDefault(), save.mutate())} className="mt-3 space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <div className="flex items-center justify-end gap-2">
            <CharCounter text={draft} />
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" loading={save.isPending} disabled={charCount(draft) > LIMITS.text || (!draft.trim() && !post.media)}>Save</Button>
          </div>
        </form>
      ) : (
        post.text && (
          <p onClick={open} className={cx("mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed", linked && "cursor-pointer")}>
            {post.text}
          </p>
        )
      )}
      {post.media && (
        <button onClick={open} className="mt-3 block w-full overflow-hidden rounded-2xl bg-surface-2">
          <img
            src={post.media.url}
            alt=""
            loading="lazy"
            className="max-h-[520px] w-full object-cover"
            style={post.media.width && post.media.height ? { aspectRatio: `${post.media.width} / ${post.media.height}` } : undefined}
          />
        </button>
      )}

      <footer className="relative mt-2 flex items-center gap-1 text-sm font-semibold text-muted">
        <button
          onClick={() => react.mutate(post.myReaction ? null : "LIKE")}
          onPointerDown={() => (holdTimer.current = setTimeout(() => setPicker(true), 400))}
          onPointerUp={() => clearTimeout(holdTimer.current)}
          onPointerLeave={() => clearTimeout(holdTimer.current)}
          onMouseEnter={() => window.matchMedia("(hover: hover)").matches && setPicker(true)}
          onContextMenu={(e) => e.preventDefault()}
          className={cx("flex items-center gap-1.5 rounded-full px-3 py-2 transition hover:bg-surface-2", post.myReaction && "text-danger")}
          aria-label={post.myReaction ? "Remove reaction" : "Like"}
        >
          {current && current.type !== "LIKE" && current.type !== "LOVE" ? <span className="text-base leading-none">{current.emoji}</span> : <Heart className={cx("size-5", post.myReaction && "fill-current")} />}
          {post.reactionCount > 0 && compact(post.reactionCount)}
        </button>
        <button onClick={() => navigate(`/posts/${post.postId}`)} className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-surface-2" aria-label="Comments">
          <MessageCircle className="size-5" />
          {post.commentCount > 0 && compact(post.commentCount)}
        </button>
        <button onClick={share} className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-surface-2" aria-label="Share">
          <Share2 className="size-5" />
        </button>
        {picker && (
          <div className="absolute -top-12 left-0 z-10 flex gap-1 rounded-full bg-surface p-1.5 shadow-xl ring-1 ring-line" onMouseLeave={() => setPicker(false)}>
            {REACTIONS.map((r) => (
              <button
                key={r.type}
                onClick={() => (react.mutate(r.type), setPicker(false))}
                className={cx("flex size-10 items-center justify-center rounded-full text-2xl transition hover:scale-125", post.myReaction === r.type && "bg-brand/10")}
                aria-label={r.label}
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </footer>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Post">
        <div className="grid gap-1">
          {mine && <SheetAction icon={<Pencil />} label="Edit text" onClick={() => (setDraft(post.text ?? ""), setEditing(true), setMenu(false))} />}
          {mine && <SheetAction icon={<Trash2 />} label="Delete post" danger onClick={() => (setMenu(false), remove.mutate())} />}
          {!mine && (
            <SheetAction
              icon={<Flag />}
              label="Report post"
              danger
              onClick={() => {
                setMenu(false);
                void mu.report("POST", post.postId, "Reported from feed").then(() => toast("Thanks — we'll take a look"), toastError);
              }}
            />
          )}
          <SheetAction icon={<Share2 />} label="Share link" onClick={() => (setMenu(false), void share())} />
        </div>
      </Sheet>
    </article>
  );
}
