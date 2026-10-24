"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMenu, upsertMenu } from "@/app/actions/catalog";
import { Alert, Badge, Button, EmptyState, Modal } from "@/components/ui";
import { formatEUR } from "@/lib/quote-utils";
import { COURSE_LABELS, COURSE_ORDER, type Menu } from "@/lib/types";
import { MenuEditor } from "./MenuEditor";

export interface MenusPanelProps {
  menus: Menu[];
}

/** Elenco menù con editor (crea/modifica) e disattivazione. */
export function MenusPanel({ menus }: MenusPanelProps) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Menu | null>(null);
  const [confirmMenu, setConfirmMenu] = useState<Menu | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(menu: Menu) {
    setEditing(menu);
    setEditorOpen(true);
  }

  function handleSaved(message: string) {
    setEditorOpen(false);
    setNotice({ tone: "success", text: message });
    router.refresh();
  }

  function handleDeactivate() {
    const menu = confirmMenu;
    if (!menu) return;
    startTransition(async () => {
      const result = await deleteMenu(menu.id);
      setConfirmMenu(null);
      if (!result.ok) {
        setNotice({ tone: "danger", text: result.error });
        return;
      }
      setNotice({
        tone: "success",
        text: `Menù "${menu.name}" disattivato.`,
      });
      router.refresh();
    });
  }

  function handleReactivate(menu: Menu) {
    startTransition(async () => {
      const result = await upsertMenu({
        id: menu.id,
        name: menu.name,
        season: menu.season ?? "",
        price_per_person: menu.price_per_person,
        is_kids: menu.is_kids,
        active: true,
        sort: menu.sort,
        items: menu.items.map((item) => ({ course: item.course, name: item.name, sort: item.sort })),
      });
      if (!result.ok) {
        setNotice({ tone: "danger", text: result.error });
        return;
      }
      setNotice({ tone: "success", text: `Menù "${menu.name}" riattivato.` });
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="menu-titolo" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Banchetti</p>
          <h2 id="menu-titolo" className="text-2xl">
            Menù ({menus.length})
          </h2>
        </div>
        <Button variant="primary" size="md" onClick={openNew}>
          Nuovo menù
        </Button>
      </div>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {menus.length === 0 ? (
        <EmptyState
          title="Nessun menù in catalogo"
          description="Crea il primo menù: indica il prezzo per persona e i piatti per portata."
          action={
            <Button variant="outline" size="md" onClick={openNew}>
              Crea menù
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {menus.map((menu) => (
            <MenuCard
              key={menu.id}
              menu={menu}
              busy={pending}
              onEdit={() => openEdit(menu)}
              onDeactivate={() => setConfirmMenu(menu)}
              onReactivate={() => handleReactivate(menu)}
            />
          ))}
        </ul>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? "Modifica menù" : "Nuovo menù"}
      >
        {editorOpen && (
          <MenuEditor
            menu={editing}
            onSaved={handleSaved}
            onCancel={() => setEditorOpen(false)}
          />
        )}
      </Modal>

      <Modal
        open={confirmMenu !== null}
        onClose={() => setConfirmMenu(null)}
        title="Disattivare il menù?"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setConfirmMenu(null)} disabled={pending}>
              Annulla
            </Button>
            <Button variant="danger" size="md" onClick={handleDeactivate} disabled={pending} aria-busy={pending || undefined}>
              {pending ? "Disattivazione…" : "Disattiva"}
            </Button>
          </>
        }
      >
        {confirmMenu && (
          <p className="text-[15px] leading-relaxed">
            Il menù <strong className="font-medium">{confirmMenu.name}</strong> verrà disattivato e non sarà più
            proposto per le nuove prenotazioni. Resta comunque collegato alle prenotazioni esistenti e può essere
            riattivato in qualsiasi momento.
          </p>
        )}
      </Modal>
    </section>
  );
}

function MenuCard({
  menu,
  busy,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  menu: Menu;
  busy: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const groups = COURSE_ORDER.map((course) => ({
    course,
    items: menu.items.filter((item) => item.course === course),
  })).filter((group) => group.items.length > 0);

  return (
    <li
      className={
        "flex flex-col gap-5 border border-sand border-t-[3px] bg-paper p-5 shadow-sm shadow-ink/5 " +
        (menu.active ? "border-t-petrol" : "border-t-disabled opacity-80")
      }
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {menu.season && (
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">{menu.season}</p>
            )}
            <h3 className="font-serif text-2xl leading-tight">{menu.name}</h3>
          </div>
          <p className="text-right">
            <span className="font-serif text-2xl tabular-nums text-ink">{formatEUR(menu.price_per_person)}</span>
            <span className="block text-[12px] text-slate-dark">a persona</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {menu.is_kids && <Badge tone="bronze">Bambini</Badge>}
          {!menu.active && <Badge tone="neutral">Inattivo</Badge>}
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="text-[14px] text-slate-dark">Nessun piatto inserito.</p>
      ) : (
        <dl className="flex flex-col gap-3 border-t border-sand pt-4">
          {groups.map((group) => (
            <div key={group.course}>
              <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">
                {COURSE_LABELS[group.course]}
              </dt>
              <dd>
                <ul className="text-[14px] leading-snug text-ink">
                  {group.items.map((item) => (
                    <li key={item.id}>{item.name}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-auto flex flex-wrap gap-2 border-t border-sand pt-4">
        <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}>
          Modifica
        </Button>
        {menu.active ? (
          <Button variant="ghost" size="sm" onClick={onDeactivate} disabled={busy}>
            Disattiva
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onReactivate} disabled={busy}>
            Riattiva
          </Button>
        )}
      </div>
    </li>
  );
}
