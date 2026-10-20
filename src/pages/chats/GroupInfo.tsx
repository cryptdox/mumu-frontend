import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { UserMinus, UserPlus } from "lucide-react";
import { mu } from "@/api/mu";
import type { Conversation } from "@/api/types";
import { useProfile } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { Avatar, Button, IconButton, Input, Name, Sheet, toastError } from "@/components/ui";
import { PersonRow, useProfileSearch } from "./NewChat";

export function GroupInfo({ chat, open, onClose }: { chat: Conversation; open: boolean; onClose: () => void }) {
  const me = useProfile();
  const isAdmin = chat.myRole === "ADMIN";
  const [title, setTitle] = useState(chat.title);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const results = useProfileSearch(q);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["chat", chat.conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["chats"] });
  };
  const rename = useMutation({ mutationFn: () => mu.chats.updateGroup(chat.conversationId, { title: title.trim() }), onSuccess: refresh, onError: toastError });
  const add = useMutation({ mutationFn: (id: string) => mu.chats.addMembers(chat.conversationId, [id]), onSuccess: () => (refresh(), setQ("")), onError: toastError });
  const remove = useMutation({ mutationFn: (id: string) => mu.chats.removeMember(chat.conversationId, id), onSuccess: refresh, onError: toastError });

  return (
    <Sheet open={open} onClose={onClose} title="Group info">
      <div className="flex flex-col items-center gap-2 py-2">
        <Avatar profile={{ displayName: chat.title, avatarUrl: chat.avatarUrl }} size={80} />
        {isAdmin ? (
          <form onSubmit={(e) => (e.preventDefault(), rename.mutate())} className="flex w-full gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} aria-label="Group name" />
            <Button disabled={!title.trim() || title === chat.title} loading={rename.isPending}>Save</Button>
          </form>
        ) : (
          <h3 className="text-xl font-bold">{chat.title}</h3>
        )}
        <p className="text-sm text-muted">{chat.memberCount} members</p>
      </div>
      {isAdmin && (
        <div className="mt-2">
          {adding ? (
            <>
              <Input placeholder="Add people by name or @handle" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              {(results.data ?? [])
                .filter((p) => !chat.members.some((m) => m.profileId === p.profileId))
                .map((p) => (
                  <PersonRow key={p.profileId} p={p} onClick={() => add.mutate(p.profileId)} right={<UserPlus className="size-5 text-brand" />} />
                ))}
            </>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}>
              <UserPlus className="size-4" /> Add people
            </Button>
          )}
        </div>
      )}
      <ul className="mt-3 divide-y divide-line">
        {chat.members.map((m) => (
          <li key={m.profileId} className="flex items-center gap-3 py-2">
            <Avatar profile={m} size={40} online={m.online} />
            <span className="min-w-0 flex-1">
              <Name profile={m} />
              <span className="block text-xs text-muted">{m.role === "ADMIN" ? "Admin" : `@${m.handle}`}</span>
            </span>
            {isAdmin && m.profileId !== me.profileId && (
              <IconButton label={`Remove ${m.displayName}`} onClick={() => remove.mutate(m.profileId)} className="text-danger">
                <UserMinus className="size-5" />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
