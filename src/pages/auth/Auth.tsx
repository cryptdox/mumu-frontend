import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { MessageCircle, Radio, Sparkles } from "lucide-react";
import { useAuth, accessCodeHeader } from "@/lib/auth";
import { iam, errorMessage } from "@/lib/api";
import { Button, Input } from "@/components/ui";
import { Turnstile } from "@/components/Turnstile";
import { config } from "@/config";

function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-brand via-[#487eb0] to-accent p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-11 rounded-2xl ring-2 ring-white/40" />
          <span className="text-2xl font-bold">MuMu</span>
        </div>
        <div>
          <h2 className="max-w-md text-4xl font-bold leading-tight">Chat, share and go live — the network for providers and the people they serve.</h2>
          <ul className="mt-8 space-y-3 text-white/90">
            <li className="flex items-center gap-3"><MessageCircle className="size-5" /> Private and group chats, voice and video calls</li>
            <li className="flex items-center gap-3"><Sparkles className="size-5" /> Short posts with a photo, for your connections or everyone</li>
            <li className="flex items-center gap-3"><Radio className="size-5" /> Go live as your business</li>
          </ul>
        </div>
        <p className="text-sm text-white/70">Connect with other providers. Run several provider profiles from one account.</p>
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 right-24 size-80 rounded-full bg-white/10" />
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <img src="/favicon.svg" alt="" className="mb-4 size-12 rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

const Alert = ({ tone = "error", children }: { tone?: "error" | "ok"; children: ReactNode }) =>
  children ? <p role="alert" className={`rounded-2xl px-4 py-3 text-sm ${tone === "ok" ? "bg-ok/15 text-[#2e8b22]" : "bg-danger/10 text-danger"}`}>{children}</p> : null;

export function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/chats";
  if (user) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login({ email: email.trim(), password, captchaToken: captcha ?? "" });
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to your MuMu account">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="text-right text-sm">
          <Link to="/forgot-password" className="font-semibold text-brand">Forgot password?</Link>
        </div>
        <Turnstile onToken={setCaptcha} resetKey={resetKey} />
        <Alert>{error}</Alert>
        <Button className="w-full" loading={busy} disabled={!!config.turnstileSiteKey && !captcha}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here? <Link to="/register" className="font-semibold text-brand">Create an account</Link>
      </p>
      <p className="mt-3 text-center text-xs text-muted">
        <Link to="/privacy" className="hover:underline">Privacy policy</Link> · <Link to="/account-deletion" className="hover:underline">Delete account</Link>
      </p>
    </AuthFrame>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/chats" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register({ name: name.trim() || undefined, email: email.trim(), password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthFrame title="Check your email" subtitle={`We sent a confirmation link to ${email}.`}>
        <Link to="/login"><Button className="w-full">Go to sign in</Button></Link>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame title="Create your account" subtitle="Set up your provider profile right after — it takes a minute.">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters" />
        <Alert>{error}</Alert>
        <Button className="w-full" loading={busy}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have one? <Link to="/login" className="font-semibold text-brand">Sign in</Link>
      </p>
    </AuthFrame>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await iam("/api/auth/send-reset-password", { method: "POST", auth: false, headers: accessCodeHeader(), body: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {sent ? (
        <Alert tone="ok">If an account exists for {email}, a reset link is on its way.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Alert>{error}</Alert>
          <Button className="w-full" loading={busy}>Send link</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-brand">Back to sign in</Link></p>
    </AuthFrame>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await iam("/api/auth/reset-password", { method: "POST", auth: false, body: { resetToken: params.get("token"), newPassword: password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame title="Choose a new password">
      {done ? (
        <Link to="/login"><Button className="w-full">Password changed — sign in</Button></Link>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="New password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Alert>{error}</Alert>
          <Button className="w-full" loading={busy}>Save password</Button>
        </form>
      )}
    </AuthFrame>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"working" | "ok" | string>("working");
  useEffect(() => {
    iam("/api/auth/verify-email", { auth: false, query: { token: params.get("token") } })
      .then(() => setState("ok"))
      .catch((err) => setState(errorMessage(err)));
  }, [params]);
  return (
    <AuthFrame title={state === "ok" ? "Email confirmed" : state === "working" ? "Confirming…" : "Couldn't confirm"}>
      {state !== "working" && state !== "ok" && <Alert>{state}</Alert>}
      <Link to="/login" className="mt-4 block"><Button className="w-full">Sign in</Button></Link>
    </AuthFrame>
  );
}
