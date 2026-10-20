import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Building2, MessageCircle, Radio, Users } from "lucide-react";
import { mu } from "@/api/mu";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { Button, IconButton, Input, Textarea, toastError } from "@/components/ui";

export default function CreateBusiness() {
  const navigate = useNavigate();
  const { switchProfile } = useAuth();
  const [form, setForm] = useState({ displayName: "", handle: "", category: "", bio: "" });
  const [touchedHandle, setTouchedHandle] = useState(false);
  const create = useMutation({
    mutationFn: () =>
      mu.profiles.createBusiness({
        displayName: form.displayName.trim(),
        handle: form.handle.trim(),
        category: form.category.trim() || undefined,
        bio: form.bio.trim() || undefined,
      }),
    onSuccess: async (p) => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      switchProfile(p.profileId);
      navigate("/settings");
    },
    onError: toastError,
  });
  const suggest = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 30);

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <header className="flex h-14 items-center gap-2 border-b border-line bg-surface px-2">
        <IconButton label="Back" onClick={() => navigate(-1)}><ArrowLeft className="size-6" /></IconButton>
        <h1 className="text-lg font-bold">New business profile</h1>
      </header>
      <div className="mx-auto max-w-[520px] p-4">
        <div className="mb-6 rounded-3xl bg-gradient-to-br from-brand/10 to-accent/15 p-5">
          <Building2 className="mb-2 size-8 text-accent-strong" />
          <h2 className="text-lg font-bold">Show up as your business</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li className="flex gap-2"><MessageCircle className="size-4 shrink-0 text-brand" /> A separate inbox for customer chats</li>
            <li className="flex gap-2"><Users className="size-4 shrink-0 text-brand" /> Followers, posts and lives as the business</li>
            <li className="flex gap-2"><Radio className="size-4 shrink-0 text-brand" /> Invite your team as admins or editors</li>
          </ul>
        </div>
        <form onSubmit={(e: FormEvent) => (e.preventDefault(), create.mutate())} className="space-y-3">
          <Input
            label="Business name"
            required
            maxLength={60}
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value, handle: touchedHandle ? form.handle : suggest(e.target.value) })}
          />
          <Input label="Handle" required maxLength={30} value={form.handle} onChange={(e) => (setTouchedHandle(true), setForm({ ...form, handle: e.target.value.toLowerCase() }))} hint="Your page link: /u/handle" />
          <Input label="Category" maxLength={40} placeholder="Bakery, Software, Fashion…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Textarea label="About" maxLength={300} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <Button className="w-full" loading={create.isPending} disabled={!form.displayName.trim() || form.handle.length < 3}>Create</Button>
        </form>
      </div>
    </div>
  );
}
