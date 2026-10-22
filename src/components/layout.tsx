import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Check, Home, MessageCircle, Plus, Radio, Settings, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { callStore, unreadStore } from "@/lib/realtime";
import { useStore } from "@/lib/store";
import { mu } from "@/api/mu";
import { Avatar, Name, Sheet, cx } from "./ui";
import { IncomingCall } from "@/pages/chats/CallScreen";
import { PullToRefresh } from "./PullToRefresh";
import { usePhonePush } from "@/lib/push";

function useBadges() {
  const chats = useQuery({ queryKey: ["chats"], queryFn: mu.chats.list });
  const notes = useQuery({ queryKey: ["notifications"], queryFn: () => mu.notifications.list() });
  const live = useStore(unreadStore);
  const unreadChats = (chats.data ?? []).filter((c) => c.unread > 0 && !c.mutedUntil).length;
  return { chats: unreadChats, notifications: Math.max(notes.data?.unread ?? 0, live.notifications) };
}

const nav = [
  { to: "/chats", label: "Chats", icon: MessageCircle, badge: "chats" as const },
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/live", label: "Live", icon: Radio },
  { to: "/notifications", label: "Alerts", icon: Bell, badge: "notifications" as const },
];

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="absolute -right-1.5 -top-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] font-bold leading-[18px] text-white">{n > 99 ? "99+" : n}</span>;
}

/** Switch between your personal and business profiles. */
export function ProfileSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profiles, profile, switchProfile, account } = useAuth();
  const navigate = useNavigate();
  // Providers only — the Consumer profile is switched to from Settings (consumer mode).
  const shown = profiles.filter((p) => p.kind === "BUSINESS" || p.profileId === profile?.profileId);
  return (
    <Sheet open={open} onClose={onClose} title="Switch profile">
      <ul className="space-y-1">
        {shown.map((p) => (
          <li key={p.profileId}>
            <button
              onClick={() => {
                switchProfile(p.profileId);
                onClose();
                navigate("/chats");
              }}
              className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-surface-2"
            >
              <Avatar profile={p} size={44} />
              <span className="min-w-0 flex-1">
                <Name profile={p} />
                <span className="block truncate text-sm text-muted">
                  @{p.handle} · {p.kind === "PERSONAL" ? "Consumer" : p.role.toLowerCase()}
                </span>
              </span>
              {p.profileId === profile?.profileId && <Check className="size-5 text-brand" />}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 border-t border-line pt-3">
        <Link to="/business/new" onClick={onClose} className="flex items-center gap-3 rounded-2xl p-2.5 font-semibold text-brand hover:bg-surface-2">
          <span className="flex size-11 items-center justify-center rounded-[30%] bg-brand/10">
            <Plus className="size-5" />
          </span>
          New provider profile
        </Link>
        {account?.isAdmin && (
          <Link to="/admin" onClick={onClose} className="flex items-center gap-3 rounded-2xl p-2.5 font-semibold hover:bg-surface-2">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent/15 text-accent-strong">
              <Shield className="size-5" />
            </span>
            Admin panel
          </Link>
        )}
        <Link to="/settings" onClick={onClose} className="flex items-center gap-3 rounded-2xl p-2.5 font-semibold hover:bg-surface-2">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-2">
            <Settings className="size-5" />
          </span>
          Settings
        </Link>
      </div>
    </Sheet>
  );
}

export function AppShell() {
  const { profile, account } = useAuth();
  const badges = useBadges();
  const location = useLocation();
  const [switcher, setSwitcher] = useState(false);
  // Full-screen views on phones: an open chat, a call, a live stream.
  const immersive = /^\/(chats\/[^/]+|call|live\/[^/]+)/.test(location.pathname);
  const inCall = !!useStore(callStore).active;
  usePhonePush();

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop / tablet rail */}
      <aside className="hidden w-[76px] shrink-0 flex-col items-center gap-2 border-r border-line bg-surface py-4 md:flex xl:w-60 xl:items-stretch xl:px-3">
        <Link to="/chats" className="mb-4 flex items-center gap-2.5 xl:px-2" aria-label="Mu home">
          <img src="/favicon.svg" alt="" className="size-10" />
          <span className="hidden text-xl font-bold tracking-tight xl:inline">Mu</span>
        </Link>
        {nav.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cx("relative flex items-center gap-3 rounded-2xl p-3 font-semibold transition xl:px-3", isActive ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-2 hover:text-ink")
            }
            title={label}
          >
            <span className="relative">
              <Icon className="size-6" />
              {badge && <Badge n={badges[badge]} />}
            </span>
            <span className="hidden xl:inline">{label}</span>
          </NavLink>
        ))}
        {account?.isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) => cx("flex items-center gap-3 rounded-2xl p-3 font-semibold transition xl:px-3", isActive ? "bg-accent/15 text-accent-strong" : "text-muted hover:bg-surface-2 hover:text-ink")}
            title="Admin"
          >
            <Shield className="size-6" />
            <span className="hidden xl:inline">Admin</span>
          </NavLink>
        )}
        <div className="mt-auto" />
        {profile && (
          <button onClick={() => setSwitcher(true)} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2" title="Switch profile">
            <Avatar profile={profile} size={40} ring={profile.kind === "BUSINESS"} />
            <span className="hidden min-w-0 text-left xl:block">
              <Name profile={profile} className="text-sm" />
              <span className="block truncate text-xs text-muted">{profile.kind === "BUSINESS" ? "Provider" : "Consumer"} · switch</span>
            </span>
          </button>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <PullToRefresh disabled={immersive || inCall} />
        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet context={{ openSwitcher: () => setSwitcher(true) }} />
        </main>

        {/* Phone tab bar */}
        {!immersive && (
          <nav className="safe-bottom grid shrink-0 grid-cols-5 border-t border-line bg-surface md:hidden" aria-label="Main">
            {nav.map(({ to, label, icon: Icon, badge }) => (
              <NavLink key={to} to={to} className={({ isActive }) => cx("flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-semibold", isActive ? "text-brand" : "text-muted")}>
                <span className="relative">
                  <Icon className="size-6" />
                  {badge && <Badge n={badges[badge]} />}
                </span>
                {label}
              </NavLink>
            ))}
            <button onClick={() => setSwitcher(true)} className="flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-semibold text-muted">
              {profile ? <Avatar profile={profile} size={24} /> : <span className="size-6" />}
              Me
            </button>
          </nav>
        )}
      </div>

      <ProfileSwitcher open={switcher} onClose={() => setSwitcher(false)} />
      <IncomingCall />
    </div>
  );
}

/** Page header used by the top-level tabs. */
export function TopBar({ title, children, onAvatar }: { title: string; children?: React.ReactNode; onAvatar?: () => void }) {
  const { profile } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line/70 bg-surface/90 px-4 backdrop-blur">
      {onAvatar && profile && (
        <button onClick={onAvatar} className="md:hidden" aria-label="Switch profile">
          <Avatar profile={profile} size={32} ring={profile.kind === "BUSINESS"} />
        </button>
      )}
      <h1 className="flex-1 truncate text-xl font-bold tracking-tight">{title}</h1>
      {children}
    </header>
  );
}
