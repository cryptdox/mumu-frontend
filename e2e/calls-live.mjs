#!/usr/bin/env node
/**
 * Browser end-to-end: a real video call and a live stream through the web app,
 * the MuMu API and MUMU RTC (control plane + media node), with Chrome's fake
 * camera/mic. Two people in separate browser profiles.
 *
 *   APP_URL=http://localhost:5174 SESSIONS=../mumu-backend/scripts/demo-sessions.json \
 *   CHROME_PATH=/usr/bin/google-chrome node e2e/calls-live.mjs
 *
 * Needs: a seeded demo API (mumu-backend scripts/seed-demo.mjs) wired to MUMU RTC.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const APP = (process.env.APP_URL ?? "http://localhost:5174").replace(/\/+$/, "");
const sessions = JSON.parse(fs.readFileSync(process.env.SESSIONS ?? "../mumu-backend/scripts/demo-sessions.json", "utf8"));
const SHOTS = process.env.SHOTS ?? "e2e/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});

let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (err) {
    failed++;
    console.log(`✖ ${name}: ${err.message}`);
  }
};

async function personPage(handle, extra = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1100, height: 760 });
  page.on("pageerror", (e) => console.log(`  [${handle}] page error: ${e.message}`));
  await page.goto(`${APP}/login`);
  await page.evaluate((s) => {
    localStorage.setItem("mu.session", JSON.stringify(s));
    localStorage.setItem("mu.theme", "light");
  }, { ...sessions[handle], ...extra });
  await page.goto(`${APP}/chats`, { waitUntil: "networkidle2" });
  return page;
}

/** Number of <video> elements actually showing frames. */
const playing = (page) => page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0 && !v.paused).length);
const waitPlaying = (page, n, timeout = 20000) =>
  page.waitForFunction((n) => [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0 && !v.paused).length >= n, { timeout }, n).catch(async () => {
    const info = await page.evaluate(() => ({ videos: [...document.querySelectorAll("video")].map((v) => `${v.videoWidth}x${v.videoHeight}${v.paused ? " paused" : ""}`), text: document.body.innerText.slice(0, 120).replace(/\n/g, " | ") }));
    throw new Error(`expected ${n} playing videos: ${JSON.stringify(info)}`);
  });
const clickText = async (page, selector, text) => {
  await page.waitForFunction((s, t) => [...document.querySelectorAll(s)].some((e) => e.textContent?.includes(t)), { timeout: 10000 }, selector, text);
  await page.evaluate((s, t) => [...document.querySelectorAll(s)].find((e) => e.textContent?.includes(t)).click(), selector, text);
};

const ayesha = await personPage("ayesha");
const rafi = await personPage("rafi");

await step("video call: Ayesha calls, Rafi gets the ring and answers, both see each other", async () => {
  await clickText(ayesha, "a", "Rafi Hasan");
  await ayesha.waitForSelector('button[aria-label="Video call"]');
  await ayesha.click('button[aria-label="Video call"]');
  await rafi.waitForSelector('button[aria-label="Accept"]', { timeout: 10000 });
  await rafi.screenshot({ path: path.join(SHOTS, "1-incoming-call.png") });
  await rafi.click('button[aria-label="Accept"]');
  await waitPlaying(ayesha, 2);
  await waitPlaying(rafi, 2);
  await ayesha.screenshot({ path: path.join(SHOTS, "2-call-ayesha.png") });
  await rafi.screenshot({ path: path.join(SHOTS, "3-call-rafi.png") });
});

await step("hang up ends the call for both, and the chat shows the call", async () => {
  await ayesha.click(".mumu-btn--leave");
  await rafi.waitForFunction(() => !document.querySelector(".mumu-controls"), { timeout: 10000 });
  await ayesha.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Video call/.test(b.textContent ?? "") && /\d:\d\d|\ds/.test(b.textContent ?? "")), { timeout: 10000 });
  await ayesha.screenshot({ path: path.join(SHOTS, "4-call-ended.png") });
});

// Rafi acts as his business Dhaka Bites.
const me = await rafi.evaluate(async (api) => {
  const s = JSON.parse(localStorage.getItem("mu.session"));
  const r = await fetch(`${api}/api/me`, { headers: { authorization: `Bearer ${s.accessToken}` } });
  return (await r.json()).data;
}, process.env.API_URL ?? "http://localhost:4101");
const bites = me.profiles.find((p) => p.handle === "dhakabites");

// A previous (interrupted) run may have left Dhaka Bites live — end it first.
await rafi.evaluate(async (api, pid) => {
  const s = JSON.parse(localStorage.getItem("mu.session"));
  const headers = { authorization: `Bearer ${s.accessToken}`, "x-profile-id": pid };
  const live = (await (await fetch(`${api}/api/live`, { headers })).json()).data ?? [];
  for (const l of live.filter((l) => l.hostProfileId === pid)) await fetch(`${api}/api/live/${l.liveStreamId}/end`, { method: "POST", headers });
}, process.env.API_URL ?? "http://localhost:4101", bites.profileId);

await step("live: Rafi goes live as Dhaka Bites (followers only), Ayesha (a follower) watches and chats", async () => {
  await rafi.evaluate((pid) => {
    const s = JSON.parse(localStorage.getItem("mu.session"));
    localStorage.setItem("mu.session", JSON.stringify({ ...s, profileId: pid }));
  }, bites.profileId);
  await rafi.goto(`${APP}/live`, { waitUntil: "networkidle2" });
  await clickText(rafi, "button", "Go live");
  await rafi.waitForSelector('input[placeholder="What\'s this live about?"]');
  await rafi.type('input[placeholder="What\'s this live about?"]', "Cooking the chui jhal live 🌶️");
  await clickText(rafi, "button", "Followers");
  await clickText(rafi, "button", "Start live");
  await waitPlaying(rafi, 1);

  // Ayesha watches on a phone-sized screen.
  await ayesha.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await ayesha.goto(`${APP}/live`, { waitUntil: "networkidle2" });
  await ayesha.screenshot({ path: path.join(SHOTS, "5-live-list.png") });
  await clickText(ayesha, "a", "Cooking the chui jhal");
  await waitPlaying(ayesha, 1);
  await ayesha.waitForSelector('input[aria-label="Live chat message"]');
  await ayesha.type('input[aria-label="Live chat message"]', "Smells amazing from here 😋");
  await ayesha.keyboard.press("Enter");
  await rafi.waitForFunction(() => document.body.innerText.includes("Smells amazing from here"), { timeout: 10000 });
  await rafi.waitForFunction(() => document.body.innerText.includes("Ayesha Rahman"), { timeout: 10000 });
  // Sending a chat message must not black out the stream (keyboard / layout changes).
  const progressing = async (page) => {
    const t1 = await page.evaluate(() => document.querySelector(".mu-live-screen video")?.currentTime ?? -1);
    await new Promise((r) => setTimeout(r, 4500));
    const t2 = await page.evaluate(() => document.querySelector(".mu-live-screen video")?.currentTime ?? -1);
    if (!(t2 > t1 + 2)) throw new Error(`stream stalled after chatting (${t1} → ${t2})`);
  };
  await progressing(ayesha);
  await ayesha.screenshot({ path: path.join(SHOTS, "7a-viewer-chat-overlay.png") });
  // Tapping the chat opens the full history from the right; the video keeps playing behind it.
  await ayesha.click('button[aria-label="Open live chat"]');
  await ayesha.waitForSelector('aside[aria-label="Live chat"]');
  await ayesha.screenshot({ path: path.join(SHOTS, "7b-viewer-chat-drawer.png") });
  await progressing(ayesha);
  await ayesha.click('button[aria-label="Close chat"]');
  // The host chatting must not black out the stream either — on desktop and on a phone.
  for (const viewport of [null, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    if (viewport) await rafi.setViewport(viewport);
    await rafi.waitForSelector('input[aria-label="Live chat message"]');
    await rafi.type('input[aria-label="Live chat message"]', `Thanks for watching ${viewport ? "📱" : "💻"}`);
    await rafi.keyboard.press("Enter");
    await ayesha.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 10000 }, `Thanks for watching ${viewport ? "📱" : "💻"}`);
    await progressing(rafi).catch((e) => { throw new Error(`host view (${viewport ? "phone" : "desktop"}): ${e.message}`); });
    await progressing(ayesha).catch((e) => { throw new Error(`viewer after host chat (${viewport ? "phone" : "desktop"}): ${e.message}`); });
    await rafi.screenshot({ path: path.join(SHOTS, `6b-host-after-chat-${viewport ? "phone" : "desktop"}.png`) });
    console.log(`  after host chat (${viewport ? "phone" : "desktop"}) — viewer:`, JSON.stringify(await ayesha.evaluate(() => ({ video: !!document.querySelector(".mu-live-screen video"), text: document.querySelector(".mu-live-screen")?.innerText ?? "" }))));
  }
  // Switching puppeteer back from a phone viewport reloads the page — i.e. the host reloads
  // mid-live. The host must come back on air and the viewer must get the stream again.
  await rafi.setViewport({ width: 1100, height: 760 });
  await waitPlaying(rafi, 1, 30000).catch((e) => { throw new Error(`host didn't come back after reload: ${e.message}`); });
  await ayesha.waitForFunction(() => { const v = document.querySelector(".mu-live-screen video"); return v && v.videoWidth > 0; }, { timeout: 30000 })
    .catch(() => { throw new Error("viewer didn't get the stream back after the host reloaded"); });
  await progressing(ayesha);
  // The stream is shown whole, never cropped.
  const state = async (page) => page.evaluate(() => ({ video: !!document.querySelector(".mu-live-screen video"), text: document.querySelector(".mu-live-screen")?.innerText ?? "" }));
  console.log("  after host chat — viewer:", JSON.stringify(await state(ayesha)), "host:", JSON.stringify(await state(rafi)));
  const fit = await ayesha.evaluate(() => getComputedStyle(document.querySelector(".mu-live-screen video")).objectFit);
  if (fit !== "contain") throw new Error(`live video object-fit is ${fit}, expected contain`);
  await rafi.screenshot({ path: path.join(SHOTS, "6-live-host-after-reload.png") });
  await ayesha.screenshot({ path: path.join(SHOTS, "7-live-viewer.png") });
});

await step("live: a non-follower can't see it; ending it tells the viewer", async () => {
  const outsider = await personPage("sara.mod"); // doesn't follow Dhaka Bites
  await outsider.goto(`${APP}/live`, { waitUntil: "networkidle2" });
  const sees = await outsider.evaluate(() => document.body.innerText.includes("Cooking the chui jhal"));
  if (sees) throw new Error("A non-follower can see a followers-only live");
  await rafi.click(".mumu-btn--leave");
  await rafi.waitForFunction(() => location.pathname === "/live", { timeout: 10000 }).catch(() => {
    throw new Error("host wasn't taken back to /live");
  });
  await ayesha.waitForFunction(() => document.body.innerText.includes("This live has ended"), { timeout: 10000 }).catch(async () => {
    await ayesha.screenshot({ path: path.join(SHOTS, "x-viewer-after-end.png") });
    throw new Error(`viewer wasn't told: ${(await ayesha.evaluate(() => document.body.innerText)).slice(0, 200)}`);
  });
  await ayesha.screenshot({ path: path.join(SHOTS, "8-live-ended.png") });
});

await browser.close();
console.log(failed ? `\n${failed} step(s) failed` : "\nAll steps passed");
process.exit(failed ? 1 : 0);
