"use client";

import { useState } from "react";

/** Inline editors for the inspections board (SPEC §4.3: edit directly in the table). */

const base =
  "min-h-9 w-full rounded-md border border-transparent bg-transparent px-1.5 text-sm text-brand-900 outline-none transition hover:bg-black/[0.04] focus:border-brand-400 focus:bg-white";

/** Text saved on blur or Enter; Escape cancels. */
export function TextCell({
  value,
  onSave,
  label,
  placeholder,
  className = "",
  dir,
  list,
  type = "text",
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  label: string;
  placeholder?: string;
  className?: string;
  dir?: "ltr" | "rtl";
  list?: string;
  type?: string;
}) {
  const [v, setV] = useState(value ?? "");
  const [prev, setPrev] = useState(value);
  // Follow outside changes (e.g. the server's version after saving).
  if (prev !== value) {
    setPrev(value);
    setV(value ?? "");
  }
  const commit = () => {
    const trimmed = v.trim();
    if (trimmed !== (value ?? "")) onSave(trimmed || null);
  };
  return (
    <input
      type={type}
      value={v}
      dir={dir}
      list={list}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(value ?? "");
      }}
      className={`${base} ${dir === "ltr" ? "text-right" : ""} ${className}`}
    />
  );
}

/** A number (₪ amounts, units). Empty = null. */
export function NumberCell({
  value,
  onSave,
  label,
  className = "",
  min = 0,
  integer = false,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  label: string;
  className?: string;
  min?: number;
  integer?: boolean;
}) {
  const str = value == null ? "" : String(value);
  const [v, setV] = useState(str);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setV(str);
  }
  const commit = () => {
    const cleaned = v.replace(/[,₪\s]/g, "");
    if (cleaned === str) return;
    if (!cleaned) return onSave(null);
    let n = Number(cleaned);
    if (!Number.isFinite(n) || n < min) return setV(str);
    if (integer) n = Math.round(n);
    onSave(n);
  };
  return (
    <input
      value={v}
      inputMode="decimal"
      aria-label={label}
      placeholder="—"
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`${base} ${className}`}
    />
  );
}

export function SelectCell<T extends string>({
  value,
  options,
  onSave,
  label,
  className = "",
  empty,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onSave: (v: T | null) => void;
  label: string;
  className?: string;
  /** Label of the empty option; omit to require a value. */
  empty?: string;
}) {
  return (
    <select
      value={value ?? ""}
      aria-label={label}
      onChange={(e) => onSave((e.target.value || null) as T | null)}
      className={`${base} cursor-pointer ${className}`}
    >
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckCell({
  checked,
  onSave,
  label,
  text,
  tone = "brand",
}: {
  checked: boolean;
  onSave: (v: boolean) => void;
  label: string;
  text?: string;
  tone?: "brand" | "green" | "purple";
}) {
  const on = { brand: "bg-brand-50 text-brand-700", green: "bg-green-100 text-green-800", purple: "bg-purple-100 text-purple-800" }[tone];
  return (
    <label
      className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap ${
        checked ? on : "text-black/45 hover:bg-black/[0.04]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onSave(e.target.checked)}
        className="accent-brand-600"
      />
      {text}
    </label>
  );
}
