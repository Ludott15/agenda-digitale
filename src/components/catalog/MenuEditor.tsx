"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { upsertMenu } from "@/app/actions/catalog";
import { Alert, Button, Checkbox, Field, Input, Select } from "@/components/ui";
import { COURSE_LABELS, COURSE_ORDER, type Course, type Menu } from "@/lib/types";

interface DraftItem {
  key: number;
  course: Course;
  name: string;
  sort: string;
}

export interface MenuEditorProps {
  menu: Menu | null;
  onSaved: (message: string) => void;
  onCancel: () => void;
}

type ErrorMap = Record<string, string>;

/** Converte fieldErrors Zod (chiavi tipo "items.2.name") in messaggi per campo. */
function toErrorMap(raw: Record<string, string[]> | undefined): ErrorMap {
  const out: ErrorMap = {};
  for (const [key, messages] of Object.entries(raw ?? {})) {
    if (messages[0]) out[key] = messages[0];
  }
  return out;
}

/** Editor di un menù: dati generali e righe dei piatti per portata. */
export function MenuEditor({ menu, onSaved, onCancel }: MenuEditorProps) {
  const [pending, startTransition] = useTransition();
  const nextKey = useRef(0);
  const newKey = () => {
    nextKey.current += 1;
    return nextKey.current;
  };

  const [items, setItems] = useState<DraftItem[]>(() =>
    (menu?.items ?? []).map((item) => ({
      key: newKey(),
      course: item.course,
      name: item.name,
      sort: String(item.sort),
    })),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ErrorMap>({});

  const fieldId = (name: string) => (menu ? `menu-${menu.id}-${name}` : `menu-new-${name}`);

  function updateItem(key: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: newKey(), course: "primo", name: "", sort: String(prev.length) },
    ]);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      id: menu?.id,
      name: String(form.get("name") ?? ""),
      season: String(form.get("season") ?? ""),
      price_per_person: String(form.get("price_per_person") ?? ""),
      is_kids: form.get("is_kids") === "on",
      active: form.get("active") === "on",
      sort: String(form.get("sort") ?? "0"),
      items: items.map((item) => ({
        course: item.course,
        name: item.name,
        sort: item.sort,
      })),
    };

    setFormError(null);
    setErrors({});

    startTransition(async () => {
      const result = await upsertMenu(input);
      if (!result.ok) {
        setFormError(result.error);
        setErrors(toErrorMap(result.fieldErrors));
        return;
      }
      onSaved(`Menù "${input.name.trim()}" salvato.`);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label={menu ? "Modifica menù" : "Nuovo menù"} className="flex flex-col">
      <div className="flex max-h-[62dvh] flex-col gap-6 overflow-y-auto pr-1">
        {formError && <Alert tone="danger">{formError}</Alert>}
        {errors._form && <Alert tone="danger">{errors._form}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome del menù" htmlFor={fieldId("name")} required error={errors.name} className="sm:col-span-2">
            <Input
              id={fieldId("name")}
              name="name"
              defaultValue={menu?.name ?? ""}
              required
              invalid={!!errors.name}
            />
          </Field>
          <Field label="Stagione" htmlFor={fieldId("season")} error={errors.season}>
            <Input
              id={fieldId("season")}
              name="season"
              defaultValue={menu?.season ?? ""}
              placeholder="Es. Autunno 2026"
              invalid={!!errors.season}
            />
          </Field>
          <Field label="Prezzo a persona (€)" htmlFor={fieldId("price")} required error={errors.price_per_person}>
            <Input
              id={fieldId("price")}
              name="price_per_person"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              defaultValue={menu ? String(menu.price_per_person) : ""}
              required
              invalid={!!errors.price_per_person}
            />
          </Field>
          <Field label="Ordine in elenco" htmlFor={fieldId("sort")} error={errors.sort}>
            <Input
              id={fieldId("sort")}
              name="sort"
              type="number"
              min={0}
              step={1}
              defaultValue={String(menu?.sort ?? 0)}
              invalid={!!errors.sort}
            />
          </Field>
          <div className="flex flex-col justify-end gap-3">
            <Checkbox id={fieldId("is_kids")} name="is_kids" defaultChecked={menu?.is_kids ?? false} label="Menù bambini" />
            <Checkbox id={fieldId("active")} name="active" defaultChecked={menu?.active ?? true} label="Menù attivo" />
          </div>
        </div>

        <fieldset className="flex flex-col gap-4 border-t border-sand pt-5">
          <legend className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-slate-dark">
            Piatti per portata
          </legend>

          {items.length === 0 && (
            <p className="text-[14px] text-slate-dark">Nessun piatto. Aggiungi le portate del menù.</p>
          )}

          {items.map((item, index) => {
            const rowId = `item-${item.key}`;
            const nameError = errors[`items.${index}.name`];
            const sortError = errors[`items.${index}.sort`];
            const courseError = errors[`items.${index}.course`];
            return (
              <div key={item.key} className="flex flex-col gap-3 border-l-[3px] border-sand bg-paper py-1 pl-4">
                <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3 sm:grid-cols-[11rem_minmax(0,1fr)_5.5rem]">
                  <Field label="Portata" htmlFor={`${rowId}-course`} error={courseError} className="col-span-1">
                    <Select
                      id={`${rowId}-course`}
                      value={item.course}
                      onChange={(e) => updateItem(item.key, { course: e.target.value as Course })}
                      invalid={!!courseError}
                    >
                      {COURSE_ORDER.map((course) => (
                        <option key={course} value={course}>
                          {COURSE_LABELS[course]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Piatto" htmlFor={`${rowId}-name`} error={nameError} className="col-span-2 sm:col-span-1">
                    <Input
                      id={`${rowId}-name`}
                      value={item.name}
                      onChange={(e) => updateItem(item.key, { name: e.target.value })}
                      invalid={!!nameError}
                    />
                  </Field>
                  <Field label="Ordine" htmlFor={`${rowId}-sort`} error={sortError}>
                    <Input
                      id={`${rowId}-sort`}
                      type="number"
                      min={0}
                      step={1}
                      value={item.sort}
                      onChange={(e) => updateItem(item.key, { sort: e.target.value })}
                      invalid={!!sortError}
                    />
                  </Field>
                </div>
                <div>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(item.key)} aria-label={`Rimuovi piatto ${index + 1}`}>
                    Rimuovi piatto
                  </Button>
                </div>
              </div>
            );
          })}

          <div>
            <Button variant="outline" size="sm" onClick={addItem}>
              Aggiungi piatto
            </Button>
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-sand pt-5">
        <Button variant="ghost" size="md" onClick={onCancel} disabled={pending}>
          Annulla
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Salvataggio…" : "Salva menù"}
        </Button>
      </div>
    </form>
  );
}
