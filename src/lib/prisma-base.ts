import { PrismaClient } from "@prisma/client";

// The plain client, without the undo / recycle-bin tracking. Only the undo
// machinery (src/lib/undo/) uses it directly, so its own reads and writes
// are never recorded. Everything else imports `prisma` from "@/lib/prisma".

const globalForPrisma = globalThis as unknown as {
  basePrisma: PrismaClient | undefined;
};

export const basePrisma = globalForPrisma.basePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.basePrisma = basePrisma;
