const env = import.meta.env;

// Cloudflare's always-pass Turnstile site key; crypt-iam accepts it outside PROD.
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const trim = (url: string | undefined, fallback: string) => (url || fallback).replace(/\/+$/, "");

export const config = {
  apiUrl: trim(env.VITE_API_URL, "http://localhost:4100"),
  iamUrl: trim(env.VITE_IAM_URL, "http://localhost:3000"),
  iamAccessCode: env.VITE_IAM_ACCESS_CODE ?? "",
  turnstileSiteKey: env.VITE_TURNSTILE_SITE_KEY || (env.DEV ? TURNSTILE_TEST_SITE_KEY : ""),
};

export const LIMITS = { text: 500, imageBytes: 1024 * 1024 };
