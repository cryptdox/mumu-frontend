import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/query";
import { cx } from "./ui";

const TRIGGER = 70; // px of (damped) pull that refreshes on release
const MAX = 110;

/** The element that would scroll for a touch here (the app scrolls inner panes, not the page). */
function scrollerOf(el: Element | null) {
  for (; el && el !== document.body; el = el.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

/**
 * Pull down at the top of a screen to refresh it, like other Android apps. Refetches the data on
 * screen (no page reload, so you keep your place and stay signed in). Touch screens only.
 */
export function PullToRefresh({ disabled }: { disabled?: boolean }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (disabled || !window.matchMedia("(pointer: coarse)").matches) return;
    let tracking = false;
    let startX = 0;
    let startY = 0;
    let dist = 0;

    const refresh = async () => {
      busyRef.current = true;
      setBusy(true);
      await Promise.all([queryClient.refetchQueries({ type: "active" }).catch(() => {}), new Promise((r) => setTimeout(r, 600))]);
      busyRef.current = false;
      setBusy(false);
    };
    const start = (e: TouchEvent) => {
      tracking = false;
      if (busyRef.current || e.touches.length !== 1) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const target = e.target as Element;
      if (target.closest("input, textarea, select, [contenteditable], [data-no-pull]")) return;
      if ((scrollerOf(target)?.scrollTop ?? window.scrollY) > 0) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dist = 0;
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      const dx = Math.abs(e.touches[0].clientX - startX);
      if (dy <= 0 || dx > dy) {
        // Scrolling up or sideways — not a pull.
        if (dist === 0) tracking = false;
        dist = 0;
        setPull(0);
        return;
      }
      dist = Math.min(dy * 0.5, MAX);
      setPull(dist);
    };
    const end = () => {
      if (!tracking) return;
      tracking = false;
      if (dist >= TRIGGER) void refresh();
      dist = 0;
      setPull(0);
    };

    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", end);
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
    };
  }, [disabled]);

  if (!pull && !busy) return null;
  const y = busy ? 18 : pull - 30;
  const ready = pull >= TRIGGER;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center" style={{ paddingTop: "env(safe-area-inset-top)" }} aria-live="polite">
      <span
        className={cx("flex size-10 items-center justify-center rounded-full bg-surface shadow-lg ring-1 ring-line", ready || busy ? "text-brand" : "text-muted")}
        style={{ transform: `translateY(${y}px)`, opacity: busy ? 1 : Math.min(pull / TRIGGER, 1), transition: busy ? "transform .2s" : undefined }}
      >
        <RefreshCw className={cx("size-5", busy && "animate-spin")} style={busy ? undefined : { transform: `rotate(${pull * 3}deg)` }} />
        <span className="sr-only">{busy ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"}</span>
      </span>
    </div>
  );
}
