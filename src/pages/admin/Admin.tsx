import { useState, type FormEvent } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BadgeCheck, Ban, Eye, EyeOff, Flag, LayoutDashboard, Radio, Settings2, Tags, Trash2, Users } from "lucide-react";
import { mu, type AdminSettings } from "@/api/mu";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { compact, shortTime } from "@/lib/format";
import { Avatar, Button, Empty, ErrorNote, Input, Loading, Name, Tabs, confirmThen, cx, toast, toastError } from "@/components/ui";
import { TopBar } from "@/components/layout";

const sections = [
  { to: "", label: "Overview", icon: LayoutDashboard },
  { to: "categories", label: "Categories", icon: Tags },
  { to: "profiles", label: "Profiles", icon: Users },
  { to: "reports", label: "Reports", icon: Flag },
  { to: "live", label: "Live", icon: Radio },
  { to: "settings", label: "Settings", icon: Settings2 },
];

function Card({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-bold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function Overview() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: mu.admin.overview, refetchInterval: 30_000 });
  if (q.isLoading) return <Loading />;
  const d = q.data ?? {};
  const tiles: [string, number | undefined, string?][] = [
    ["Providers", d.providers, "/admin/profiles"],
    ["Consumers", d.consumers],
    ["Live now", d.liveNow, "/admin/live"],
    ["Open reports", d.openReports, "/admin/reports"],
    ["Posts", d.posts],
    ["Posts (24h)", d.posts24h],
    ["Messages (24h)", d.messages24h],
    ["Active devices (24h)", d.activeDevices24h],
    ["Suspended", d.suspended, "/admin/profiles"],
    ["Categories", d.categories, "/admin/categories"],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <ErrorNote error={q.error} />
      {tiles.map(([label, n, link]) => {
        const body = (
          <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{compact(n ?? 0)}</p>
          </div>
        );
        return link ? <Link key={label} to={link}>{body}</Link> : <div key={label}>{body}</div>;
      })}
    </div>
  );
}

function Categories() {
  const [name, setName] = useState("");
  const q = useQuery({ queryKey: ["admin", "categories"], queryFn: mu.admin.categories });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  };
  const add = useMutation({ mutationFn: () => mu.admin.addCategory(name.trim()), onSuccess: () => (setName(""), refresh()), onError: toastError });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: Parameters<typeof mu.admin.updateCategory>[1] }) => mu.admin.updateCategory(id, body), onSuccess: refresh, onError: toastError });
  const remove = useMutation({ mutationFn: (id: string) => mu.admin.deleteCategory(id), onSuccess: () => (toast("Category deleted"), refresh()), onError: toastError });
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const list = q.data ?? [];
  const move = (i: number, dir: -1 | 1) => {
    const a = list[i], b = list[i + dir];
    if (!a || !b) return;
    update.mutate({ id: a.categoryId, body: { sortOrder: b.sortOrder ?? i + dir } });
    update.mutate({ id: b.categoryId, body: { sortOrder: a.sortOrder ?? i } });
  };
  return (
    <Card title="Provider categories">
      <form onSubmit={(e: FormEvent) => (e.preventDefault(), name.trim() && add.mutate())} className="mb-4 flex gap-2">
        <div className="flex-1"><Input placeholder="New category, e.g. Restaurant" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>
        <Button loading={add.isPending} disabled={!name.trim()}>Add</Button>
      </form>
      {q.isLoading ? <Loading /> : !list.length ? (
        <Empty icon={<Tags className="size-8" />} title="No categories yet">Add the categories providers can choose from.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((c, i) => (
            <li key={c.categoryId} className="flex items-center gap-2 py-2">
              <div className="flex flex-col">
                <button disabled={i === 0} onClick={() => move(i, -1)} className="px-1 text-xs text-muted disabled:opacity-30" aria-label="Move up">▲</button>
                <button disabled={i === list.length - 1} onClick={() => move(i, 1)} className="px-1 text-xs text-muted disabled:opacity-30" aria-label="Move down">▼</button>
              </div>
              {editing?.id === c.categoryId ? (
                <form className="flex flex-1 gap-2" onSubmit={(e) => (e.preventDefault(), update.mutate({ id: c.categoryId, body: { name: editing.name.trim() } }), setEditing(null))}>
                  <div className="flex-1"><Input value={editing.name} maxLength={40} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                  <Button size="sm">Save</Button>
                </form>
              ) : (
                <button className={cx("min-w-0 flex-1 truncate text-left font-medium", !c.isActive && "text-muted line-through")} onClick={() => setEditing({ id: c.categoryId, name: c.name })} title="Rename">
                  {c.name}
                  <span className="ml-2 text-xs font-normal text-muted no-underline">{c._count?.profiles ?? 0} profiles</span>
                </button>
              )}
              <Button size="sm" variant="secondary" onClick={() => update.mutate({ id: c.categoryId, body: { isActive: !c.isActive } })} title={c.isActive ? "Hide from the dropdown" : "Show in the dropdown"}>
                {c.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                <span className="hidden sm:inline">{c.isActive ? "On" : "Off"}</span>
              </Button>
              <button
                aria-label={`Delete ${c.name}`}
                disabled={!!c._count?.profiles}
                onClick={confirmThen({ title: `Delete "${c.name}"?`, confirmLabel: "Delete", danger: true }, () => remove.mutate(c.categoryId))}
                className="flex size-9 items-center justify-center rounded-full text-danger hover:bg-danger/10 disabled:opacity-30"
                title={c._count?.profiles ? "In use — turn it off instead" : "Delete"}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SettingsSection() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: mu.admin.settings });
  const save = useMutation({
    mutationFn: (patch: Partial<AdminSettings>) => mu.admin.saveSettings(patch),
    onSuccess: (s) => (queryClient.setQueryData(["admin", "settings"], s), void queryClient.invalidateQueries({ queryKey: ["me"] }), toast("Saved")),
    onError: toastError,
  });
  if (q.isLoading || !q.data) return <Loading />;
  const s = q.data;
  const Toggle = ({ k, label, hint }: { k: "consumerModeEnabled" | "liveEnabled"; label: string; hint: string }) => (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <input type="checkbox" className="size-5 accent-[#00a8ff]" checked={s[k]} onChange={(e) => save.mutate({ [k]: e.target.checked })} />
    </label>
  );
  return (
    <Card title="App settings">
      <div className="divide-y divide-line">
        <Toggle k="liveEnabled" label="Live streaming" hint="Let providers go live. Turning it off doesn't end lives already running." />
        <Toggle k="consumerModeEnabled" label="Consumer mode" hint="Let people switch to their personal (consumer) profile from Settings." />
        <form
          className="flex items-center justify-between gap-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(new FormData(e.currentTarget).get("max"));
            if (v >= 1) save.mutate({ maxProvidersPerAccount: v });
          }}
        >
          <span>
            <span className="block font-semibold">Provider profiles per account</span>
            <span className="block text-sm text-muted">How many provider profiles one person can own.</span>
          </span>
          <span className="flex items-center gap-2">
            <input name="max" type="number" min={1} max={100} defaultValue={s.maxProvidersPerAccount} className="h-10 w-20 rounded-xl border border-line bg-surface px-3 text-center" />
            <Button size="sm">Save</Button>
          </span>
        </form>
      </div>
    </Card>
  );
}

function Profiles() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"BUSINESS" | "PERSONAL" | "">("BUSINESS");
  const [status, setStatus] = useState<"" | "suspended">("");
  const list = useQuery({ queryKey: ["admin", "profiles", q, kind, status], queryFn: () => mu.admin.profiles({ q: q || undefined, kind: kind || undefined, status: status || undefined }) });
  const mod = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { isVerified?: boolean; suspended?: boolean } }) => mu.admin.moderateProfile(id, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] }),
    onError: toastError,
  });
  return (
    <Card title={`Profiles${list.data ? ` · ${list.data.total}` : ""}`}>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Input placeholder="Search name or @handle" value={q} onChange={(e) => setQ(e.target.value)} />
        <Tabs value={kind} onChange={setKind} items={[{ value: "BUSINESS", label: "Providers" }, { value: "PERSONAL", label: "Consumers" }, { value: "", label: "All" }]} />
        <Tabs value={status} onChange={setStatus} items={[{ value: "", label: "Any" }, { value: "suspended", label: "Suspended" }]} />
      </div>
      {list.isLoading ? <Loading /> : (
        <ul className="divide-y divide-line">
          {list.data?.items.map((p) => (
            <li key={p.profileId} className="flex flex-wrap items-center gap-3 py-2.5">
              <Link to={`/u/${p.handle}`}><Avatar profile={p} size={40} /></Link>
              <div className="min-w-0 flex-1">
                <Name profile={p} />
                <p className="truncate text-xs text-muted">
                  @{p.handle} · {p.kind === "BUSINESS" ? "Provider" : "Consumer"}{p.category && ` · ${p.category}`} · {p._count.posts} posts · {p._count.followers} followers
                  {p.suspendedAt && <span className="ml-1 font-semibold text-danger">· suspended</span>}
                </p>
              </div>
              <Button size="sm" variant={p.isVerified ? "accent" : "secondary"} onClick={() => mod.mutate({ id: p.profileId, body: { isVerified: !p.isVerified } })}>
                <BadgeCheck className="size-4" /> {p.isVerified ? "Verified" : "Verify"}
              </Button>
              {p.suspendedAt ? (
                <Button size="sm" variant="secondary" onClick={() => mod.mutate({ id: p.profileId, body: { suspended: false } })}>Restore</Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={confirmThen({ title: `Suspend ${p.displayName}?`, message: "It can't be used, and disappears from search, feeds and lives until restored.", confirmLabel: "Suspend", danger: true }, () => mod.mutate({ id: p.profileId, body: { suspended: true } }))}
                >
                  <Ban className="size-4" /> Suspend
                </Button>
              )}
            </li>
          ))}
          {!list.data?.items.length && <p className="py-8 text-center text-sm text-muted">No profiles match.</p>}
        </ul>
      )}
    </Card>
  );
}

function Reports() {
  const [status, setStatus] = useState<"OPEN" | "ACTIONED" | "DISMISSED">("OPEN");
  const q = useQuery({ queryKey: ["admin", "reports", status], queryFn: () => mu.admin.reports(status) });
  const resolve = useMutation({
    mutationFn: ({ id, s }: { id: string; s: "ACTIONED" | "DISMISSED" }) => mu.admin.resolveReport(id, s),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin"] }),
    onError: toastError,
  });
  const where = (t: string, id: string) => (t === "POST" ? `/posts/${id}` : t === "LIVE" ? `/live/${id}` : t === "PROFILE" ? null : null);
  return (
    <Card title="Reports" right={<Tabs value={status} onChange={setStatus} items={[{ value: "OPEN", label: "Open" }, { value: "ACTIONED", label: "Actioned" }, { value: "DISMISSED", label: "Dismissed" }]} />}>
      {q.isLoading ? <Loading /> : !q.data?.items.length ? (
        <Empty icon={<Flag className="size-8" />} title="Nothing here">No {status.toLowerCase()} reports.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {q.data.items.map((r) => {
            const link = where(r.targetType, r.targetId);
            return (
              <li key={r.reportId} className="flex flex-wrap items-center gap-3 py-3">
                <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-bold text-danger">{r.targetType}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">“{r.reason}”</p>
                  <p className="text-xs text-muted">
                    by {r.reporter.displayName} · {shortTime(r.createdAt)}
                    {link && <> · <Link to={link} className="font-semibold text-brand">open</Link></>}
                  </p>
                </div>
                {r.status === "OPEN" && (
                  <>
                    <Button size="sm" variant="danger" onClick={confirmThen({ title: "Take it down?", message: "The reported content is removed (profiles: use Suspend).", confirmLabel: "Take down", danger: true }, () => resolve.mutate({ id: r.reportId, s: "ACTIONED" }))}>Take down</Button>
                    <Button size="sm" variant="secondary" onClick={() => resolve.mutate({ id: r.reportId, s: "DISMISSED" })}>Dismiss</Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Lives() {
  const q = useQuery({ queryKey: ["admin", "live"], queryFn: mu.admin.lives, refetchInterval: 15_000 });
  const end = useMutation({ mutationFn: (id: string) => mu.admin.endLive(id), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "live"] }), onError: toastError });
  return (
    <Card title="Live now">
      {q.isLoading ? <Loading /> : !q.data?.length ? (
        <Empty icon={<Radio className="size-8" />} title="Nobody's live" />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.map((l) => (
            <li key={l.liveStreamId} className="flex items-center gap-3 py-2.5">
              <Avatar profile={l.host} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.title}</p>
                <p className="text-xs text-muted">{l.host.displayName} · {compact(l.viewerCount)} watching · since {shortTime(l.startedAt)}</p>
              </div>
              <Link to={`/live/${l.liveStreamId}`}><Button size="sm" variant="secondary">Watch</Button></Link>
              <Button size="sm" variant="danger" onClick={confirmThen({ title: `End "${l.title}"?`, message: "Viewers see that the live has ended.", confirmLabel: "End live", danger: true }, () => end.mutate(l.liveStreamId))}>End</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** /admin — for the IAM ADMIN role of client mu. */
export default function Admin() {
  const { account } = useAuth();
  if (!account?.isAdmin) return <Navigate to="/chats" replace />;
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <TopBar title="Admin" />
      <div className="mx-auto max-w-5xl p-4">
        <nav className="scrollbar-thin -mx-1 mb-4 flex gap-1 overflow-x-auto px-1" aria-label="Admin sections">
          {sections.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={label}
              to={to ? `/admin/${to}` : "/admin"}
              end={!to}
              className={({ isActive }) => cx("flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition", isActive ? "bg-brand text-white" : "bg-surface text-muted hover:text-ink")}
            >
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="categories" element={<Categories />} />
          <Route path="profiles" element={<Profiles />} />
          <Route path="reports" element={<Reports />} />
          <Route path="live" element={<Lives />} />
          <Route path="settings" element={<SettingsSection />} />
        </Routes>
      </div>
    </div>
  );
}

