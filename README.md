# Mu web app (mumu-frontend)

Installable PWA for phones and desktops: **Chats** first, then **Feed**, **Live**, **Alerts**
and the profile switcher (personal ⇄ business). Vite · React 19 · TypeScript · Tailwind 4 ·
TanStack Query · socket.io · [`mumu-rtc`](https://www.npmjs.com/package/mumu-rtc) for calls and lives.

```bash
cp .env.example .env    # VITE_API_URL (mumu-backend), VITE_IAM_URL, VITE_IAM_ACCESS_CODE (client mu)
pnpm install
pnpm dev                # http://localhost:5173
pnpm build              # dist/ + service worker
```

- Photos are shrunk in the browser to fit the 1 MB limit before upload.
- Light / dark / auto theme (Settings). Palette: Pylon blue `#00a8ff`, Periwinkle `#9c88ff`,
  Lynx white `#f5f6fa`, Electromagnetic `#2f3640`.
- Docker: `docker build --build-arg VITE_API_URL=… --build-arg VITE_IAM_URL=… --build-arg VITE_IAM_ACCESS_CODE=… .` (nginx).

**Browser test** (real call + live through MUMU RTC, Chrome fake camera):

```bash
APP_URL=http://localhost:5174 node e2e/calls-live.mjs
```

## Android app

The app is the live site (`https://mu.cryptdox.com`) in a native shell (Capacitor) — web deploys
reach it immediately. Camera/mic permissions, photo picker and the Android back button are wired up.

```bash
pnpm build && npx cap sync android        # after changing capacitor.config.ts / plugins / icons
cd android && JAVA_HOME=~/android-studio/jbr ./gradlew assembleDebug    # → app/build/outputs/apk/debug/app-debug.apk
```

**Release (Play Store)** — create a signing key once and keep it safe (lose it = no more updates):

```bash
cd android && ~/android-studio/jbr/bin/keytool -genkeypair -v -keystore mumu-release.jks -alias mumu -keyalg RSA -keysize 2048 -validity 10000
```

Then `android/keystore.properties` (gitignored):

```
storeFile=mumu-release.jks
storePassword=…
keyAlias=mumu
keyPassword=…
```

and `./gradlew bundleRelease` → `app/build/outputs/bundle/release/app-release.aab` (upload to Play Console).
Icons/splash come from `assets/` via `npx @capacitor/assets generate --android`.

