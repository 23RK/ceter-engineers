"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { History } from "lucide-react";
import type { EmploymentType, InspectionKind } from "@prisma/client";
import { createInspection, lookupClient } from "@/lib/actions/inspections";
import type { ActionState } from "@/lib/actions/tasks";
import {
  INSPECTION_KINDS,
  clientPriceFor,
  inspectorPayFor,
  withVat,
  type PriceTierRow,
  type RateRow,
} from "@/lib/inspections";
import { formatDateShort, formatMoney, toDateInputValue } from "@/lib/format";

export type FormSetup = {
  inspectors: { id: string; name: string; active: boolean; employmentType: EmploymentType }[];
  apartmentTypes: { id: string; name: string; active: boolean }[];
  rates: RateRow[];
  tiers: PriceTierRow[];
  vatRate: number;
};

const input =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium text-black/60 ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}

/**
 * The short add form (SPEC §4.3): client, phone, date, time, inspector,
 * property type, units, address. Price and inspector pay fill in by
 * themselves (and can be changed). A known phone shows "X בדיקות קודמות".
 */
export function InspectionForm({
  setup,
  developers,
  onDone,
}: {
  setup: FormSetup;
  developers: string[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createInspection, {});
  const [inspectorId, setInspectorId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [units, setUnits] = useState(1);
  const [kind, setKind] = useState<InspectionKind>("REGULAR");
  const [price, setPrice] = useState<string | null>(null); // null = automatic
  const [pay, setPay] = useState<string | null>(null);
  const [known, setKnown] = useState<Awaited<ReturnType<typeof lookupClient>> | null>(null);
  const [, startLookup] = useTransition();

  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  const inspector = setup.inspectors.find((i) => i.id === inspectorId) ?? null;
  const autoPrice = clientPriceFor(setup.tiers, typeId || null, kind, units);
  const autoPay = inspectorPayFor(setup.rates, inspector, typeId || null, kind, units);
  const priceValue = price ?? (autoPrice != null ? String(autoPrice) : "");
  const payValue = pay ?? (autoPay != null ? String(autoPay) : "");
  const priceNum = Number(priceValue);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="לקוח *">
          <input name="clientName" required autoFocus className={input} />
        </Field>
        <Field label="טלפון">
          <input
            name="clientPhone"
            type="tel"
            dir="ltr"
            className={`${input} text-right`}
            onBlur={(e) => {
              const phone = e.target.value;
              startLookup(async () => setKnown(phone.trim() ? await lookupClient(phone) : null));
            }}
          />
        </Field>
        {known && known.count > 0 && (
          <p className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800 sm:col-span-2">
            <History size={14} />
            לקוח חוזר: {known.count === 1 ? "בדיקה קודמת אחת" : `${known.count} בדיקות קודמות`}
            {known.name && ` (${known.name})`}
            {known.lastDate && `, האחרונה ב-${formatDateShort(known.lastDate)}`}
          </p>
        )}
        <Field label="תאריך">
          <input name="date" type="date" defaultValue={toDateInputValue(new Date())} className={input} />
        </Field>
        <Field label="שעה">
          <input name="time" type="time" className={input} />
        </Field>
        <Field label="בודק">
          <select name="inspectorId" value={inspectorId} onChange={(e) => { setInspectorId(e.target.value); setPay(null); }} className={input}>
            <option value="">עוד לא נקבע</option>
            {setup.inspectors.filter((i) => i.active).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="סוג נכס">
          <select name="apartmentTypeId" value={typeId} onChange={(e) => { setTypeId(e.target.value); setPrice(null); setPay(null); }} className={input}>
            <option value="">—</option>
            {setup.apartmentTypes.filter((t) => t.active).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="כמות דירות">
          <input
            name="unitsCount"
            type="number"
            min={1}
            value={units}
            onChange={(e) => { setUnits(Math.max(1, Number(e.target.value) || 1)); setPrice(null); setPay(null); }}
            className={input}
          />
        </Field>
        <Field label="סוג בדיקה">
          <select name="kind" value={kind} onChange={(e) => { setKind(e.target.value as InspectionKind); setPrice(null); setPay(null); }} className={input}>
            {INSPECTION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="כתובת" wide>
          <input name="address" placeholder="רחוב ומספר" className={input} />
        </Field>
        <Field label="עיר">
          <input name="city" className={input} />
        </Field>
        <Field label="יזם / קבלן">
          <input name="developerContractor" list="developers-list" className={input} />
          <datalist id="developers-list">
            {developers.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <Field label='מחיר ללקוח (₪, ללא מע"מ)'>
          <input
            name="price"
            inputMode="decimal"
            value={priceValue}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={autoPrice == null ? "לא במחירון - להזין" : ""}
            className={input}
          />
          {Number.isFinite(priceNum) && priceNum > 0 && (
            <span className="text-[11px] font-normal text-black/45">
              {formatMoney(withVat(priceNum, setup.vatRate))} כולל מע&quot;מ
              {price == null && autoPrice != null && " · מהמחירון"}
            </span>
          )}
        </Field>
        <Field label="תשלום לבודק (₪)">
          <input
            name="inspectorPay"
            inputMode="decimal"
            value={payValue}
            onChange={(e) => setPay(e.target.value)}
            placeholder={inspector && autoPay == null ? "אין תעריף - להזין" : ""}
            className={input}
          />
          {pay == null && autoPay != null && (
            <span className="text-[11px] font-normal text-black/45">
              {inspector?.employmentType === "OWNER" ? "בעלים - ללא תשלום" : "מהתעריף"}
            </span>
          )}
        </Field>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {pending ? "שומר..." : "הוספת בדיקה"}
      </button>
    </form>
  );
}
