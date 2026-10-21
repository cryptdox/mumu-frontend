import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/realtime";
import { ApiError, errorCode, errorMessage } from "@/lib/api";
import { DeviceLimit } from "@/pages/profile/Devices";
import { AppShell } from "@/components/layout";
import { Button, Loading } from "@/components/ui";
import { ForgotPassword, Login, Register, ResetPassword, VerifyEmail } from "@/pages/auth/Auth";
import ChatsLayout, { NoChatSelected } from "@/pages/chats/ChatList";
import Thread from "@/pages/chats/Thread";
import Feed from "@/pages/feed/Feed";
import PostPage from "@/pages/feed/PostPage";
import { LiveHome, LiveRoom } from "@/pages/live/Live";
import ProfilePage from "@/pages/profile/ProfilePage";
import Notifications from "@/pages/profile/Notifications";
import SettingsPage from "@/pages/profile/Settings";
import CreateBusiness, { ProviderSetup } from "@/pages/profile/CreateBusiness";
import { mu } from "@/api/mu";
import { AccountDeletion, PrivacyPolicy } from "@/pages/public/Legal";
import Admin from "@/pages/admin/Admin";

/** Signed in and the account's profiles are loaded. */
function RequireAccount() {
  const { user, profile, logout } = useAuth();
  const location = useLocation();
  const me = useQuery({ queryKey: ["me", user?.userId], queryFn: mu.me, enabled: !!user, staleTime: 60_000 });
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (me.error && errorCode(me.error) === "DEVICE_LIMIT") return <DeviceLimit onFreed={() => void me.refetch()} />;
  if (me.error) {
    const denied = me.error instanceof ApiError && (me.error.status === 403 || me.error.status === 401);
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <img src="/favicon.svg" alt="" className="size-14" />
        <p className="max-w-sm text-muted">{denied ? "Your account isn't set up for MuMu yet. Sign out and sign in again, or contact support." : errorMessage(me.error)}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void me.refetch()}>Retry</Button>
          <Button onClick={() => void logout()}>Sign out</Button>
        </div>
      </div>
    );
  }
  if (!profile || !me.data) return <div className="flex h-dvh"><Loading /></div>;
  if (me.data.needsSetup) return <ProviderSetup />;
  return (
    <RealtimeProvider>
      <Outlet />
    </RealtimeProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/account-deletion" element={<AccountDeletion />} />
      <Route element={<RequireAccount />}>
        <Route element={<AppShell />}>
          <Route path="/chats" element={<ChatsLayout />}>
            <Route index element={<NoChatSelected />} />
            <Route path=":id" element={<Thread />} />
          </Route>
          <Route path="/feed" element={<Feed />} />
          <Route path="/posts/:postId" element={<PostPage />} />
          <Route path="/live" element={<LiveHome />} />
          <Route path="/live/:id" element={<LiveRoom />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/u/:handle" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/business/new" element={<CreateBusiness />} />
          <Route path="/admin/*" element={<Admin />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/chats" replace />} />
    </Routes>
  );
}
