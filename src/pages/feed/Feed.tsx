import { useState } from "react";
import { Link, useOutletContext } from "react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Compass, Radio } from "lucide-react";
import { mu } from "@/api/mu";
import { LoadMore, nextBefore } from "@/lib/infinite";
import { compact } from "@/lib/format";
import { Avatar, Empty, ErrorNote, Loading, Name, Tabs } from "@/components/ui";
import { TopBar } from "@/components/layout";
import { PostCard } from "./PostCard";
import { PostComposer } from "./Composer";

function LiveNow() {
  const live = useQuery({ queryKey: ["live"], queryFn: mu.live.list, refetchInterval: 30_000 });
  if (!live.data?.length) return null;
  return (
    <section className="border-b border-line bg-surface px-4 py-3 sm:rounded-3xl sm:border">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-danger"><Radio className="size-4" /> Live now</h2>
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-1">
        {live.data.map((s) => (
          <Link key={s.liveStreamId} to={`/live/${s.liveStreamId}`} className="flex w-20 shrink-0 flex-col items-center gap-1 text-center">
            <span className="rounded-full bg-gradient-to-tr from-danger to-accent p-[3px]">
              <span className="block rounded-full bg-surface p-[2px]"><Avatar profile={s.host} size={56} /></span>
            </span>
            <span className="w-full truncate text-xs font-semibold">{s.host.displayName}</span>
            <span className="text-[11px] text-muted">{compact(s.viewerCount)} watching</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Feed() {
  const { openSwitcher } = useOutletContext<{ openSwitcher: () => void }>();
  const [tab, setTab] = useState<"following" | "explore">("following");
  const feed = useInfiniteQuery({
    queryKey: ["posts", "feed", tab],
    queryFn: ({ pageParam }) => mu.posts.feed(tab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => nextBefore(last),
  });
  const posts = feed.data?.pages.flat() ?? [];

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <TopBar title="Feed" onAvatar={openSwitcher} />
      <div className="mx-auto flex max-w-[620px] flex-col sm:gap-3 sm:px-4 sm:py-4">
        <div className="bg-surface px-4 py-3 sm:rounded-full sm:bg-transparent sm:p-0">
          <Tabs value={tab} onChange={setTab} items={[{ value: "following", label: "Following" }, { value: "explore", label: "Explore" }]} />
        </div>
        <PostComposer />
        <LiveNow />
        <ErrorNote error={feed.error} onRetry={() => feed.refetch()} />
        {feed.isLoading ? (
          <Loading />
        ) : posts.length ? (
          posts.map((p) => <PostCard key={p.postId} post={p} />)
        ) : tab === "following" ? (
          <Empty icon={<Compass className="size-8" />} title="Your feed is quiet">
            Add friends or follow businesses to see their posts here — or{" "}
            <button onClick={() => setTab("explore")} className="font-semibold text-brand">explore</button> what everyone's sharing.
          </Empty>
        ) : (
          <Empty icon={<Compass className="size-8" />} title="Nothing public yet">Be the first to post!</Empty>
        )}
        <LoadMore hasMore={!!feed.hasNextPage} loading={feed.isFetchingNextPage} onMore={() => void feed.fetchNextPage()} />
      </div>
    </div>
  );
}

export { Name };
