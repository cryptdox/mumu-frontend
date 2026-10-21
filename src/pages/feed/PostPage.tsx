import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CornerDownRight, SendHorizontal, Trash2, X } from "lucide-react";
import { mu } from "@/api/mu";
import type { Comment } from "@/api/types";
import { useProfile } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { LoadMore, nextBefore } from "@/lib/infinite";
import { charCount, shortTime } from "@/lib/format";
import { LIMITS } from "@/config";
import { Avatar, CharCounter, ErrorNote, IconButton, Loading, Name, confirmThen, toastError } from "@/components/ui";
import { PostCard, patchPost } from "./PostCard";

export default function PostPage() {
  const { postId = "" } = useParams();
  const me = useProfile();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const post = useQuery({ queryKey: ["post", postId], queryFn: () => mu.posts.get(postId) });
  const comments = useInfiniteQuery({
    queryKey: ["comments", postId],
    queryFn: ({ pageParam }) => mu.posts.comments(postId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => nextBefore(last),
  });
  const all = comments.data?.pages.flat() ?? [];
  const top = all.filter((c) => !c.parentId);
  const replies = (id: string) => all.filter((c) => c.parentId === id).reverse();

  const send = useMutation({
    mutationFn: () => mu.posts.comment(postId, text.trim(), replyTo?.commentId),
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      patchPost(postId, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
    onError: toastError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => mu.posts.removeComment(id),
    onSuccess: () => {
      patchPost(postId, (p) => ({ ...p, commentCount: Math.max(0, p.commentCount - 1) }));
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
    onError: toastError,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() && charCount(text) <= LIMITS.text) send.mutate();
  };

  const CommentRow = ({ c, reply }: { c: Comment; reply?: boolean }) => (
    <div className={reply ? "ml-12 mt-2" : "mt-4"}>
      <div className="flex gap-2.5">
        <Link to={`/u/${c.author.handle}`}><Avatar profile={c.author} size={reply ? 28 : 36} /></Link>
        <div className="min-w-0 flex-1">
          <div className="inline-block max-w-full rounded-2xl bg-surface-2 px-3.5 py-2">
            <Link to={`/u/${c.author.handle}`} className="text-sm hover:underline"><Name profile={c.author} /></Link>
            <p className="whitespace-pre-wrap break-words text-[15px]">{c.text}</p>
          </div>
          <div className="mt-0.5 flex items-center gap-3 px-2 text-xs font-semibold text-muted">
            <span className="font-normal">{shortTime(c.createdAt)}</span>
            {!reply && <button onClick={() => setReplyTo(c)} className="hover:text-ink">Reply</button>}
            {(c.author.profileId === me.profileId || post.data?.author.profileId === me.profileId) && (
              <button onClick={confirmThen({ title: "Delete this comment?", confirmLabel: "Delete", danger: true }, () => remove.mutate(c.commentId))} className="hover:text-danger" aria-label="Delete comment"><Trash2 className="size-3.5" /></button>
            )}
          </div>
        </div>
      </div>
      {!reply && replies(c.commentId).map((r) => <CommentRow key={r.commentId} c={r} reply />)}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-2">
        <IconButton label="Back" onClick={() => navigate(-1)}><ArrowLeft className="size-6" /></IconButton>
        <h1 className="text-lg font-bold">Post</h1>
      </header>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[620px] sm:p-4">
          {post.isLoading ? <Loading /> : post.error ? <ErrorNote error={post.error} /> : post.data && <PostCard post={post.data} linked={false} />}
          <section className="bg-surface px-4 pb-6 pt-1 sm:mt-3 sm:rounded-3xl sm:border sm:border-line">
            {top.map((c) => <CommentRow key={c.commentId} c={c} />)}
            {!comments.isLoading && !all.length && <p className="py-8 text-center text-sm text-muted">No comments yet — start the conversation.</p>}
            <LoadMore hasMore={!!comments.hasNextPage} loading={comments.isFetchingNextPage} onMore={() => void comments.fetchNextPage()} />
          </section>
        </div>
      </div>
      {post.data && (
        <form onSubmit={submit} className="safe-bottom shrink-0 border-t border-line bg-surface p-3">
          {replyTo && (
            <div className="mx-auto mb-2 flex max-w-[620px] items-center gap-2 text-sm text-muted">
              <CornerDownRight className="size-4" /> Replying to <b className="text-ink">{replyTo.author.displayName}</b>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="size-4" /></button>
            </div>
          )}
          <div className="mx-auto flex max-w-[620px] items-center gap-2">
            <Avatar profile={me} size={36} />
            <div className="flex flex-1 items-center rounded-full bg-surface-2 px-4">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment" aria-label="Write a comment" className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-muted focus-visible:outline-none" />
              <CharCounter text={text} />
            </div>
            <IconButton type="submit" label="Send comment" disabled={!text.trim() || send.isPending || charCount(text) > LIMITS.text} className="bg-brand text-white hover:bg-brand-strong">
              <SendHorizontal className="size-5" />
            </IconButton>
          </div>
        </form>
      )}
    </div>
  );
}
