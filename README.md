# MuMu web app (mumu-frontend)

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
