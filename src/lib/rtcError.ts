/** Plain-language text for a mumu-rtc join / media error. */
export function rtcErrorText(e: (Error & { code?: string }) | null | undefined): string | null {
  if (!e) return null;
  switch (e.code) {
    case "PLAN_LIMIT":
      return `Calling limit reached: ${e.message}`;
    case "QUOTA_EXCEEDED":
      return "This month's calling minutes are used up.";
    case "SUBSCRIPTION_EXPIRED":
      return "The calling plan has expired.";
    case "NO_MEDIA_SERVER":
      return "No media server is available right now. Try again in a minute.";
    case "MEDIA_PERMISSION":
      return "Allow camera and microphone access to continue.";
    case "NETWORK":
      return "Can't reach the media server. Check your connection.";
    default:
      return e.message || "Couldn't connect.";
  }
}
