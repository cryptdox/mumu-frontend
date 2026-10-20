import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui";

/** Loads the next page when it scrolls into view. */
export function LoadMore({ hasMore, loading, onMore }: { hasMore: boolean; loading: boolean; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && !loading && onMore(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onMore]);
  if (!hasMore) return null;
  return <div ref={ref} className="flex justify-center py-6">{loading && <Spinner />}</div>;
}

/** Cursor for the next page: createdAt of the last item, or undefined at the end. */
export const nextBefore = <T extends { createdAt: string }>(last: T[], size = 20) => (last.length < size ? undefined : last[last.length - 1].createdAt);
