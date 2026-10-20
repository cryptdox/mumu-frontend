import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { mu } from "@/api/mu";
import type { Audience } from "@/api/types";
import { useProfile } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { IMAGE_ACCEPT, prepareImage } from "@/lib/image";
import { charCount } from "@/lib/format";
import { LIMITS } from "@/config";
import { AudiencePicker, Avatar, Button, CharCounter, IconButton, toast, toastError } from "@/components/ui";

/** Write a post: up to 500 characters and one photo, for an audience. */
export function PostComposer({ onPosted }: { onPosted?: () => void }) {
  const me = useProfile();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>("PUBLIC");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const tooLong = charCount(text) > LIMITS.text;
  const canPost = !busy && !tooLong && (!!text.trim() || !!file);

  async function pick(f?: File) {
    if (!f) return;
    try {
      const ready = await prepareImage(f);
      setFile(ready);
      setPreview(URL.createObjectURL(ready));
      setFocused(true);
    } catch (err) {
      toastError(err);
    }
  }

  async function submit() {
    if (!canPost) return;
    setBusy(true);
    try {
      const mediaId = file ? (await mu.media.upload(file, file.name)).mediaId : undefined;
      await mu.posts.create({ text: text.trim() || undefined, mediaId, audience });
      setText("");
      setFile(null);
      setPreview(null);
      setFocused(false);
      toast("Posted");
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      onPosted?.();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-line bg-surface p-4 sm:rounded-3xl sm:border sm:shadow-sm">
      <div className="flex gap-3">
        <Avatar profile={me} size={44} />
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            rows={focused ? 3 : 1}
            placeholder={me.kind === "BUSINESS" ? `Share an update from ${me.displayName}` : "What's new?"}
            aria-label="Write a post"
            className="w-full resize-none bg-transparent py-2.5 text-[16px] outline-none placeholder:text-muted focus-visible:outline-none"
          />
          {preview && (
            <div className="relative mt-1 inline-block">
              <img src={preview} alt="Selected" className="max-h-72 rounded-2xl object-cover" />
              <button onClick={() => (setFile(null), setPreview(null))} aria-label="Remove image" className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white">
                <X className="size-4" />
              </button>
            </div>
          )}
          {(focused || text || file) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <IconButton label="Add a photo" onClick={() => fileRef.current?.click()} disabled={!!file} className="-ml-2 text-brand">
                <ImagePlus className="size-5" />
              </IconButton>
              <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ""))} />
              <AudiencePicker value={audience} onChange={setAudience} kind={me.kind} />
              <span className="ml-auto flex items-center gap-3">
                <CharCounter text={text} />
                <Button size="sm" onClick={submit} loading={busy} disabled={!canPost}>
                  Post
                </Button>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
