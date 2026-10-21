import type { ReactNode } from "react";
import { Link } from "react-router";
import { APP_URL, SUPPORT_EMAIL } from "@/config";

const UPDATED = "21 October 2026";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-9 rounded-xl" />
            <span className="text-lg font-bold">MuMu</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">Effective date: {UPDATED}</p>
        <div className="mt-6 space-y-5 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_ul_ul]:mt-1.5 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
      </main>
    </div>
  );
}

const Mail = () => (
  <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-brand">
    {SUPPORT_EMAIL}
  </a>
);

/** "Title: text" bullet list for the policy pages. */
function Items({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <ul>
      {items.map(([title, text], i) => (
        <li key={i}>
          <b>{title}</b> {text}
        </li>
      ))}
    </ul>
  );
}

const Url = ({ path }: { path: string }) => (
  <Link to={path} className="font-semibold text-brand">{`${APP_URL}${path}`}</Link>
);

export function PrivacyPolicy() {
  return (
    <Page title="Privacy Policy">
      <p>
        <b>App:</b> MuMu (Android package <code>mu.cryptdox.com</code>) and the website {APP_URL}
        <br />
        <b>Developer:</b> Cryptdox, Dhaka, Bangladesh · <b>Contact:</b> <Mail />
      </p>
      <p>
        This Privacy Policy explains how Cryptdox (“we”, “us”, “our”) collects, uses, stores, shares and protects information when you use MuMu
        (the “App” or “Service”). By using MuMu you agree to this policy. If you do not agree, please do not use the App.
      </p>

      <h2>1. Information we collect</h2>
      <h3 className="font-semibold">1.1 Information you provide</h3>
      <Items
        items={[
          ["Account information (required):", "your name, email address and password. Your password is handled by the Cryptdox sign-in, and we never see it in plain text."],
          ["Profile information:", "display name and @handle (required); category, bio, website, and profile and cover photos (optional)."],
          ["Content you create (optional):", "chat messages, posts, comments, reactions, photos (up to 1 MB each), live-stream titles and live chat."],
          ["Connections (optional):", "profiles you connect with, follow or block."],
          ["Reports (optional):", "content or profiles you report, and the reason."],
        ]}
      />
      <h3 className="font-semibold">1.2 Information collected automatically</h3>
      <Items
        items={[
          ["Device identifier and type:", "a random ID created by the App, plus the device type (for example “Chrome on Android”). Used to show your signed-in devices, to limit an account to 3 devices, and for security."],
          ["Call and live metadata:", "participants, start and end time, duration, and whether it was audio or video. Used for call history, missed-call notices and running the service."],
          ["Online status and last-seen time:", "shown to your chats and connections."],
          ["IP address, request logs and error logs:", "used for security, abuse prevention and troubleshooting."],
        ]}
      />
      <h3 className="font-semibold">1.3 Information we do NOT collect</h3>
      <p>
        We do not collect your precise or approximate location, contacts, SMS or call logs, financial or payment information, health data, or your
        browsing history. We do not use advertising IDs.
      </p>

      <h2>2. Device permissions</h2>
      <Items
        items={[
          ["Camera:", "for video calls and live streaming. Asked only when you start or join a video call or go live."],
          ["Microphone:", "for voice and video calls and live streaming. Asked only when you start or join a call or go live."],
          ["Modify audio settings:", "to switch call audio between the earpiece, speaker and headset during a call."],
          ["Wake lock:", "to turn the screen off when the phone is at your ear during a call, and to keep it on during calls."],
          ["Internet:", "to connect to MuMu services."],
        ]}
      />
      <p>
        You can deny or revoke the camera and microphone permissions at any time in your phone's settings. The rest of the App keeps working, but
        calls and lives can't send your video or voice.
      </p>
      <p>
        <b>Calls and live streams are never recorded.</b> Audio and video are sent in real time between participants through our media servers and
        are not stored.
      </p>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To create and manage your account and profiles.</li>
        <li>To provide messaging, posts, comments, reactions, voice and video calls, and live streaming.</li>
        <li>To show your content only to the audience you choose: Public, Connections, or Only me.</li>
        <li>To send in-app notifications, for example new messages, connection requests, comments and lives.</li>
        <li>To keep MuMu safe: rate limiting, spam and abuse prevention, handling reports, and suspending profiles that break the rules.</li>
        <li>To fix bugs and improve the Service.</li>
        <li>To comply with legal obligations.</li>
      </ul>
      <p>
        We do <b>not</b> sell your personal data. We do <b>not</b> show ads, and we do not use your data for advertising or profiling.
      </p>

      <h2>4. How your information is shared</h2>
      <ul>
        <li>
          <b>With other users, as you choose.</b> Your profile, posts and lives are visible according to the audience you select. Chats are visible to
          their members. Your name, handle and photo are visible to people you interact with.
        </li>
        <li><b>With service providers</b> who process data for us under their own security and privacy terms:</li>
      </ul>
      <Items
        items={[
          ["Supabase:", "database and photo storage."],
          ["Render:", "hosting for the MuMu backend and sign-in services."],
          ["Netlify:", "hosting for the MuMu web app."],
          ["Cloudflare Turnstile:", "bot protection on sign-up and sign-in."],
          ["Google Fonts:", "delivering the App's font."],
          ["MUMU RTC (operated by Cryptdox):", "real-time audio and video for calls and lives."],
        ]}
      />
      <ul>
        <li><b>For legal reasons.</b> We may disclose information if required by law, or to protect the rights, safety and property of our users or others.</li>
        <li><b>On a business transfer.</b> If Cryptdox is involved in a merger or acquisition, information may be transferred, and this policy will continue to apply.</li>
      </ul>
      <p>
        <b>Photos:</b> uploaded photos are stored as files with random, hard-to-guess links. Anyone who has a photo's link can open it, so share
        links with care.
      </p>

      <h2>5. Data retention</h2>
      <ul>
        <li>Account, profile and content data are kept while your account exists.</li>
        <li>When you delete content, it is removed from the Service immediately.</li>
        <li>When you delete your account, your MuMu data is deleted immediately (see section 7). Backups are replaced within <b>30 days</b>.</li>
        <li>Security logs are kept for a limited time, normally up to 90 days.</li>
      </ul>

      <h2>6. Data security</h2>
      <ul>
        <li>All data is encrypted in transit with HTTPS/TLS.</li>
        <li>Access to systems and databases is restricted to authorised staff.</li>
        <li>Sign-in uses short-lived access tokens, and passwords are stored only in hashed form.</li>
      </ul>
      <p>No method of transmission or storage is 100% secure, but we work to protect your information and to fix problems quickly.</p>

      <h2>7. Your rights and choices</h2>
      <ul>
        <li><b>Access and correct:</b> view and edit your profile at any time in the App.</li>
        <li><b>Control visibility:</b> choose Public, Connections or Only me for each post and live.</li>
        <li><b>Block and report:</b> block profiles and report content or profiles.</li>
        <li><b>Manage devices:</b> see and sign out your devices in Settings → Devices.</li>
        <li>
          <b>Delete your account:</b> go to <b>Settings → Delete my MuMu account</b>, or follow the steps at <Url path="/account-deletion" />. This
          deletes every profile you own, with its posts, comments, reactions, messages, photos, lives and connections, plus your signed-in devices.
        </li>
        <li><b>Request by email:</b> email <Mail /> from your account's email address. We respond within 30 days.</li>
      </ul>
      <p>
        Depending on where you live (for example under the GDPR in the EU/UK or the CCPA in California), you may have extra rights, such as data
        portability or objecting to processing. Contact us to use them.
      </p>

      <h2>8. Children's privacy</h2>
      <p>
        MuMu is not intended for children under <b>13</b>. We do not knowingly collect personal data from children under 13. If you believe a child
        has given us personal data, contact us and we will delete it.
      </p>

      <h2>9. International data transfers</h2>
      <p>
        Our service providers may store and process data in countries other than your own, for example in Japan, Singapore, the United States or the
        EU. We take steps so your data stays protected as described in this policy.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. We will post the new version at <Url path="/privacy" /> and update the effective date. For
        significant changes, we will also notify you in the App.
      </p>

      <h2>11. Contact us</h2>
      <p>
        Cryptdox — MuMu
        <br />
        Email: <Mail />
        <br />
        Website: {APP_URL}
      </p>
    </Page>
  );
}

export function AccountDeletion() {
  return (
    <Page title="Delete your MuMu account">
      <p>You can delete your MuMu account and its data yourself, at any time.</p>

      <h2>In the app or on the web</h2>
      <ul>
        <li>Sign in to MuMu (the app or <a href="/login" className="font-semibold text-brand">the website</a>).</li>
        <li>Open <b>Settings</b> (your photo → Settings).</li>
        <li>Under <b>Account</b>, tap <b>Delete my MuMu account</b> and confirm.</li>
      </ul>

      <h2>What is deleted</h2>
      <ul>
        <li>Every profile you own — your consumer profile and your provider profiles — with their posts, comments, reactions, chat messages, photos, lives and connections.</li>
        <li>Your access to provider profiles you help run (the profiles themselves stay with their owners).</li>
        <li>Your signed-in devices.</li>
      </ul>
      <p>Deletion is immediate and can't be undone. Backups roll over within 30 days.</p>

      <h2>Your Cryptdox sign-in</h2>
      <p>
        MuMu uses the Cryptdox sign-in, which can be shared with other Cryptdox apps, so deleting your MuMu account doesn't delete it. To delete the
        sign-in too, email <Mail /> from the address you signed up with.
      </p>

      <h2>Can't sign in?</h2>
      <p>
        Email <Mail /> from your account's email address and we'll delete your MuMu account and data within 30 days.
      </p>
    </Page>
  );
}
