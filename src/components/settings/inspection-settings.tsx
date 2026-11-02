"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import type { EmploymentType, InspectionKind } from "@prisma/client";
import { Modal } from "@/components/ui/modal";
import {
  createApartmentType,
  deleteRate,
  moveApartmentType,
  saveInspector,
  saveRate,
  saveVatRate,
  setPriceTier,
  updateApartmentType,
} from "@/lib/actions/inspection-settings";
import type { ActionState } from "@/lib/actions/tasks";
import { EMPLOYMENT_TYPES, INSPECTION_KINDS, employmentLabel, kindLabel } from "@/lib/inspections";
import { formatMoney } from "@/lib/format";

type Inspector = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  employmentType: EmploymentType;
  phone: string | null;
  email: string | null;
};
type AptType = { id: string; name: string; order: number; active: boolean };
type Rate = {
  id: string;
  inspectorId: string;
  apartmentTypeId: string | null;
  kind: InspectionKind;
  rate: number;
  multiUnitRate: number | null;
};
type Tier = { id: string; apartmentTypeId: string; minUnits: number; unitPrice: number };

const card = "rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5";
const input =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
const iconBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black/35 transition hover:bg-black/5 hover:text-brand-700 disabled:opacity-25";

/** Saves in the background and shows an error if it fails. */
function useSave() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (fn: () => Promise<ActionState>) =>
    start(async () => {
      setError(null);
      try {
        const res = await fn();
        if (res.error) setError(res.error);
      } catch {
        setError("השינוי לא נשמר. נסו שוב.");
      }
    });
  return { pending, error, save };
}

function Section({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={card}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-brand-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-black/50">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function InspectionSettings({
  inspectors,
  apartmentTypes,
  rates,
  tiers,
  vatRate,
}: {
  inspectors: Inspector[];
  apartmentTypes: AptType[];
  rates: Rate[];
  tiers: Tier[];
  vatRate: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
        שינוי בתעריפים או במחירון חל רק על בדיקות חדשות. בדיקות קיימות שומרות את הסכומים שנשמרו בהן. כל הסכומים ללא מע&quot;מ.
      </p>
      <Inspectors inspectors={inspectors} />
      <ApartmentTypes types={apartmentTypes} />
      <PriceList types={apartmentTypes.filter((t) => t.active)} tiers={tiers} />
      <Rates inspectors={inspectors} types={apartmentTypes} rates={rates} />
      <VatForm vatRate={vatRate} />
    </div>
  );
}

// --- בודקים -----------------------------------------------------------------

function Inspectors({ inspectors }: { inspectors: Inspector[] }) {
  return (
    <Section
      title="בודקים"
      hint="בעלים (רון וגיא) לא מקבלים תשלום לבודק ולא מופיעים כחוב."
      action={
        <Modal
          title="בודק חדש"
          trigger={
            <button className="flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 px-3 text-sm font-medium text-brand-900 hover:bg-black/5">
              <Plus size={15} />
              בודק
            </button>
          }
        >
          {(close) => <InspectorForm onDone={close} />}
        </Modal>
      }
    >
      <ul className="divide-y divide-black/5">
        {inspectors.map((i) => (
          <li key={i.id} className={`flex items-center gap-3 py-2.5 ${i.active ? "" : "opacity-50"}`}>
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: i.color }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-brand-900">
                {i.name}
                {!i.active && <span className="mr-2 text-xs font-normal text-black/50">(לא פעיל)</span>}
              </p>
              <p className="truncate text-xs text-black/45">
                {[employmentLabel(i.employmentType), i.phone, i.email].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Modal
              title={`עריכת ${i.name}`}
              trigger={
                <button className={iconBtn} aria-label={`עריכת ${i.name}`}>
                  <Pencil size={15} />
                </button>
              }
            >
              {(close) => <InspectorForm inspector={i} onDone={close} />}
            </Modal>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function InspectorForm({ inspector, onDone }: { inspector?: Inspector; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveInspector.bind(null, inspector?.id ?? null),
    {}
  );
  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60 sm:col-span-2">
          שם *
          <input name="name" required defaultValue={inspector?.name} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          טלפון
          <input name="phone" type="tel" dir="ltr" defaultValue={inspector?.phone ?? ""} className={`${input} text-right`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          אימייל
          <input name="email" type="email" dir="ltr" defaultValue={inspector?.email ?? ""} className={`${input} text-right`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          סוג העסקה
          <select name="employmentType" defaultValue={inspector?.employmentType ?? "FREELANCER"} className={input}>
            {EMPLOYMENT_TYPES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          צבע (ביומן ובלוח)
          <input name="color" type="color" defaultValue={inspector?.color ?? "#64748b"} className="h-10 w-full rounded-lg border border-black/10 bg-white px-1" />
        </label>
      </div>
      {inspector && (
        <label className="flex items-center gap-2 text-sm text-brand-900">
          <input type="checkbox" name="active" defaultChecked={inspector.active} className="h-4 w-4 accent-brand-600" />
          פעיל (בודק לא פעיל לא מופיע בבחירת בודק לבדיקה חדשה)
        </label>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {pending ? "שומר..." : "שמירה"}
      </button>
    </form>
  );
}

// --- סוגי נכס ---------------------------------------------------------------

function ApartmentTypes({ types }: { types: AptType[] }) {
  const { pending, error, save } = useSave();
  const [name, setName] = useState("");
  return (
    <Section title="סוגי נכס" hint="סוג נכס שכבר בשימוש לא נמחק. אפשר להפוך אותו ללא פעיל.">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <ul className={`divide-y divide-black/5 ${pending ? "opacity-60" : ""}`}>
        {types.map((t, i) => (
          <TypeRow key={t.id} type={t} first={i === 0} last={i === types.length - 1} save={save} />
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          save(() => createApartmentType(name));
          setName("");
        }}
        className="mt-3 flex gap-2"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="סוג נכס חדש" aria-label="סוג נכס חדש" className={input} />
        <button type="submit" className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus size={15} />
          הוספה
        </button>
      </form>
    </Section>
  );
}

function TypeRow({
  type,
  first,
  last,
  save,
}: {
  type: AptType;
  first: boolean;
  last: boolean;
  save: (fn: () => Promise<ActionState>) => void;
}) {
  const [name, setName] = useState(type.name);
  return (
    <li className={`flex items-center gap-2 py-1.5 ${type.active ? "" : "opacity-50"}`}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== type.name && save(() => updateApartmentType(type.id, { name }))}
        aria-label="שם סוג הנכס"
        className="min-h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none hover:bg-black/[0.03] focus:border-brand-400 focus:bg-white"
      />
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-black/55">
        <input
          type="checkbox"
          checked={type.active}
          onChange={(e) => save(() => updateApartmentType(type.id, { active: e.target.checked }))}
          className="accent-brand-600"
        />
        פעיל
      </label>
      <button type="button" disabled={first} onClick={() => save(() => moveApartmentType(type.id, "up"))} className={iconBtn} aria-label="הזזה למעלה">
        <ChevronUp size={16} />
      </button>
      <button type="button" disabled={last} onClick={() => save(() => moveApartmentType(type.id, "down"))} className={iconBtn} aria-label="הזזה למטה">
        <ChevronDown size={16} />
      </button>
    </li>
  );
}

// --- מחירון ------------------------------------------------------------------

/** The quantity tiers (SPEC §4.2 example: 1, 2–3, 4+). */
const TIERS = [
  { minUnits: 1, label: "דירה אחת" },
  { minUnits: 2, label: "2–3 דירות" },
  { minUnits: 4, label: "4 דירות ומעלה" },
];

function PriceList({ types, tiers }: { types: AptType[]; tiers: Tier[] }) {
  const { error, save } = useSave();
  const empty = tiers.length === 0;
  return (
    <Section
      title="מחירון ללקוח"
      hint="מחיר ליחידה, ללא מע״מ. בהזמנה של כמה דירות נלקח מחיר המדרגה ומוכפל בכמות. תא ריק = המחיר יוזן ידנית בבדיקה. מדרגה 2–3 או 4+ ריקה = נלקח מחיר המדרגה הקודמת."
    >
      {empty && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          המחירון ריק. עד שימולא, המחיר בכל בדיקה חדשה יוזן ידנית.
        </p>
      )}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-xs text-black/45">
              <th className="py-2 text-right font-medium">סוג נכס</th>
              {TIERS.map((t) => (
                <th key={t.minUnits} className="py-2 text-right font-medium">
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {types.map((type) => (
              <tr key={type.id}>
                <td className="py-1.5 pl-2 font-medium text-brand-900">{type.name}</td>
                {TIERS.map((t) => {
                  const tier = tiers.find((x) => x.apartmentTypeId === type.id && x.minUnits === t.minUnits);
                  return (
                    <td key={t.minUnits} className="py-1.5 pl-2">
                      <PriceCell
                        value={tier?.unitPrice ?? null}
                        label={`${type.name}, ${t.label}`}
                        onSave={(v) => save(() => setPriceTier(type.id, t.minUnits, v))}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function PriceCell({ value, label, onSave }: { value: number | null; label: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value != null ? String(value) : "");
  return (
    <input
      value={v}
      inputMode="decimal"
      placeholder="—"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (value != null ? String(value) : "") && onSave(v)}
      aria-label={`מחיר: ${label}`}
      className="min-h-9 w-24 rounded-lg border border-black/10 bg-white px-2 text-sm outline-none focus:border-brand-500"
    />
  );
}

// --- תעריפים ------------------------------------------------------------------

function Rates({ inspectors, types, rates }: { inspectors: Inspector[]; types: AptType[]; rates: Rate[] }) {
  const { error, save } = useSave();
  const typeName = (id: string | null) => (id ? types.find((t) => t.id === id)?.name ?? "—" : "כל הסוגים");
  const paid = inspectors.filter((i) => i.employmentType !== "OWNER");
  return (
    <Section
      title="תעריפי בודקים"
      hint="ללא מע״מ. שורה של 'כל הסוגים' חלה על כל סוג נכס שאין לו שורה משלו. 'ליחידה בכמה דירות' = התעריף המופחת כשיש כמה דירות באותו ביקור. בלי תעריף מתאים, התשלום לבודק יוזן ידנית."
    >
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-4">
        {paid.map((ins) => {
          const mine = rates.filter((r) => r.inspectorId === ins.id);
          return (
            <div key={ins.id} className={ins.active ? "" : "opacity-50"}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-900">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: ins.color }} />
                  {ins.name}
                </p>
                <Modal
                  title={`תעריף חדש: ${ins.name}`}
                  trigger={
                    <button className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-brand-600 hover:bg-brand-50">
                      <Plus size={14} />
                      תעריף
                    </button>
                  }
                >
                  {(close) => <RateForm inspectorId={ins.id} types={types} onDone={close} />}
                </Modal>
              </div>
              {mine.length === 0 ? (
                <p className="text-xs text-black/40">אין תעריפים. התשלום לבודק יוזן ידנית.</p>
              ) : (
                <ul className="divide-y divide-black/5 rounded-xl border border-black/5">
                  {mine.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        {typeName(r.apartmentTypeId)} · {kindLabel(r.kind)}
                      </span>
                      <span className="font-semibold text-brand-900">{formatMoney(r.rate)}</span>
                      {r.multiUnitRate != null && (
                        <span className="text-xs text-black/50">({formatMoney(r.multiUnitRate)} ליחידה בכמה דירות)</span>
                      )}
                      <Modal
                        title={`עריכת תעריף: ${ins.name}`}
                        trigger={
                          <button className={iconBtn} aria-label="עריכת תעריף">
                            <Pencil size={14} />
                          </button>
                        }
                      >
                        {(close) => <RateForm inspectorId={ins.id} types={types} rate={r} onDone={close} />}
                      </Modal>
                      <button
                        type="button"
                        onClick={() => confirm("למחוק את התעריף? בדיקות קיימות לא ישתנו.") && save(() => deleteRate(r.id))}
                        className={`${iconBtn} hover:bg-red-50 hover:text-red-600`}
                        aria-label="מחיקת תעריף"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function RateForm({ inspectorId, types, rate, onDone }: { inspectorId: string; types: AptType[]; rate?: Rate; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRate.bind(null, rate?.id ?? null), {});
  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="inspectorId" value={inspectorId} />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          סוג נכס
          <select name="apartmentTypeId" defaultValue={rate?.apartmentTypeId ?? ""} className={input}>
            <option value="">כל הסוגים</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          סוג בדיקה
          <select name="kind" defaultValue={rate?.kind ?? "REGULAR"} className={input}>
            {INSPECTION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          תעריף (₪)
          <input name="rate" required inputMode="decimal" defaultValue={rate?.rate ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          ליחידה בכמה דירות (₪)
          <input name="multiUnitRate" inputMode="decimal" defaultValue={rate?.multiUnitRate ?? ""} placeholder="לא חובה" className={input} />
        </label>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {pending ? "שומר..." : "שמירה"}
      </button>
    </form>
  );
}

// --- מע"מ --------------------------------------------------------------------

function VatForm({ vatRate }: { vatRate: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveVatRate, {});
  return (
    <Section title='שיעור מע"מ' hint='כל הסכומים נשמרים ללא מע"מ. המערכת מציגה גם סכום כולל מע"מ לפי השיעור הזה.'>
      <form action={action} className="flex items-center gap-2">
        <input name="vatRate" inputMode="decimal" defaultValue={vatRate} aria-label='שיעור מע"מ באחוזים' className="min-h-10 w-24 rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-brand-500" />
        <span className="text-sm text-black/50">%</span>
        <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          שמירה
        </button>
        {state.ok && !pending && <span className="text-sm text-green-700">נשמר</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </form>
    </Section>
  );
}
