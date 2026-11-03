// Row values <-> JSON, for undo records and recycle-bin snapshots. Dates and
// file bytes don't survive JSON on their own. Plain module (unit-tested).

export type Encoded = string | number | boolean | null | { $d: string } | { $b: string };

export function encodeValue(v: unknown): Encoded {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return { $d: v.toISOString() };
  if (v instanceof Uint8Array) return { $b: Buffer.from(v).toString("base64") };
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  // No other column types are used in the tracked models.
  return JSON.parse(JSON.stringify(v));
}

export function decodeValue(v: unknown): unknown {
  if (v && typeof v === "object") {
    if ("$d" in v && typeof (v as { $d: unknown }).$d === "string") return new Date((v as { $d: string }).$d);
    if ("$b" in v && typeof (v as { $b: unknown }).$b === "string") return Buffer.from((v as { $b: string }).$b, "base64");
  }
  return v;
}

export function encodeRow(row: Record<string, unknown>): Record<string, Encoded> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, encodeValue(v)]));
}

export function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, decodeValue(v)]));
}

export function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(encodeValue(a)) === JSON.stringify(encodeValue(b));
}

/**
 * The fields an update changed: before vs. after, ignoring bookkeeping
 * fields. `after` holds only the fields that are known after the update.
 */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignore: ReadonlySet<string>
): { before: Record<string, Encoded>; after: Record<string, Encoded> } | null {
  const b: Record<string, Encoded> = {};
  const a: Record<string, Encoded> = {};
  for (const [k, v] of Object.entries(after)) {
    if (ignore.has(k) || !(k in before)) continue;
    if (sameValue(before[k], v)) continue;
    b[k] = encodeValue(before[k]);
    a[k] = encodeValue(v);
  }
  return Object.keys(b).length ? { before: b, after: a } : null;
}

/** The plain values written by an update's `data` (relation and arithmetic operations are skipped). */
export function plainData(data: Record<string, unknown> | undefined, scalarFields: ReadonlySet<string>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (!scalarFields.has(k)) continue;
    if (v === null || v instanceof Date || typeof v !== "object") out[k] = v;
    else if (typeof v === "object" && "set" in (v as object)) out[k] = (v as { set: unknown }).set;
  }
  return out;
}
