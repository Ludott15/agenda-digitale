"use client";

import { BellRing, Check, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "@/app/actions/notifications";
import { Alert, Button, Skeleton } from "@/components/ui";

type PushState = "checking" | "unsupported" | "ios-install" | "unconfigured" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Chiave VAPID (base64url) in ArrayBuffer per pushManager.subscribe. */
function urlBase64ToApplicationKey(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return buffer;
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Stato iniziale che non richiede la sottoscrizione: null = serve controllare il service worker. */
function staticState(): PushState | null {
  if (isIosDevice() && !isStandalone()) return "ios-install";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (!VAPID_PUBLIC_KEY) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  return null;
}

/** Attivazione/disattivazione delle notifiche push sul dispositivo corrente. */
export function PushToggle() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fixed = staticState();
    if (fixed) {
      queueMicrotask(() => {
        if (!cancelled) setState(fixed);
      });
      return () => {
        cancelled = true;
      };
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setState(sub ? "on" : "off");
      })
      .catch(() => {
        if (!cancelled) setState("off");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Il permesso va chiesto dentro il gesto dell'utente: nessun await prima di requestPermission().
  const enable = () => {
    if (!VAPID_PUBLIC_KEY) return;
    setBusy(true);
    setError(null);
    Notification.requestPermission()
      .then(async (permission) => {
        if (permission === "denied") {
          setState("denied");
          return;
        }
        if (permission !== "granted") {
          setState("off");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToApplicationKey(VAPID_PUBLIC_KEY),
        });
        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          await sub.unsubscribe();
          throw new Error("Iscrizione non valida");
        }
        const saved = await savePushSubscription(
          { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
          navigator.userAgent,
        );
        if (!saved.ok) {
          await sub.unsubscribe();
          throw new Error(saved.error);
        }
        setState("on");
      })
      .catch(() => {
        setError("Non è stato possibile attivare le notifiche. Riprova tra poco.");
      })
      .finally(() => setBusy(false));
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await deletePushSubscription(endpoint);
      }
      setState("off");
    } catch {
      setError("Non è stato possibile disattivare le notifiche. Riprova.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "checking") return <Skeleton className="h-10 w-full" />;

  if (state === "unsupported") {
    return <p className="text-[13px] leading-relaxed text-slate-dark">Le notifiche push non sono disponibili su questo browser.</p>;
  }

  if (state === "unconfigured") {
    return <p className="text-[13px] leading-relaxed text-slate-dark">Le notifiche push non sono ancora configurate.</p>;
  }

  if (state === "ios-install") {
    return (
      <div className="flex flex-col gap-2 rounded-btn bg-cream/70 px-4 py-3">
        <p className="text-[14px] font-medium text-ink">Installa l’app per ricevere le notifiche</p>
        <p className="text-[13px] leading-relaxed text-slate-dark">
          Tocca Condividi e poi «Aggiungi alla schermata Home». Apri l’app dalla nuova icona e attiva le notifiche da qui.
        </p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-[13px] leading-relaxed text-slate-dark">
        Le notifiche sono bloccate per questo sito. Riattivale dalle impostazioni del browser (icona del lucchetto nella barra degli indirizzi).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {state === "on" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-[14px] font-medium text-success">
            <Check aria-hidden="true" className="size-4" />
            Notifiche attive su questo dispositivo
          </p>
          <Button variant="ghost" size="sm" onClick={disable} disabled={busy} aria-busy={busy || undefined}>
            Disattiva
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={enable} disabled={busy} aria-busy={busy || undefined} className="w-full">
          {busy ? (
            "Attivazione…"
          ) : (
            <>
              <Smartphone aria-hidden="true" className="size-4" />
              Attiva notifiche sul telefono
            </>
          )}
        </Button>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {state === "off" && !error && (
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate">
          <BellRing aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Ricevi un avviso anche con l’app chiusa.
        </p>
      )}
    </div>
  );
}
