import { config } from "@/config";
import { deviceId } from "./device";

/** Error carrying the HTTP status and the API's message / details. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: { path: string; message: string }[] | Record<string, unknown>,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
  query?: Query;
  headers?: Record<string, string>;
  /** Attach the IAM access token and refresh on 401 (default true). */
  auth?: boolean;
}

interface TokenHooks {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  /** Profile to act as (x-profile-id) on Mu API calls. */
  getProfileId: () => string | null;
  /** This device was signed out (from another device) — end the session here. */
  onDeviceSignedOut?: () => void;
}

let hooks: TokenHooks = { getAccessToken: () => null, refresh: async () => null, getProfileId: () => null };
export function setTokenHooks(next: TokenHooks) {
  hooks = next;
}

let refreshing: Promise<string | null> | null = null;
export function refreshOnce() {
  refreshing ??= hooks.refresh().finally(() => (refreshing = null));
  return refreshing;
}

function buildUrl(base: string, path: string, query?: Query) {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function send<T>(base: string, path: string, opts: RequestOptions, token: string | null, profileId: string | null): Promise<T> {
  const res = await fetch(buildUrl(base, path, opts.query), {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body !== undefined && { "content-type": "application/json" }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...(profileId && { "x-profile-id": profileId }),
      ...(base === config.apiUrl && { "x-device-id": deviceId() }),
      ...opts.headers,
    },
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // empty body
  }
  if (!res.ok || json?.success === false) throw new ApiError(res.status, json?.message ?? res.statusText ?? "Request failed", json?.errors);
  return (json && "data" in json ? json.data : json) as T;
}

async function request<T>(base: string, path: string, opts: RequestOptions, withProfile: boolean): Promise<T> {
  const useAuth = opts.auth !== false;
  const token = useAuth ? hooks.getAccessToken() : null;
  const profileId = withProfile ? hooks.getProfileId() : null;
  try {
    return await send<T>(base, path, opts, token, profileId);
  } catch (err) {
    if (err instanceof ApiError && errorCode(err) === "DEVICE_SIGNED_OUT") {
      hooks.onDeviceSignedOut?.();
      throw err;
    }
    if (!(err instanceof ApiError) || err.status !== 401 || !useAuth || !token) throw err;
    const fresh = await refreshOnce();
    if (!fresh) throw err;
    return send<T>(base, path, opts, fresh, profileId);
  }
}

/** Mu API, as the active profile. */
export const api = <T>(path: string, opts: RequestOptions = {}) => request<T>(config.apiUrl, path, opts, true);
/** crypt-iam */
export const iam = <T>(path: string, opts: RequestOptions = {}) => request<T>(config.iamUrl, path, opts, false);

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403 && /access denied/i.test(err.message)) return "You don't have permission to do that.";
    if (err.status === 401 && /permissions not loaded/i.test(err.message)) return "Please sign in again.";
    if (Array.isArray(err.errors) && err.errors.length) return err.errors[0].message;
    return err.message;
  }
  if (err instanceof TypeError) return "You're offline or the server can't be reached.";
  return err instanceof Error ? err.message : String(err);
}

/** The API's machine-readable error code (e.g. "DEVICE_LIMIT", "LIVE_ON_OTHER_DEVICE"). */
export function errorCode(err: unknown): string | undefined {
  if (!(err instanceof ApiError) || !err.errors || Array.isArray(err.errors)) return undefined;
  return (err.errors as { code?: string }).code;
}
