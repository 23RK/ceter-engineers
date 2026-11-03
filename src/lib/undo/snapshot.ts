import type { Prisma, PrismaClient } from "@prisma/client";
import { decodeRow, decodeValue, encodeRow, encodeValue, type Encoded } from "@/lib/undo/codec";
import { childRelations, delegateName, primaryKey } from "@/lib/undo/models";

// A deleted row together with everything the database deletes with it
// (onDelete: Cascade), and the links it clears in other rows (SetNull), so
// that restoring puts back exactly what was there - same ids, same links.

type Db = PrismaClient | Prisma.TransactionClient;
type Row = Record<string, unknown>;

export type Snapshot = {
  /** Parents before children: the order to re-insert them in. */
  rows: { model: string; data: Record<string, Encoded> }[];
  /** Columns the delete set to NULL in rows that stay: put back on restore. */
  links: { model: string; id: string; field: string; value: Encoded }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const delegate = (db: Db, model: string) => (db as any)[delegateName(model)];

export async function collectSnapshot(db: Db, model: string, ids: string[]): Promise<Snapshot> {
  const rows: Snapshot["rows"] = [];
  const index = new Map<string, number>(); // "Model:id" -> position in rows
  const links: Snapshot["links"] = [];

  async function visit(m: string, where: Record<string, unknown>, depth: number) {
    if (depth > 8) return;
    const found: Row[] = await delegate(db, m).findMany({ where });
    if (!found.length) return;
    const pk = primaryKey(m);
    for (const row of found) {
      const key = `${m}:${String(row[pk])}`;
      // Reached again through another parent: move it after that parent.
      if (index.has(key)) rows[index.get(key)!] = { model: "", data: {} };
      index.set(key, rows.length);
      rows.push({ model: m, data: encodeRow(row) });
    }
    for (const rel of childRelations(m)) {
      const values = [...new Set(found.map((r) => r[rel.references]).filter((v) => v != null))];
      if (!values.length) continue;
      if (rel.onDelete === "Cascade") {
        await visit(rel.child, { [rel.fk]: { in: values } }, depth + 1);
      } else if (rel.onDelete === "SetNull") {
        const childPk = primaryKey(rel.child);
        const linked: Row[] = await delegate(db, rel.child).findMany({
          where: { [rel.fk]: { in: values } },
          select: { [childPk]: true, [rel.fk]: true },
        });
        for (const l of linked) {
          links.push({ model: rel.child, id: String(l[childPk]), field: rel.fk, value: encodeValue(l[rel.fk]) });
        }
      }
    }
  }

  await visit(model, { [primaryKey(model)]: { in: ids } }, 0);
  return { rows: rows.filter((r) => r.model), links };
}

/** Puts a snapshot back. Run inside a transaction: all of it, or nothing. */
export async function restoreSnapshot(
  db: Db,
  snapshot: Snapshot,
  transform?: (model: string, data: Row) => Row
): Promise<{ model: string; id: string }[]> {
  const restored: { model: string; id: string }[] = [];
  for (const { model, data } of snapshot.rows) {
    let row = decodeRow(data);
    if (transform) row = transform(model, row);
    await delegate(db, model).create({ data: row });
    restored.push({ model, id: String(row[primaryKey(model)]) });
  }
  // A link is put back only if nothing else was set there in the meantime.
  for (const link of snapshot.links) {
    const pk = primaryKey(link.model);
    await delegate(db, link.model).updateMany({
      where: { [pk]: link.id, [link.field]: null },
      data: { [link.field]: decodeValue(link.value) },
    });
  }
  return restored;
}
