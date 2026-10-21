/** This browser's id for Mu's 3-device limit (kept in local storage, shared by its tabs). */
const KEY = "mu.device";
let cached: string | null = null;

export function deviceId(): string {
  if (cached) return cached;
  try {
    cached = localStorage.getItem(KEY);
    if (!cached) {
      cached = crypto.randomUUID();
      localStorage.setItem(KEY, cached);
    }
  } catch {
    cached ??= crypto.randomUUID();
  }
  return cached;
}
