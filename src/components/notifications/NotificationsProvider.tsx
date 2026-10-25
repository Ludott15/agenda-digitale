"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { markNotificationsRead } from "@/app/actions/notifications";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/lib/types";

/** Quante notifiche tenere in memoria nel pannello (come il caricamento iniziale). */
const MAX_ITEMS = 30;

interface NotificationsContextValue {
  items: AppNotification[];
  unreadCount: number;
  /** Cresce a ogni notifica arrivata in tempo reale: serve a far partire l'animazione del badge. */
  pulse: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export interface NotificationsProviderProps {
  profileId: string;
  initialItems: AppNotification[];
  initialUnread: number;
  children: ReactNode;
}

/**
 * Stato delle notifiche per tutta l'app (campanella desktop e mobile condividono lo stesso stato).
 * Realtime: INSERT su notifications filtrato sul destinatario. Lettura: ottimistica, con rollback se il server rifiuta.
 */
export function NotificationsProvider({ profileId, initialItems, initialUnread, children }: NotificationsProviderProps) {
  const [items, setItems] = useState<AppNotification[]>(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Il socket realtime deve usare il token dell'utente, altrimenti le RLS scartano gli eventi.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`notifications-${profileId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${profileId}`,
          },
          (payload) => {
            const row = payload.new as AppNotification;
            setItems((list) => [row, ...list.filter((n) => n.id !== row.id)].slice(0, MAX_ITEMS));
            setUnreadCount((count) => count + (row.read_at ? 0 : 1));
            setPulse((p) => p + 1);
          },
        )
        .subscribe();
    });

    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      cancelled = true;
      auth.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [profileId]);

  const markRead = useCallback(
    (id: string) => {
      const target = items.find((n) => n.id === id);
      if (!target || target.read_at) return;
      const readAt = new Date().toISOString();
      setItems((list) => list.map((n) => (n.id === id ? { ...n, read_at: readAt } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
      void markNotificationsRead([id]).then((result) => {
        if (result.ok) return;
        // Rollback: la notifica torna non letta.
        setItems((list) => list.map((n) => (n.id === id ? { ...n, read_at: null } : n)));
        setUnreadCount((count) => count + 1);
      });
    },
    [items],
  );

  const markAllRead = useCallback(() => {
    if (unreadCount === 0) return;
    const previous = items;
    const readAt = new Date().toISOString();
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: readAt })));
    setUnreadCount(0);
    void markNotificationsRead().then((result) => {
      if (result.ok) return;
      setItems(previous);
      setUnreadCount(unreadCount);
    });
  }, [items, unreadCount]);

  const value = useMemo(
    () => ({ items, unreadCount, pulse, markRead, markAllRead }),
    [items, unreadCount, pulse, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications va usato dentro NotificationsProvider");
  return ctx;
}
