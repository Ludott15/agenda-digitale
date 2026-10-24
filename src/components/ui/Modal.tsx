"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Dialog nativo (focus trap, Esc, inert del resto della pagina gestiti dal browser). */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[min(92vw,32rem)] rounded-[2px] border border-sand bg-paper p-0 text-ink shadow-2xl shadow-ink/30 backdrop:bg-ink/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-sand px-6 py-4">
        <h2 id={titleId} className="text-2xl">
          {title}
        </h2>
        <Button variant="ghost" size="sm" aria-label="Chiudi" onClick={onClose} className="-mr-2">
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-3 border-t border-sand px-6 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
