"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { resetDishesFromMenu, updateBookingDishes } from "@/app/actions/bookings";
import { Alert, Button, Input, Select } from "@/components/ui";
import { COURSE_LABELS, COURSE_ORDER, type BookingDish, type Course } from "@/lib/types";
import { ConfirmAction } from "./ConfirmAction";

interface DishRow {
  key: string;
  course: Course;
  name: string;
}

let rowSeq = 0;
const nextKey = (): string => `dish-${++rowSeq}`;

const courseRank = (course: Course): number => COURSE_ORDER.indexOf(course);

function toRows(dishes: Pick<BookingDish, "course" | "name">[]): DishRow[] {
  return dishes.map((d) => ({ key: nextKey(), course: d.course, name: d.name }));
}

export interface DishesEditorProps {
  bookingId: string;
  dishes: Pick<BookingDish, "course" | "name">[];
  hasMenu: boolean;
}

/**
 * Piatti dell'evento (admin o chef). Il componente va montato con `key` legata alla versione
 * dei piatti salvati: dopo un salvataggio o un ripristino si riparte dai dati del server.
 */
export function DishesEditor({ bookingId, dishes, hasMenu }: DishesEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState<DishRow[]>(() => toRows(dishes));
  const [newCourse, setNewCourse] = useState<Course>("primo");
  const [newName, setNewName] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const sortByCourse = (list: DishRow[]): DishRow[] =>
    [...list].sort((a, b) => courseRank(a.course) - courseRank(b.course));

  const updateRow = (key: string, changes: Partial<Pick<DishRow, "course" | "name">>) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setRows((prev) => sortByCourse(prev.map((r) => (r.key === key ? { ...r, ...changes } : r))));
    setSaved(false);
  };

  // Lo spostamento avviene solo all'interno della stessa portata, così l'ordine per portata resta valido.
  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    setRows((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      if (prev[target].course !== prev[index].course) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setSaved(false);
  };

  const addRow = () => {
    const name = newName.trim();
    if (!name) {
      setError("Inserisci il nome del piatto da aggiungere.");
      return;
    }
    setError(null);
    setRows((prev) => sortByCourse([...prev, { key: nextKey(), course: newCourse, name }]));
    setNewName("");
    setSaved(false);
  };

  const save = () => {
    setError(null);
    setSaved(false);
    const errors: Record<string, string> = {};
    for (const row of rows) {
      if (!row.name.trim()) errors[row.key] = "Nome piatto obbligatorio";
    }
    setRowErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Completa o rimuovi i piatti senza nome.");
      return;
    }

    startTransition(async () => {
      const result = await updateBookingDishes(
        bookingId,
        rows.map((r, index) => ({ course: r.course, name: r.name.trim(), sort: index })),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  const canUp = (index: number) => index > 0 && rows[index - 1].course === rows[index].course;
  const canDown = (index: number) => index < rows.length - 1 && rows[index + 1].course === rows[index].course;

  return (
    <div className="flex flex-col gap-5">
      {rows.length === 0 ? (
        <p className="text-[14px] text-slate">Nessun piatto. Aggiungine uno o ripristina dal menù.</p>
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Piatti dell’evento">
          {rows.map((row, index) => {
            const rowError = rowErrors[row.key];
            return (
              <li key={row.key} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="sm:w-40 sm:shrink-0">
                  <Select
                    aria-label="Portata"
                    value={row.course}
                    onChange={(e) => updateRow(row.key, { course: e.target.value as Course })}
                  >
                    {COURSE_ORDER.map((c) => (
                      <option key={c} value={c}>
                        {COURSE_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Input
                    aria-label={`Nome piatto (${COURSE_LABELS[row.course]})`}
                    invalid={!!rowError}
                    value={row.name}
                    onChange={(e) => updateRow(row.key, { name: e.target.value })}
                  />
                  {rowError && <p className="text-[13px] text-danger">{rowError}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" aria-label="Sposta su" disabled={!canUp(index)} onClick={() => moveRow(index, -1)}>
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Sposta giù" disabled={!canDown(index)} onClick={() => moveRow(index, 1)}>
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={`Rimuovi ${row.name || "piatto"}`} onClick={() => removeRow(row.key)}>
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-col gap-2 rounded-btn border border-dashed border-slate/40 p-3 sm:flex-row">
        <div className="sm:w-40 sm:shrink-0">
          <Select aria-label="Portata del nuovo piatto" value={newCourse} onChange={(e) => setNewCourse(e.target.value as Course)}>
            {COURSE_ORDER.map((c) => (
              <option key={c} value={c}>
                {COURSE_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <Input
          aria-label="Nome del nuovo piatto"
          placeholder="Nome del piatto"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" size="md" onClick={addRow}>
          <Plus aria-hidden="true" className="size-4" />
          Aggiungi
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="md" onClick={save} disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Salvataggio…" : "Salva piatti"}
        </Button>
        {hasMenu && (
          <ConfirmAction
            label="Ripristina dal menù"
            variant="outline"
            title="Ripristinare i piatti dal menù?"
            description="I piatti attuali dell’evento verranno sostituiti con quelli del menù selezionato. Le modifiche non salvate andranno perse."
            confirmLabel="Ripristina"
            pendingLabel="Ripristino…"
            run={() => resetDishesFromMenu(bookingId)}
            onSuccess={() => router.refresh()}
          />
        )}
        {saved && (
          <span role="status" className="text-[13px] text-success">
            Piatti salvati.
          </span>
        )}
      </div>
    </div>
  );
}
