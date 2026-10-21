import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { BadgeCheck, Building2, Eye, EyeOff, Globe2, Loader2, Lock, Users, X } from "lucide-react";
import type { Audience, ProfileCard, ProfileKind } from "@/api/types";
import { errorMessage } from "@/lib/api";
import { charCount } from "@/lib/format";
import { LIMITS } from "@/config";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Buttons ─────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong shadow-sm shadow-brand/25",
  accent: "bg-accent text-white hover:bg-accent-strong shadow-sm shadow-accent/25",
  secondary: "bg-surface-2 text-ink hover:bg-line/60",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:bg-[#c23616]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: "sm" | "md" }>(
  function Button({ variant = "primary", loading, size = "md", className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cx(
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
          size === "sm" ? "h-8 px-3.5 text-sm" : "h-11 px-5 text-[15px]",
          variants[variant],
          className,
        )}
        {...rest}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

export function IconButton({ label, className, children, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx("inline-flex size-10 shrink-0 items-center justify-center rounded-full transition hover:bg-surface-2 active:scale-95 disabled:opacity-40", active && "text-brand", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Inputs ──────────────────────────────────────────────────────────────────

const field = "w-full rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-muted outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }>(function Input({ label, hint, className, type, ...rest }, ref) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>}
      <span className="relative block">
        <input ref={ref} type={isPassword && show ? "text" : type} className={cx(field, "h-12", isPassword && "pr-12", className)} {...rest} />
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-ink">
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(function Textarea({ label, className, ...rest }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>}
      <textarea ref={ref} className={cx(field, "min-h-24 resize-none py-3", className)} {...rest} />
    </label>
  );
});

/** Remaining characters of the 500 limit; turns warn/red near the end. */
export function CharCounter({ text, max = LIMITS.text }: { text: string; max?: number }) {
  const left = max - charCount(text);
  if (left > 60) return null;
  return <span className={cx("text-xs font-semibold tabular-nums", left < 0 ? "text-danger" : left <= 20 ? "text-warn" : "text-muted")}>{left}</span>;
}

// ── Avatars ─────────────────────────────────────────────────────────────────

const tints = ["#00a8ff", "#9c88ff", "#4cd137", "#fbc531", "#e84118", "#487eb0", "#8c7ae6", "#0097e6"];
const tintOf = (s: string) => tints[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % tints.length];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join("").toUpperCase() || "?";

export function Avatar({ profile, size = 40, online, ring }: { profile: { displayName: string; avatarUrl: string | null; kind?: ProfileKind }; size?: number; online?: boolean; ring?: boolean }) {
  const shape = profile.kind === "BUSINESS" ? "rounded-[30%]" : "rounded-full";
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt="" loading="lazy" className={cx("size-full object-cover", shape, ring && "ring-2 ring-brand ring-offset-2 ring-offset-surface")} />
      ) : (
        <span
          className={cx("flex size-full items-center justify-center font-semibold text-white", shape, ring && "ring-2 ring-brand ring-offset-2 ring-offset-surface")}
          style={{ background: tintOf(profile.displayName), fontSize: size * 0.38 }}
        >
          {initials(profile.displayName)}
        </span>
      )}
      {online && <span className="absolute bottom-0 right-0 rounded-full border-2 border-surface bg-ok" style={{ width: size * 0.28, height: size * 0.28 }} />}
    </span>
  );
}

export function Name({ profile, className }: { profile: Pick<ProfileCard, "displayName" | "isVerified" | "kind">; className?: string }) {
  return (
    <span className={cx("inline-flex min-w-0 items-center gap-1 font-semibold", className)}>
      <span className="truncate">{profile.displayName}</span>
      {profile.isVerified && <BadgeCheck className="size-4 shrink-0 fill-brand text-white" aria-label="Verified" />}
      {profile.kind === "BUSINESS" && <Building2 className="size-3.5 shrink-0 text-accent" aria-label="Business" />}
    </span>
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cx("size-6 animate-spin text-brand", className)} />;

export function Loading({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-muted">
      <Spinner />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-brand/10 text-brand">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-xs text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="mx-4 my-3 flex items-center justify-between gap-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
      <span>{errorMessage(error)}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-semibold underline">
          Retry
        </button>
      )}
    </div>
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────

type Toast = { id: number; text: string; tone: "info" | "error" };
let toastId = 0;
const toastListeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];
export function toast(text: string, tone: Toast["tone"] = "info") {
  const t = { id: ++toastId, text, tone };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l(toasts));
  }, 3500);
}
export const toastError = (err: unknown) => toast(errorMessage(err), "error");

export function Toaster() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    toastListeners.add(setList);
    return () => void toastListeners.delete(setList);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={cx("pointer-events-auto rounded-2xl px-4 py-2.5 text-sm font-medium shadow-lg", t.tone === "error" ? "bg-danger text-white" : "bg-ink text-surface")}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ── Sheet (bottom sheet on phones, dialog on desktop) ───────────────────────

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cx("safe-bottom max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl", wide ? "sm:max-w-xl" : "sm:max-w-md")}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between bg-surface px-5 pb-2 pt-4">
            <h2 className="text-lg font-bold">{title}</h2>
            <IconButton label="Close" onClick={onClose} className="-mr-2">
              <X className="size-5" />
            </IconButton>
          </div>
        )}
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="tablist">
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cx("flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition", value === i.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

// ── Audience ────────────────────────────────────────────────────────────────

export function audienceLabel(a: Audience, kind: ProfileKind = "PERSONAL") {
  return a === "PUBLIC" ? "Public" : a === "ONLY_ME" ? "Only me" : kind === "BUSINESS" ? "Followers" : "Friends";
}
export function AudienceIcon({ audience, className = "size-3.5" }: { audience: Audience; className?: string }) {
  return audience === "PUBLIC" ? <Globe2 className={className} /> : audience === "ONLY_ME" ? <Lock className={className} /> : <Users className={className} />;
}

export function AudiencePicker({ value, onChange, kind }: { value: Audience; onChange: (a: Audience) => void; kind: ProfileKind }) {
  const options: Audience[] = ["PUBLIC", "CONNECTIONS", "ONLY_ME"];
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Who can see this">
      {options.map((a) => (
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={value === a}
          onClick={() => onChange(a)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
            value === a ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink",
          )}
        >
          <AudienceIcon audience={a} />
          {audienceLabel(a, kind)}
        </button>
      ))}
    </div>
  );
}

// ── Confirm dialog (instead of the browser's confirm()) ─────────────────────

interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}
let confirmListener: ((r: ConfirmRequest | null) => void) | null = null;

/** Ask before doing something; resolves true when confirmed. Rendered by <ConfirmHost/>. */
export function confirmAction(opts: Omit<ConfirmRequest, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmListener) return resolve(window.confirm(opts.message ?? opts.title));
    confirmListener({ ...opts, resolve });
  });
}

/** Run `fn` only after the person confirms. */
export const confirmThen = (opts: Omit<ConfirmRequest, "resolve">, fn: () => void) => () => void confirmAction(opts).then((ok) => ok && fn());

export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    confirmListener = setReq;
    return () => void (confirmListener = null);
  }, []);
  const close = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };
  return (
    <Sheet open={!!req} onClose={() => close(false)}>
      {req && (
        <div className="pt-6 text-center sm:pt-5" role="alertdialog" aria-label={req.title}>
          <h2 className="text-lg font-bold">{req.title}</h2>
          {req.message && <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">{req.message}</p>}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button variant={req.danger ? "danger" : "primary"} className="sm:order-2" onClick={() => close(true)} autoFocus>
              {req.confirmLabel ?? "OK"}
            </Button>
            <Button variant="secondary" className="sm:order-1" onClick={() => close(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
