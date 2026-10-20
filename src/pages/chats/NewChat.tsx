import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Users } from "lucide-react";
import { mu } from "@/api/mu";
import type { ProfileCard } from "@/api/types";
import { useProfile } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { Avatar, Button, Input, Name, Sheet, Spinner, Tabs, cx, toastError } from "@/components/ui";

export function useProfileSearch(q: string) {
  return useQuery({ queryKey: ["search", q], queryFn: () => mu.profiles.search(q), enabled: q.trim().length >= 1, staleTime: 10_000 });
}

export function PersonRow({ p, right, onClick }: { p: ProfileCard; right?: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface-2">
      <Avatar profile={p} size={44} />
      <span className="min-w-0 flex-1">
        <Name profile={p} />
        <span className="block truncate text-sm text-muted">@{p.handle}</span>
      </span>
      {right}
    </button>
  );
}

/** Start a 1:1 chat with anyone (people or businesses), or make a group. */
export function NewChatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useProfile();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<ProfileCard[]>([]);
  const results = useProfileSearch(q);
  const people = (results.data ?? []).filter((p) => p.profileId !== me.profileId);

  const reset = () => {
    setQ("");
    setTitle("");
    setPicked([]);
    setMode("direct");
    onClose();
  };
  const open1to1 = useMutation({
    mutationFn: (profileId: string) => mu.chats.direct(profileId),
    onSuccess: (c) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      reset();
      navigate(`/chats/${c.conversationId}`);
    },
    onError: toastError,
  });
  const makeGroup = useMutation({
    mutationFn: () => mu.chats.group(title.trim(), picked.map((p) => p.profileId)),
    onSuccess: (c) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      reset();
      navigate(`/chats/${c.conversationId}`);
    },
    onError: toastError,
  });
  const toggle = (p: ProfileCard) => setPicked((s) => (s.some((x) => x.profileId === p.profileId) ? s.filter((x) => x.profileId !== p.profileId) : [...s, p]));

  return (
    <Sheet open={open} onClose={reset} title="New chat">
      <Tabs value={mode} onChange={setMode} items={[{ value: "direct", label: "Message" }, { value: "group", label: "New group" }]} />
      {mode === "group" && (
        <div className="mt-4 space-y-3">
          <Input placeholder="Group name" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {picked.map((p) => (
                <button key={p.profileId} onClick={() => toggle(p)} className="flex items-center gap-1.5 rounded-full bg-brand/10 py-1 pl-1 pr-3 text-sm font-medium text-brand">
                  <Avatar profile={p} size={22} /> {p.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mt-4">
        <Input placeholder="Search people and businesses" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="mt-2 min-h-40">
        {results.isFetching && <Spinner className="mx-auto mt-6 block" />}
        {!q && <p className="mt-6 text-center text-sm text-muted">Find someone by name or @handle.</p>}
        {q && !results.isFetching && !people.length && <p className="mt-6 text-center text-sm text-muted">Nobody found.</p>}
        {people.map((p) =>
          mode === "direct" ? (
            <PersonRow key={p.profileId} p={p} onClick={() => open1to1.mutate(p.profileId)} />
          ) : (
            <PersonRow
              key={p.profileId}
              p={p}
              onClick={() => toggle(p)}
              right={
                <span className={cx("flex size-6 items-center justify-center rounded-full border-2", picked.some((x) => x.profileId === p.profileId) ? "border-brand bg-brand text-white" : "border-line")}>
                  <Check className="size-4" />
                </span>
              }
            />
          ),
        )}
      </div>
      {mode === "group" && (
        <Button className="mt-4 w-full" disabled={!title.trim() || !picked.length} loading={makeGroup.isPending} onClick={() => makeGroup.mutate()}>
          <Users className="size-4" /> Create group ({picked.length + 1})
        </Button>
      )}
    </Sheet>
  );
}
