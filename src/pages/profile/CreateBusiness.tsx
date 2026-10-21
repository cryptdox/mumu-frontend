import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Building2, Handshake, LogOut, MessageCircle, Radio } from "lucide-react";
import { mu } from "@/api/mu";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { Button, IconButton, Input, Textarea, toastError } from "@/components/ui";
import { CategorySelect } from "@/components/CategorySelect";

const suggest = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 30);

function ProviderForm({ onCreated, submitLabel }: { onCreated: (profileId: string) => void; submitLabel: string }) {
  const [form, setForm] = useState({ displayName: "", handle: "", categoryId: "", bio: "" });
  const [touchedHandle, setTouchedHandle] = useState(false);
  const create = useMutation({
    mutationFn: () =>
      mu.profiles.createBusiness({
        displayName: form.displayName.trim(),
        handle: form.handle.trim(),
        categoryId: form.categoryId || undefined,
        bio: form.bio.trim() || undefined,
      }),
    onSuccess: async (p) => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      onCreated(p.profileId);
    },
    onError: toastError,
  });
  return (
    <form onSubmit={(e: FormEvent) => (e.preventDefault(), create.mutate())} className="space-y-3">
      <Input
        label="Business name"
        required
        maxLength={60}
        value={form.displayName}
        onChange={(e) => setForm({ ...form, displayName: e.target.value, handle: touchedHandle ? form.handle : suggest(e.target.value) })}
      />
      <Input label="Handle" required maxLength={30} value={form.handle} onChange={(e) => (setTouchedHandle(true), setForm({ ...form, handle: e.target.value.toLowerCase() }))} hint="Your profile link: /u/handle" />
      <CategorySelect value={form.categoryId} onChange={(categoryId) => setForm({ ...form, categoryId })} />
      <Textarea label="About" maxLength={300} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      <Button className="w-full" loading={create.isPending} disabled={!form.displayName.trim() || form.handle.length < 3}>
        {submitLabel}
      </Button>
    </form>
  );
}

const perks = (
  <ul className="mt-2 space-y-1.5 text-sm text-muted">
    <li className="flex gap-2"><MessageCircle className="size-4 shrink-0 text-brand" /> An inbox for customer chats and calls</li>
    <li className="flex gap-2"><Handshake className="size-4 shrink-0 text-brand" /> Connect with other providers</li>
    <li className="flex gap-2"><Radio className="size-4 shrink-0 text-brand" /> Posts and lives, and your team as admins or editors</li>
  </ul>
);

/** First sign-in: set up your Provider profile before using the app. */
export function ProviderSetup() {
  const { switchProfile, logout } = useAuth();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-sm">
        <img src="/favicon.svg" alt="" className="mb-4 size-12 rounded-2xl" />
        <h1 className="text-2xl font-bold tracking-tight">Set up your provider profile</h1>
        <p className="mt-1 text-muted">This is how you appear on MuMu — you can change it any time.</p>
        <div className="my-5 rounded-2xl bg-gradient-to-br from-brand/10 to-accent/15 p-4">{perks}</div>
        <ProviderForm submitLabel="Create my profile" onCreated={switchProfile} />
        <button onClick={() => void logout()} className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

/** Another provider profile (owners can run several). */
export default function CreateBusiness() {
  const navigate = useNavigate();
  const { switchProfile } = useAuth();
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <header className="flex h-14 items-center gap-2 border-b border-line bg-surface px-2">
        <IconButton label="Back" onClick={() => navigate(-1)}><ArrowLeft className="size-6" /></IconButton>
        <h1 className="text-lg font-bold">New provider profile</h1>
      </header>
      <div className="mx-auto max-w-[520px] p-4">
        <div className="mb-6 rounded-3xl bg-gradient-to-br from-brand/10 to-accent/15 p-5">
          <Building2 className="mb-2 size-8 text-accent-strong" />
          <h2 className="text-lg font-bold">Another provider profile</h2>
          {perks}
        </div>
        <ProviderForm submitLabel="Create" onCreated={(id) => (switchProfile(id), navigate("/settings"))} />
      </div>
    </div>
  );
}
