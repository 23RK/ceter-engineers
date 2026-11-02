"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import { monthLabel } from "@/lib/inspections";

type Point = { month: string; revenue: number; profit: number };

// Categorical slots 1-2 of the validated palette (light surface): blue, orange.
const SERIES = [
  { key: "revenue", label: "הכנסות", color: "#2a78d6" },
  { key: "profit", label: "רווח", color: "#eb6834" },
] as const;

const short = (n: number) =>
  Math.abs(n) >= 1000 ? `₪${Math.round(n / 100) / 10}K` : `₪${Math.round(n)}`;
const monthShort = (key: string) => `${Number(key.slice(5))}/${key.slice(2, 4)}`;

/** "nice" axis ticks for a 0-based (or negative-including) range. */
function ticks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v));
  return out;
}

/** 12-month trend: revenue vs profit (SPEC §4.3). One axis, both in ₪. */
export function TrendChart({ data }: { data: Point[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 220;
  const pad = { top: 12, right: 64, bottom: 28, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = data.flatMap((d) => [d.revenue, d.profit]);
  const yTicks = ticks(Math.min(0, ...values), Math.max(1, ...values));
  const yMin = yTicks[0];
  const yMax = yTicks.at(-1)!;
  const x = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const path = (k: "revenue" | "profit") => data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[k])}`).join("");
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const showEvery = width < 480 ? 3 : width < 720 ? 2 : 1;

  // End labels only when the two ends are clear of each other; otherwise the legend + tooltip carry it.
  const last = data.at(-1)!;
  const endsApart = Math.abs(y(last.revenue) - y(last.profit)) >= 14;
  const h = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs text-black/60" aria-hidden={asTable}>
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <button type="button" onClick={() => setAsTable((t) => !t)} className="text-xs font-medium text-brand-600 hover:underline">
          {asTable ? "הצג כגרף" : "הצג כטבלה"}
        </button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-black/45">
              <tr>
                <th className="py-1.5 text-right font-medium">חודש</th>
                <th className="py-1.5 text-right font-medium">הכנסות</th>
                <th className="py-1.5 text-right font-medium">רווח</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {data.map((d) => (
                <tr key={d.month}>
                  <td className="py-1.5 text-black/60">{monthLabel(d.month)}</td>
                  <td className="py-1.5 font-medium text-brand-900">{formatMoney(d.revenue)}</td>
                  <td className="py-1.5 font-medium text-brand-900">{formatMoney(d.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={box} className="relative" dir="ltr">
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`הכנסות ורווח ב-12 החודשים האחרונים. בחודש האחרון: הכנסות ${formatMoney(last.revenue)}, רווח ${formatMoney(last.profit)}.`}
            onMouseLeave={() => setHover(null)}
          >
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#d4d4d0" : "#ececea"} strokeWidth={1} />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#52514e">
                  {short(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % showEvery === (data.length - 1) % showEvery ? (
                <text key={d.month} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="#52514e">
                  {monthShort(d.month)}
                </text>
              ) : null
            )}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="#b9b8b2" strokeWidth={1} />}
            {SERIES.map((s) => (
              <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {h &&
              SERIES.map((s) => (
                <circle key={s.key} cx={x(hover!)} cy={y(h[s.key])} r={4.5} fill={s.color} stroke="#ffffff" strokeWidth={2} />
              ))}
            {endsApart &&
              SERIES.map((s) => (
                <text key={s.key} x={x(data.length - 1) + 8} y={y(last[s.key])} dy="0.32em" fontSize={11} fill="#0b0b0b">
                  {short(last[s.key])}
                </text>
              ))}
            {/* Hit targets: one full-height column per month, wider than the marks. */}
            {data.map((d, i) => (
              <rect
                key={d.month}
                x={x(i) - step / 2}
                y={pad.top}
                width={step}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              />
            ))}
          </svg>
          {h && (
            <div
              dir="rtl"
              className="pointer-events-none absolute top-1 z-10 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg"
              style={x(hover!) > width / 2 ? { right: width - x(hover!) + 12 } : { left: x(hover!) + 12 }}
            >
              <p className="mb-1 font-semibold text-brand-900">{monthLabel(h.month)}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="flex items-center gap-1.5 text-black/70">
                  <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}: <span className="font-semibold text-brand-900">{formatMoney(h[s.key])}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
