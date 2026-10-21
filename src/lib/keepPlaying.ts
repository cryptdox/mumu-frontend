import { useEffect } from "react";

/**
 * Mobile browsers pause muted, autoplaying video when they decide it's hidden (a panel or
 * the keyboard covering it, the tab in the background) and don't always restart it — the
 * stream then looks black. Keep every <video> under `selector` playing while its track is live.
 */
export function useKeepVideosPlaying(selector: string, active = true) {
  useEffect(() => {
    if (!active) return;
    const resume = () => {
      for (const v of document.querySelectorAll<HTMLVideoElement>(`${selector} video`)) {
        const track = (v.srcObject as MediaStream | null)?.getVideoTracks()[0];
        if (v.paused && track?.readyState === "live") void v.play().catch(() => {});
      }
    };
    // "pause" doesn't bubble — listen in the capture phase on the document.
    document.addEventListener("pause", resume, true);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    const t = setInterval(resume, 2000);
    return () => {
      document.removeEventListener("pause", resume, true);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      clearInterval(t);
    };
  }, [selector, active]);
}
