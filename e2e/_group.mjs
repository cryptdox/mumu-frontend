import fs from "node:fs";
import puppeteer from "puppeteer-core";
const APP = "http://localhost:5174", SHOTS = process.env.OUT;
const sessions = JSON.parse(fs.readFileSync("../mumu-backend/scripts/demo-sessions.json", "utf8"));
const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--no-sandbox"] });
async function person(h, mobile) {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1100, height: 760 });
  p.on("pageerror", (e) => console.log(`[${h}]`, e.message));
  await p.goto(`${APP}/login`);
  await p.evaluate((s, d) => { localStorage.setItem("mu.session", JSON.stringify(s)); localStorage.setItem("mu.device", d); localStorage.setItem("mu.theme", "light"); }, sessions[h], `e2e-${h}-main`);
  await p.goto(`${APP}/chats`, { waitUntil: "networkidle2" });
  return p;
}
const playing = (p) => p.evaluate(() => [...document.querySelectorAll(".mu-call-stage video")].filter((v) => v.videoWidth > 0 && !v.paused).length);
const ayesha = await person("ayesha", true);
const others = [await person("rafi"), await person("nadia"), await person("tanvir")];
await ayesha.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent.includes("Sreemangal"))?.click());
await ayesha.waitForSelector('button[aria-label="Video call"]');
await ayesha.click('button[aria-label="Video call"]');
await new Promise((r) => setTimeout(r, 4000));
await ayesha.screenshot({ path: `${SHOTS}/dbg-caller.png` });
await others[0].screenshot({ path: `${SHOTS}/dbg-callee.png` });
console.log("calls state:", await ayesha.evaluate(() => document.querySelector(".mu-call-stage") ? "call screen" : "no call screen"));
for (const [i, o] of others.entries()) {
  await o.waitForSelector('button[aria-label="Accept"]', { timeout: 15000 }).catch(async (e) => {
    console.log("callee screen:", (await o.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n/g, " | "));
    console.log("caller screen:", (await ayesha.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n/g, " | "));
    throw e;
  });
  await o.click('button[aria-label="Accept"]');
  await ayesha.waitForFunction((n) => [...document.querySelectorAll(".mu-call-stage video")].filter((v) => v.videoWidth > 0).length >= n, { timeout: 20000 }, i + 2);
  await new Promise((r) => setTimeout(r, 1500));
  console.log(`${i + 2} people: ayesha sees ${await playing(ayesha)} videos`);
  await ayesha.screenshot({ path: `${SHOTS}/group-${i + 2}-phone.png` });
  if (i === 1) await others[0].screenshot({ path: `${SHOTS}/group-3-desktop.png` });
}
await b.close();
