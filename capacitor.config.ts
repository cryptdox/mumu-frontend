import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android app = the live web app (https://mu.cryptdox.com) in a native shell: same domain,
 * so sign-in (captcha), API and sockets work unchanged, and every web deploy reaches the app
 * at once. Override with CAP_SERVER_URL (e.g. a staging URL) when running `npx cap sync`.
 */
const config: CapacitorConfig = {
  appId: "mu.cryptdox.com",
  appName: "MuMu",
  webDir: "dist",
  server: {
    url: process.env.CAP_SERVER_URL ?? "https://mu.cryptdox.com",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#f5f6fa",
  },
};

export default config;
