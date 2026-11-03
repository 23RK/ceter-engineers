import { basePrisma } from "@/lib/prisma-base";
import { undoTracking } from "@/lib/undo/extension";

// The client the whole app uses. Inside withUndo() (src/lib/undo/undo.ts)
// every write is recorded for "בטל", and deletes go to the recycle bin.
// Outside it, it behaves exactly like a plain PrismaClient.
export const prisma = basePrisma.$extends(undoTracking(basePrisma));
