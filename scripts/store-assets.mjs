#!/usr/bin/env node
/**
 * Google Play listing graphics: 512 icon, 1024×500 feature graphic, captioned 1080×1920 phone
 * screenshots, and plain 7" (1920×1200) / 10" (2560×1600) tablet screenshots — all taken from
 * the running app with demo data.
 *
 *   APP_URL=http://localhost:5174 API_URL=http://localhost:4101 \
 *   SESSIONS=../mumu-backend/scripts/demo-sessions.json node scripts/store-assets.mjs
 */
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const APP = process.env.APP_URL ?? "http://localhost:5174";
const API = process.env.API_URL ?? "http://localhost:4101";
const OUT = "store";
const sessions = JSON.parse(fs.readFileSync(process.env.SESSIONS ?? "../mumu-backend/scripts/demo-sessions.json", "utf8"));
const FONT = `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">`;
const M = `<svg viewBox='0 0 64 64' width='100%' height='100%'><path d='M14 44V22l9 12 9-12 9 12 9-12v22' fill='none' stroke='#fff' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
const GRAD = "linear-gradient(135deg,#00a8ff,#9c88ff)";

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });

async function render(file, w, h, html, scale = 1) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: scale });
  await p.setContent(`<html><head>${FONT}</head><body style="margin:0">${html}</body></html>`, { waitUntil: "networkidle0" });
  await p.screenshot({ path: `${OUT}/${file}` });
  await p.close();
}

// ── Icon + feature graphic ──────────────────────────────────────────────────
await render("icon-512.png", 512, 512, `<div style="width:512px;height:512px;background:${GRAD};display:flex;align-items:center;justify-content:center"><div style="width:60%;height:60%">${M}</div></div>`);
await render(
  "feature-graphic-1024x500.png",
  1024,
  500,
  `<div style="width:1024px;height:500px;background:${GRAD};font-family:'Plus Jakarta Sans',sans-serif;color:#fff;display:flex;align-items:center;gap:56px;padding:0 80px;box-sizing:border-box;position:relative;overflow:hidden">
    <div style="position:absolute;right:-120px;top:-120px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.12)"></div>
    <div style="position:absolute;right:140px;bottom:-180px;width:340px;height:340px;border-radius:50%;background:rgba(255,255,255,.10)"></div>
    <div style="width:180px;height:180px;flex:none;border-radius:44px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;box-shadow:0 20px 50px rgba(0,0,0,.18)"><div style="width:62%;height:62%">${M}</div></div>
    <div style="position:relative">
      <div style="font-size:84px;font-weight:800;letter-spacing:-2px;line-height:1">Mu</div>
      <div style="margin-top:18px;font-size:34px;font-weight:700;line-height:1.25;max-width:600px">Chat, call &amp; go live —<br>the network for providers</div>
    </div>
  </div>`,
);

// ── Screenshots ─────────────────────────────────────────────────────────────
async function personPage(handle, profileKind) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: 390, height: 760, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(`${APP}/login`);
  const me = await (await fetch(`${API}/api/me`, { headers: { authorization: `Bearer ${sessions[handle].accessToken}`, "x-device-id": `store-${handle}` } })).json();
  const prof = me.data.profiles.find((x) => x.kind === profileKind) ?? me.data.profiles[0];
  await p.evaluate((s, dev) => {
    localStorage.setItem("mu.session", JSON.stringify(s));
    localStorage.setItem("mu.theme", "light");
    localStorage.setItem("mu.device", dev);
  }, { ...sessions[handle], profileId: prof.profileId }, `store-${handle}`);
  return { p, token: sessions[handle].accessToken, profileId: prof.profileId };
}

async function raw(page, url, prepare) {
  await page.goto(`${APP}${url}`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1200));
  if (prepare) await prepare(page);
  return (await page.screenshot({ encoding: "base64" }));
}

async function framed(file, caption, sub, b64) {
  await render(
    file,
    1080,
    1920,
    `<div style="width:1080px;height:1920px;background:${GRAD};font-family:'Plus Jakarta Sans',sans-serif;color:#fff;display:flex;flex-direction:column;align-items:center;box-sizing:border-box;padding-top:96px">
      <div style="font-size:64px;font-weight:800;letter-spacing:-1px;text-align:center;line-height:1.1;padding:0 60px">${caption}</div>
      <div style="margin-top:20px;font-size:32px;font-weight:500;opacity:.9;text-align:center;padding:0 80px">${sub}</div>
      <div style="margin-top:64px;border-radius:56px;padding:14px;background:#192a56;box-shadow:0 40px 80px rgba(0,0,0,.28)">
        <img src="data:image/png;base64,${b64}" style="display:block;width:702px;height:1368px;border-radius:44px;object-fit:cover;object-position:top">
      </div>
    </div>`,
  );
}

const rafi = await personPage("rafi", "BUSINESS");
const ayesha = await personPage("ayesha", "PERSONAL");
const mim = await personPage("mim", "PERSONAL"); // no provider yet → setup screen

const chats = await (await fetch(`${API}/api/conversations`, { headers: { authorization: `Bearer ${ayesha.token}`, "x-profile-id": ayesha.profileId, "x-device-id": "store-ayesha" } })).json();
const rafiChats = await (await fetch(`${API}/api/conversations`, { headers: { authorization: `Bearer ${rafi.token}`, "x-profile-id": rafi.profileId, "x-device-id": "store-rafi" } })).json();
const shopChat = rafiChats.data.find((c) => /Tanvir/.test(c.title));
const dm = chats.data.find((c) => c.type === "DIRECT" && /Rafi/.test(c.title)) ?? chats.data[0];

const shots = [
  ["1-chats.png", "All your chats<br>in one place", "Customers, teams and groups — with photos and read receipts", ayesha.p, "/chats"],
  ["2-conversation.png", "Talk to your customers", "Replies, photos, voice &amp; video calls", rafi.p, `/chats/${shopChat?.conversationId ?? dm.conversationId}`],
  ["3-feed.png", "Share what's new", "Short posts with a photo — for everyone or your connections", rafi.p, "/feed"],
  ["4-profile.png", "A home for<br>your business", "Category, about, followers — and a link to share", rafi.p, "/u/dhakabites"],
  ["5-notifications.png", "Never miss a beat", "Connection requests, comments, reactions and lives", ayesha.p, "/notifications"],
  ["6-setup.png", "Set up in a minute", "Pick your category and you're ready to connect", mim.p, "/chats", async (p) => {
    const input = await p.$('[role="combobox"]');
    if (input) {
      await input.click();
      await new Promise((r) => setTimeout(r, 500));
    }
  }],
];
for (const [file, caption, sub, page, url, prepare] of shots) {
  await framed(`screenshots/${file}`, caption, sub, await raw(page, url, prepare));
  console.log("✔", file);
}
/** Landscape tablet: caption on the left, the app in a tablet frame on the right (1280×800 × scale). */
async function framedTablet(file, caption, sub, b64, scale) {
  await render(
    file,
    1280,
    800,
    `<div style="width:1280px;height:800px;background:${GRAD};font-family:'Plus Jakarta Sans',sans-serif;color:#fff;display:flex;align-items:center;justify-content:center;gap:44px;padding:0 40px;box-sizing:border-box;position:relative;overflow:hidden">
      <div style="position:absolute;left:-140px;bottom:-160px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.10)"></div>
      <div style="position:relative;width:310px;flex:none">
        <div style="width:64px;height:64px;border-radius:18px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;margin-bottom:28px"><div style="width:62%;height:62%">${M}</div></div>
        <div style="font-size:46px;font-weight:800;letter-spacing:-1px;line-height:1.1">${caption}</div>
        <div style="margin-top:18px;font-size:21px;font-weight:500;opacity:.92;line-height:1.4">${sub}</div>
      </div>
      <div style="flex:none;border-radius:34px;padding:16px;background:#192a56;box-shadow:0 40px 80px rgba(0,0,0,.3)">
        <img src="data:image/png;base64,${b64}" style="display:block;width:784px;height:490px;border-radius:20px;object-fit:cover;object-position:top left">
      </div>
    </div>`,
    scale,
  );
}

// ── Tablets: the wide layout (list + conversation side by side), framed ──
for (const [dir, scale] of [["tablet-7", 1.5], ["tablet-10", 2]]) {
  fs.mkdirSync(`${OUT}/${dir}`, { recursive: true });
  for (const [file, caption, sub, page, url, prepare] of shots.slice(0, 5)) {
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: scale, isMobile: false, hasTouch: true });
    await page.goto(`${APP}${url}`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1200));
    if (prepare) await prepare(page);
    const b64 = await page.screenshot({ encoding: "base64" });
    await framedTablet(`${dir}/${file}`, caption.replace("<br>", " "), sub, b64, scale);
    console.log("✔", dir, file);
  }
}
await browser.close();
console.log(`Done → ${OUT}/`);
