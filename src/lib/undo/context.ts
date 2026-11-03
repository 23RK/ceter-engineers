import { AsyncLocalStorage } from "node:async_hooks";
import type { Encoded } from "@/lib/undo/codec";

// The action currently being recorded (one per request / Server Action).

export type UndoOp =
  | { t: "create"; model: string; id: string }
  | { t: "update"; model: string; id: string; before: Record<string, Encoded>; after: Record<string, Encoded> }
  | { t: "trash"; trashId: string };

export type UndoContext = {
  userId: string | null;
  ops: UndoOp[];
  /** Set when the action finished; later writes (e.g. in after()) aren't recorded. */
  closed: boolean;
};

export const undoStore = new AsyncLocalStorage<UndoContext | null>();

export function activeContext(): UndoContext | null {
  const ctx = undoStore.getStore();
  return ctx && !ctx.closed ? ctx : null;
}
