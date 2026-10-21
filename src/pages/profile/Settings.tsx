import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, LogOut, Monitor, Moon, Sun, Trash2, UserMinus } from "lucide-react";
import { mu } from "@/api/mu";
import { useAuth, useProfile } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { IMAGE_ACCEPT, prepareImage } from "@/lib/image";
import { setTheme, themeStore, type Theme } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { Avatar, Button, IconButton, Input, Name, Tabs, Textarea, confirmThen, cx, toast, toastError } from "@/components/ui";
import { DevicesCard } from "./Devices";
import { CategorySelect } from "@/components/CategorySelect";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line bg-surface p-4 sm:rounded-3xl sm:border">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function ProfileForm() {
  const me = useProfile();
  const { user } = useAuth();
  const [form, setForm] = useState({ displayName: me.displayName, handle: me.handle, bio: me.bio ?? "", categoryId: me.categoryId ?? "", website: me.website ?? "" });
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setForm({ displayName: me.displayName, handle: me.handle, bio: me.bio ?? "", categoryId: me.categoryId ?? "", website: me.website ?? "" });
  }, [me.profileId]); // eslint-disable-line react-hooks/exhaustive-deps
  const canEdit = me.role !== "EDITOR";
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["me"] });
    void queryClient.invalidateQueries({ queryKey: ["profile-view"] });
  };

  const save = useMutation({
    mutationFn: () =>
      mu.profiles.update(me.profileId, {
        displayName: form.displayName.trim(),
        handle: form.handle.trim(),
        bio: form.bio.trim() || null,
        ...(me.kind === "BUSINESS" && { categoryId: form.categoryId || null, website: form.website.trim() || null }),
      }),
    onSuccess: () => (refresh(), toast("Saved")),
    onError: toastError,
  });
  const image = useMutation({
    mutationFn: async ({ file, field }: { file: File; field: "avatarMediaId" | "coverMediaId" }) => {
      const ready = await prepareImage(file);
      const media = await mu.media.upload(ready, ready.name);
      return mu.profiles.update(me.profileId, { [field]: media.mediaId });
    },
    onSuccess: () => (refresh(), toast("Photo updated")),
    onError: toastError,
  });

  const submit = (e: FormEvent) => (e.preventDefault(), save.mutate());
  return (
    <Card title={me.kind === "BUSINESS" ? "Provider profile" : "Consumer profile"}>
      <div className="relative mb-12 h-28 overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-accent">
        {me.coverUrl && <img src={me.coverUrl} alt="" className="size-full object-cover" />}
        {canEdit && (
          <IconButton label="Change cover" onClick={() => coverRef.current?.click()} className="absolute right-2 top-2 bg-black/40 text-white hover:bg-black/60">
            <Camera className="size-5" />
          </IconButton>
        )}
        <div className="absolute -bottom-10 left-4" />
      </div>
      <div className="-mt-24 mb-4 flex items-end gap-3 pl-4">
        <button disabled={!canEdit} onClick={() => avatarRef.current?.click()} className="relative rounded-full bg-surface p-1" aria-label="Change photo">
          <Avatar profile={me} size={80} />
          {canEdit && <span className="absolute bottom-1 right-1 flex size-7 items-center justify-center rounded-full bg-brand text-white"><Camera className="size-4" /></span>}
        </button>
        {image.isPending && <span className="pb-2 text-sm text-muted">Uploading…</span>}
      </div>
      <input ref={avatarRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => (e.target.files?.[0] && image.mutate({ file: e.target.files[0], field: "avatarMediaId" }), (e.target.value = ""))} />
      <input ref={coverRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => (e.target.files?.[0] && image.mutate({ file: e.target.files[0], field: "coverMediaId" }), (e.target.value = ""))} />
      {canEdit ? (
        <form onSubmit={submit} className="space-y-3">
          <Input label="Name" value={form.displayName} maxLength={60} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
          <Input label="Handle" value={form.handle} maxLength={30} onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })} hint="Letters, digits, _ and . — your profile link is /u/handle" required />
          {me.kind === "BUSINESS" && (
            <>
              <CategorySelect value={form.categoryId} onChange={(categoryId) => setForm({ ...form, categoryId })} />
              <Input label="Website" type="url" value={form.website} placeholder="https://" onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </>
          )}
          <Textarea label="Bio" value={form.bio} maxLength={300} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <Button loading={save.isPending}>Save</Button>
        </form>
      ) : (
        <p className="text-sm text-muted">You're an editor of this provider — only its owner and admins can change the profile.</p>
      )}
      {me.kind === "PERSONAL" && <p className="mt-3 text-xs text-muted">Signed in as {user?.email}</p>}
    </Card>
  );
}

function Members() {
  const me = useProfile();
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"ADMIN" | "EDITOR">("EDITOR");
  const members = useQuery({ queryKey: ["members", me.profileId], queryFn: () => mu.profiles.members(me.profileId) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["members", me.profileId] });
  const add = useMutation({ mutationFn: () => mu.profiles.addMember(me.profileId, handle.trim().replace(/^@/, ""), role), onSuccess: () => (refresh(), setHandle("")), onError: toastError });
  const remove = useMutation({ mutationFn: (userId: string) => mu.profiles.removeMember(me.profileId, userId), onSuccess: refresh, onError: toastError });
  return (
    <Card title="People who manage this page">
      <ul className="mb-3 divide-y divide-line">
        {members.data?.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 py-2">
            {m.profile ? <Avatar profile={m.profile} size={40} /> : <span className="size-10 rounded-full bg-surface-2" />}
            <span className="min-w-0 flex-1">
              {m.profile ? <Name profile={m.profile} /> : "Unknown"}
              <span className="block text-xs capitalize text-muted">{m.role.toLowerCase()}</span>
            </span>
            {m.role !== "OWNER" && (
              <IconButton label="Remove" onClick={confirmThen({ title: `Remove ${m.profile?.displayName ?? "this person"}?`, message: "They won't be able to post, chat or go live as this page any more.", confirmLabel: "Remove", danger: true }, () => remove.mutate(m.userId))} className="text-danger"><UserMinus className="size-5" /></IconButton>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => (e.preventDefault(), add.mutate())} className="space-y-2">
        <Input placeholder="@handle of a person" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <div className="flex items-center gap-2">
          <div className="flex-1"><Tabs value={role} onChange={setRole} items={[{ value: "EDITOR", label: "Editor" }, { value: "ADMIN", label: "Admin" }]} /></div>
          <Button size="sm" loading={add.isPending} disabled={!handle.trim()}>Add</Button>
        </div>
        <p className="text-xs text-muted">Editors post, chat and go live as the page. Admins can also edit it and manage people.</p>
      </form>
    </Card>
  );
}

/** Your hidden Consumer (personal) profile: switch to it to use MuMu as a customer. */
function ConsumerMode() {
  const me = useProfile();
  const { profiles, switchProfile, account } = useAuth();
  const navigate = useNavigate();
  const consumer = profiles.find((p) => p.kind === "PERSONAL");
  const provider = profiles.find((p) => p.kind === "BUSINESS");
  if (!consumer || (!account?.settings.consumerModeEnabled && me.kind !== "PERSONAL")) return null;
  const asConsumer = me.kind === "PERSONAL";
  return (
    <Card title="Consumer mode">
      <p className="mb-3 text-sm text-muted">
        {asConsumer
          ? "You're using MuMu as a consumer — your personal profile. Switch back to act as your provider."
          : "Use MuMu as a customer with your personal profile, separate from your provider profiles."}
      </p>
      <Button
        variant={asConsumer ? "primary" : "secondary"}
        onClick={() => {
          const target = asConsumer ? provider : consumer;
          if (target) (switchProfile(target.profileId), navigate("/chats"));
        }}
      >
        {asConsumer ? `Back to ${provider?.displayName ?? "provider"}` : "Switch to consumer"}
      </Button>
    </Card>
  );
}

export default function SettingsPage() {
  const me = useProfile();
  const { logout, switchProfile, profiles } = useAuth();
  const navigate = useNavigate();
  const theme = useStore(themeStore);
  const blocks = useQuery({ queryKey: ["blocks"], queryFn: mu.connections.blocks });
  const unblock = useMutation({ mutationFn: (id: string) => mu.connections.unblock(id), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["blocks"] }) });
  const remove = useMutation({
    mutationFn: () => mu.profiles.remove(me.profileId),
    onSuccess: () => {
      const next = profiles.find((p) => p.kind === "BUSINESS" && p.profileId !== me.profileId) ?? profiles.find((p) => p.kind === "PERSONAL");
      if (next) switchProfile(next.profileId);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      toast("Provider profile deleted");
      navigate("/chats");
    },
    onError: toastError,
  });

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "Auto", icon: Monitor },
  ];

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-2 backdrop-blur">
        <IconButton label="Back" onClick={() => navigate(-1)}><ArrowLeft className="size-6" /></IconButton>
        <h1 className="flex-1 text-lg font-bold">Settings</h1>
        <Link to={`/u/${me.handle}`} className="mr-2 text-sm font-semibold text-brand">View profile</Link>
      </header>
      <div className="mx-auto flex max-w-[620px] flex-col sm:gap-3 sm:p-4">
        <ProfileForm />
        {me.kind === "BUSINESS" && me.role !== "EDITOR" && <Members />}
        <Card title="Appearance">
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <button key={value} onClick={() => setTheme(value)} className={cx("flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-sm font-semibold", theme === value ? "border-brand bg-brand/10 text-brand" : "border-line text-muted")}>
                <Icon className="size-5" /> {label}
              </button>
            ))}
          </div>
        </Card>
        <ConsumerMode />
        <DevicesCard />
        <Card title="Blocked">
          {blocks.data?.length ? (
            blocks.data.map((b) => (
              <div key={b.profileId} className="flex items-center gap-3 py-1.5">
                <Avatar profile={b} size={36} />
                <span className="flex-1 truncate font-medium">{b.displayName}</span>
                <Button size="sm" variant="secondary" onClick={() => unblock.mutate(b.profileId)}>Unblock</Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">You haven't blocked anyone.</p>
          )}
        </Card>
        <Card title="Account">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void logout().then(() => navigate("/login"))}>
              <LogOut className="size-4" /> Sign out
            </Button>
            {me.kind === "BUSINESS" && me.role === "OWNER" && (
              <Button variant="danger" loading={remove.isPending} onClick={confirmThen({ title: `Delete ${me.displayName}?`, message: "Its posts stay hidden and its people lose access. This can't be undone.", confirmLabel: "Delete", danger: true }, () => remove.mutate())}>
                <Trash2 className="size-4" /> Delete provider profile
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
