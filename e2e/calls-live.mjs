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

// Each person gets a stable device id per "device" (the app limits accounts to 3 devices).
async function personPage(handle, extra = {}, device = "main") {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1100, height: 760 });
  page.on("pageerror", (e) => console.log(`  [${handle}] page error: ${e.message}`));
  // Newer Chrome (e.g. on Android) returns a Promise from scroll methods — behave the same
  // here, so code that accidentally returns one (from an effect) crashes in the test too.
  await page.evaluateOnNewDocument(() => {
    for (const proto of [Element.prototype, Window.prototype]) {
      const orig = proto.scrollTo;
      proto.scrollTo = function (...args) {
        orig.apply(this, args);
        return Promise.resolve();
      };
    }
  });
  await page.goto(`${APP}/login`);
  await page.evaluate((s, dev) => {
    localStorage.setItem("mu.session", JSON.stringify(s));
    localStorage.setItem("mu.theme", "light");
    localStorage.setItem("mu.device", dev);
  }, { ...sessions[handle], ...extra }, `e2e-${handle}-${device}`.replace(/[^A-Za-z0-9_-]/g, "-"));
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
/** The live video keeps playing (its clock advances) over a few seconds. */
const progressing = async (page) => {
  const t1 = await page.evaluate(() => document.querySelector(".mu-live-screen video")?.currentTime ?? -1);
  await new Promise((r) => setTimeout(r, 4500));
  const t2 = await page.evaluate(() => document.querySelector(".mu-live-screen video")?.currentTime ?? -1);
  if (!(t2 > t1 + 2)) throw new Error(`stream stalled (${t1} → ${t2})`);
};
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

await step("voice call: audio only, no camera", async () => {
  await ayesha.goto(`${APP}/chats`, { waitUntil: "networkidle2" });
  await clickText(ayesha, "a", "Rafi Hasan");
  await ayesha.waitForSelector('button[aria-label="Voice call"]');
  await ayesha.click('button[aria-label="Voice call"]');
  await rafi.waitForSelector('button[aria-label="Accept"]', { timeout: 10000 });
  await rafi.click('button[aria-label="Accept"]');
  await rafi.waitForSelector(".mumu-controls", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 4000));
  const videos = await ayesha.evaluate(() => [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0).length);
  if (videos) throw new Error(`a voice call showed ${videos} video(s)`);
  await ayesha.click(".mumu-btn--leave");
  await rafi.waitForFunction(() => !document.querySelector(".mumu-controls"), { timeout: 10000 });
});

await step("group video call: everyone who answers joins (others keep ringing), phone grid without overlaps", async () => {
  const nadia = await personPage("nadia");
  await ayesha.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await ayesha.goto(`${APP}/chats`, { waitUntil: "networkidle2" });
  await clickText(ayesha, "a", "Sreemangal trip");
  await ayesha.waitForSelector('button[aria-label="Video call"]');
  await ayesha.click('button[aria-label="Video call"]');
  for (const [i, who] of [rafi, nadia].entries()) {
    await who.waitForSelector('button[aria-label="Accept"]', { timeout: 15000 })
      .catch(() => { throw new Error(`${i === 0 ? "Rafi" : "Nadia"} didn't get the ring${i ? " after someone else answered" : ""}`); });
    await who.click('button[aria-label="Accept"]');
    await ayesha.waitForFunction((n) => [...document.querySelectorAll(".mu-call-stage video")].filter((v) => v.videoWidth > 0).length >= n, { timeout: 20000 }, i + 2);
  }
  // Phone grid: 3 tiles, nobody covered by another (tiles don't overlap).
  const overlap = await ayesha.evaluate(() => {
    const r = [...document.querySelectorAll(".mu-call-stage video")].map((v) => v.getBoundingClientRect());
    return r.some((a, i) => r.some((b, j) => i < j && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
  });
  if (overlap) throw new Error("call tiles overlap on the phone layout");
  await ayesha.screenshot({ path: path.join(SHOTS, "12-group-call-phone.png") });
  await ayesha.click(".mumu-btn--leave"); // the caller ends a group call for everyone
  await nadia.waitForFunction(() => !document.querySelector(".mumu-controls"), { timeout: 10000 });
  await ayesha.setViewport({ width: 1100, height: 760 });
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
  await progressing(ayesha);
  await ayesha.screenshot({ path: path.join(SHOTS, "7a-viewer-chat-overlay.png") });
  // Tapping the chat opens the full history from the right; the video keeps playing behind it.
  await ayesha.click('button[aria-label="Open live chat"]');
  await ayesha.waitForSelector('aside[aria-label="Live chat"]');
  await ayesha.screenshot({ path: path.join(SHOTS, "7b-viewer-chat-drawer.png") });
  await progressing(ayesha);
  await ayesha.click('button[aria-label="Close chat"]');
  await progressing(ayesha).catch((e) => { throw new Error(`after closing the chat: ${e.message}`); });
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
  // The live chat stays: it's the live post's comments in the feed.
  const liveId = new URL(ayesha.url()).pathname.split("/").pop();
  const postId = await ayesha.evaluate(async (api, id) => {
    const s = JSON.parse(localStorage.getItem("mu.session"));
    const r = await fetch(`${api}/api/live/${id}`, { headers: { authorization: `Bearer ${s.accessToken}`, "x-device-id": localStorage.getItem("mu.device") } });
    return (await r.json()).data.postId;
  }, process.env.API_URL ?? "http://localhost:4101", liveId);
  await ayesha.goto(`${APP}/posts/${postId}`, { waitUntil: "networkidle2" });
  await ayesha.waitForFunction(() => document.body.innerText.includes("Smells amazing from here"), { timeout: 10000 })
    .catch(() => { throw new Error("live chat message isn't on the live's post afterwards"); });
  await ayesha.screenshot({ path: path.join(SHOTS, "8b-live-post-comments.png") });
});

await step("live on two devices: the second device asks, takes over, the first steps off, viewers keep watching", async () => {
  await rafi.evaluate((pid) => {
    const s = JSON.parse(localStorage.getItem("mu.session"));
    localStorage.setItem("mu.session", JSON.stringify({ ...s, profileId: pid }));
  }, bites.profileId);
  await rafi.goto(`${APP}/live`, { waitUntil: "networkidle2" });
  await clickText(rafi, "button", "Go live");
  await rafi.waitForSelector('input[placeholder="What\'s this live about?"]');
  await rafi.type('input[placeholder="What\'s this live about?"]', "Second device test");
  await clickText(rafi, "button", "Start live");
  await waitPlaying(rafi, 1);
  const liveUrl = rafi.url();

  await ayesha.goto(liveUrl, { waitUntil: "networkidle2" });
  await waitPlaying(ayesha, 1);

  // Same account, another browser = another device.
  const rafi2 = await personPage("rafi", { profileId: bites.profileId }, "second");
  await rafi2.goto(liveUrl, { waitUntil: "networkidle2" });
  await rafi2.waitForFunction(() => document.body.innerText.includes("You're live on another device"), { timeout: 10000 });
  await rafi2.screenshot({ path: path.join(SHOTS, "9-live-other-device-prompt.png") });
  const trackBefore = await ayesha.evaluate(() => document.querySelector(".mu-live-screen video")?.srcObject?.getVideoTracks()[0]?.id);
  const t0 = Date.now();
  await clickText(rafi2, "button", "Go live from here");
  // The viewer switches to the new device's video (a different track) and it plays.
  await ayesha.waitForFunction((before) => {
    const v = document.querySelector(".mu-live-screen video");
    const id = v?.srcObject?.getVideoTracks()[0]?.id;
    return id && id !== before && v.videoWidth > 0 && !v.paused;
  }, { timeout: 15000 }, trackBefore).catch(() => { throw new Error("viewer didn't switch to the new device's video within 15 s"); });
  console.log(`  viewer switched to the new device in ${Date.now() - t0} ms`);
  await waitPlaying(rafi2, 1);
  await rafi.waitForFunction(() => location.pathname === "/live", { timeout: 10000 }).catch(() => {
    throw new Error("the first device didn't step off the live");
  });
  await rafi.waitForFunction(() => document.body.innerText.includes("Live on another device"), { timeout: 10000 })
    .catch(() => { throw new Error('the first device\'s live list should say "Live on another device"'); });
  await rafi.screenshot({ path: path.join(SHOTS, "10-first-device-after-takeover.png") });
  await ayesha.waitForFunction(() => { const v = document.querySelector(".mu-live-screen video"); return v && v.videoWidth > 0 && !v.paused; }, { timeout: 30000 })
    .catch(async () => {
      const info = await ayesha.evaluate(() => ({ url: location.pathname, screen: document.querySelector(".mu-live-screen")?.innerText, videos: [...document.querySelectorAll("video")].map((v) => `${v.videoWidth}x${v.videoHeight}${v.paused ? " paused" : ""}${v.classList.contains("mumu-hidden") ? " hidden" : ""}`) }));
      await ayesha.screenshot({ path: path.join(SHOTS, "x-viewer-after-takeover.png") });
      throw new Error(`viewer lost the stream after the takeover: ${JSON.stringify(info)}`);
    });
  await rafi2.click(".mumu-btn--leave");
  await ayesha.waitForFunction(() => document.body.innerText.includes("This live has ended"), { timeout: 10000 });
});

await step("a personal profile on another device watches a business live; opening and closing the comments keeps the video", async () => {
  // Rafi broadcasts as Dhaka Bites from his main device; Tanvir (a follower, not on the team) watches on a phone.
  await rafi.goto(`${APP}/live`, { waitUntil: "networkidle2" });
  await clickText(rafi, "button", "Go live");
  await rafi.waitForSelector('input[placeholder="What\'s this live about?"]');
  await rafi.type('input[placeholder="What\'s this live about?"]', "Comments test");
  await clickText(rafi, "button", "Start live");
  await waitPlaying(rafi, 1);
  const tanvir = await personPage("tanvir", {}, "phone");
  await tanvir.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await tanvir.goto(rafi.url(), { waitUntil: "networkidle2" });
  await waitPlaying(tanvir, 1);
  for (let round = 1; round <= 3; round++) {
    await tanvir.click('button[aria-label="Open live chat"]');
    await tanvir.waitForSelector('aside[aria-label="Live chat"]');
    if (round === 2) {
      await tanvir.type('aside[aria-label="Live chat"] input', "Looks tasty!");
      await tanvir.keyboard.press("Enter");
    }
    await new Promise((r) => setTimeout(r, 1500));
    if (round === 3) {
      // What a phone does while the panel covers the video: the picture is gone (black).
      await tanvir.evaluate(() => { document.querySelector(".mu-live-screen video").srcObject = null; });
    }
    await tanvir.evaluate(() => { const v = document.querySelector(".mu-live-screen video"); if (v) v.dataset.old = "1"; });
    await tanvir.click('button[aria-label="Close chat"]');
    // Closing the panel swaps in a brand-new <video> (fresh video layer on phones that black out).
    await tanvir.waitForFunction(() => { const v = document.querySelector(".mu-live-screen video"); return v && !v.dataset.old; }, { timeout: 5000 })
      .catch(() => { throw new Error(`round ${round}: the video element wasn't replaced on close`); });
    if (round === 3) {
      await tanvir.waitForFunction(() => { const v = document.querySelector(".mu-live-screen video"); return v?.srcObject && v.videoWidth > 0 && !v.paused; }, { timeout: 5000 })
        .catch(() => { throw new Error("closing the chat didn't bring a black live video back"); });
    }
    await progressing(tanvir).catch(async (e) => {
      await tanvir.screenshot({ path: path.join(SHOTS, `x-tanvir-round${round}.png`) });
      throw new Error(`round ${round}: ${e.message}`);
    });
  }
  // What a phone browser does to "hidden" muted video: pause it. The app must restart it.
  await tanvir.evaluate(() => document.querySelector(".mu-live-screen video").pause());
  await tanvir.waitForFunction(() => !document.querySelector(".mu-live-screen video").paused, { timeout: 5000 })
    .catch(() => { throw new Error("a paused live video wasn't restarted"); });
  await progressing(tanvir);
  if (await tanvir.evaluate(() => document.body.innerText.includes("Something went wrong"))) throw new Error("the app crashed");
  await tanvir.screenshot({ path: path.join(SHOTS, "11-viewer-after-comments.png") });
  await rafi.click(".mumu-btn--leave");
});

await browser.close();
console.log(failed ? `\n${failed} step(s) failed` : "\nAll steps passed");
process.exit(failed ? 1 : 0);
