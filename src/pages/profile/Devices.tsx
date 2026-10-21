import { useMutation, useQuery } from "@tanstack/react-query";
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { mu } from "@/api/mu";
import type { Device } from "@/api/types";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { ago } from "@/lib/format";
import { Button, Loading, confirmThen, cx, toast, toastError } from "@/components/ui";

const isPhone = (label: string) => /Android|iPhone|iPad/.test(label);

function DeviceRow({ d, onSignOut, busy }: { d: Device; onSignOut?: () => void; busy?: boolean }) {
  const Icon = isPhone(d.label) ? Smartphone : Laptop;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={cx("flex size-10 items-center justify-center rounded-2xl", d.current ? "bg-brand/10 text-brand" : "bg-surface-2 text-muted")}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {d.label}
          {d.current && <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">This device</span>}
        </span>
        <span className="block text-xs text-muted">Active {ago(d.lastSeenAt)} · signed in {ago(d.signedInAt)}</span>
      </span>
      {onSignOut && (
        <Button size="sm" variant="secondary" loading={busy} onClick={onSignOut}>
          Sign out
        </Button>
      )}
    </li>
  );
}

/** Settings → Devices: where you're signed in, with remote sign-out. */
export function DevicesCard() {
  const devices = useQuery({ queryKey: ["devices"], queryFn: mu.devices });
  const signOut = useMutation({
    mutationFn: (id: string) => mu.signOutDevice(id),
    onSuccess: () => (toast("Device signed out"), void queryClient.invalidateQueries({ queryKey: ["devices"] })),
    onError: toastError,
  });
  return (
    <section className="border-b border-line bg-surface p-4 sm:rounded-3xl sm:border">
      <h2 className="font-bold">Devices</h2>
      <p className="text-sm text-muted">You can be signed in on up to {devices.data?.max ?? 3} devices.</p>
      {devices.isLoading ? (
        <Loading />
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {devices.data?.devices.map((d) => (
            <DeviceRow key={d.deviceId} d={d} onSignOut={d.current ? undefined : confirmThen({ title: `Sign out ${d.label}?`, message: "That device will be signed out of Mu right away.", confirmLabel: "Sign out", danger: true }, () => signOut.mutate(d.deviceId))} busy={signOut.isPending && signOut.variables === d.deviceId} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Shown instead of the app when this would be a 4th device. */
export function DeviceLimit({ onFreed }: { onFreed: () => void }) {
  const { logout } = useAuth();
  const devices = useQuery({ queryKey: ["devices"], queryFn: mu.devices });
  const signOut = useMutation({
    mutationFn: (id: string) => mu.signOutDevice(id),
    onSuccess: () => {
      toast("Signed out — you can use Mu here now");
      onFreed();
    },
    onError: toastError,
  });
  const others = devices.data?.devices.filter((d) => !d.current) ?? [];
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-sm">
        <img src="/favicon.svg" alt="" className="mb-4 size-12 rounded-2xl" />
        <h1 className="text-xl font-bold">You're signed in on {devices.data?.max ?? 3} devices</h1>
        <p className="mt-1 text-sm text-muted">Sign out of one of them to use Mu on this device.</p>
        {devices.isLoading ? (
          <Loading />
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {others.map((d) => (
              <DeviceRow key={d.deviceId} d={d} onSignOut={confirmThen({ title: `Sign out ${d.label}?`, message: "That device will be signed out so you can use Mu here.", confirmLabel: "Sign out", danger: true }, () => signOut.mutate(d.deviceId))} busy={signOut.isPending && signOut.variables === d.deviceId} />
            ))}
          </ul>
        )}
        <Button variant="ghost" className="mt-4 w-full" onClick={() => void logout()}>
          <LogOut className="size-4" /> Cancel and sign out here
        </Button>
      </div>
    </div>
  );
}
