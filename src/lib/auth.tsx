import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, iam, setTokenHooks } from "./api";
import { deviceId } from "./device";
import { queryClient } from "./query";
import { config } from "@/config";
import { mu } from "@/api/mu";
import type { Account, MyProfile } from "@/api/types";

export interface SessionUser {
  userId: string;
  email: string;
  name?: string;
  isEmailVerified: boolean;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  /** The profile everything is done as (personal or a business you manage). */
  profileId?: string;
}

// ── Session store (module level so the API client can read it before React mounts) ──

const KEY = "mu.session";
const listeners = new Set<() => void>();

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

let current: Session | null = load();

function setSession(next: Session | null) {
  const profileChanged = current?.profileId !== next?.profileId;
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable — keep the session in memory
  }
  if (!next) queryClient.clear();
  else if (profileChanged) queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    current = load();
    if (!current) queryClient.clear();
    listeners.forEach((l) => l());
  });
}

setTokenHooks({
  getAccessToken: () => current?.accessToken ?? null,
  getProfileId: () => current?.profileId ?? null,
  onDeviceSignedOut: () => setSession(null),
  refresh: async () => {
    const s = current;
    if (!s) return null;
    try {
      const { accessToken } = await iam<{ accessToken: string }>("/api/auth/refresh", { method: "POST", auth: false, body: { refreshToken: s.refreshToken } });
      if (current?.refreshToken === s.refreshToken) setSession({ ...current, accessToken });
      return accessToken;
    } catch {
      if (current?.refreshToken === s.refreshToken) setSession(null);
      return null;
    }
  },
});

export const getAccessToken = () => current?.accessToken ?? null;
/** Signed out from another device (socket push or a 401 DEVICE_SIGNED_OUT). */
export const endSessionHere = () => setSession(null);
export const accessCodeHeader = () => ({ "x-cr-access-code": config.iamAccessCode });

// ── React binding ───────────────────────────────────────────────────────────

interface AuthValue {
  user: SessionUser | null;
  token: string | null;
  account: Account | undefined;
  /** The active profile (falls back to your personal profile). */
  profile: MyProfile | undefined;
  profiles: MyProfile[];
  switchProfile: (profileId: string) => void;
  login: (input: { email: string; password: string; captchaToken: string }) => Promise<void>;
  register: (input: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribe, () => current);
  const me = useQuery({ queryKey: ["me", session?.user.userId], queryFn: mu.me, enabled: !!session, staleTime: 60_000 });

  const profiles = me.data?.profiles ?? [];
  // Providers first: the chosen profile, else your first Provider, else (before setup) the Consumer.
  const profile =
    profiles.find((p) => p.profileId === session?.profileId) ?? profiles.find((p) => p.kind === "BUSINESS") ?? profiles.find((p) => p.kind === "PERSONAL");

  // Make the default explicit so every request acts as it (x-profile-id).
  useEffect(() => {
    if (profile && current && current.profileId !== profile.profileId) setSession({ ...current, profileId: profile.profileId });
  }, [profile?.profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Forget a profile you no longer manage (removed as admin, page deleted).
  useEffect(() => {
    if (session?.profileId && me.data && !profiles.some((p) => p.profileId === session.profileId) && current) {
      setSession({ ...current, profileId: undefined });
    }
  }, [me.data, session?.profileId, profiles]);

  const switchProfile = useCallback((profileId: string) => {
    if (!current) return;
    setSession({ ...current, profileId });
  }, []);

  const login = useCallback<AuthValue["login"]>(async ({ email, password, captchaToken }) => {
    const data = await iam<Session>("/api/auth/login", { method: "POST", auth: false, headers: accessCodeHeader(), body: { email, password, captchaToken } });
    queryClient.clear();
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
  }, []);

  const register = useCallback<AuthValue["register"]>(async (input) => {
    await iam("/api/auth/register", { method: "POST", auth: false, headers: accessCodeHeader(), body: input });
  }, []);

  const logout = useCallback(async () => {
    try {
      // Free this device's slot (max 3 devices), then end the IAM session.
      if (current) await api(`/api/me/devices/${deviceId()}`, { method: "DELETE" }).catch(() => {});
      if (current) await iam("/api/auth/logout", { method: "POST" });
    } catch {
      // already invalid — clear locally anyway
    }
    setSession(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user: session?.user ?? null, token: session?.accessToken ?? null, account: me.data, profile, profiles, switchProfile, login, register, logout }),
    [session, me.data, profile, profiles, switchProfile, login, register, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

/** The active profile — only use under a route that waits for it. */
export function useProfile(): MyProfile {
  const { profile } = useAuth();
  if (!profile) throw new Error("No active profile yet");
  return profile;
}
