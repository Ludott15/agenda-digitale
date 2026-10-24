"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode, type TouchEvent } from "react";

const SWIPE_THRESHOLD_PX = 50;

export interface SwipeDayProps {
  /** Giorno precedente (swipe verso destra). */
  prevHref: string;
  /** Giorno successivo (swipe verso sinistra). */
  nextHref: string;
  children: ReactNode;
}

/**
 * Wrapper della lista del giorno (mobile): uno swipe orizzontale naviga al giorno
 * precedente/successivo. Gli swipe prevalentemente verticali (scroll) vengono ignorati.
 */
export function SwipeDay({ prevHref, nextHref, children }: SwipeDayProps) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const origin = start.current;
    start.current = null;
    const touch = event.changedTouches[0];
    if (!origin || !touch) return;

    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;

    router.push(dx < 0 ? nextHref : prevHref);
  };

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="touch-pan-y">
      {children}
    </div>
  );
}
