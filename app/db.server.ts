import "dotenv/config";
import { PrismaClient } from "@prisma/client";

declare global {
  var __confirmoPrisma: PrismaClient | undefined;
}

const prisma = globalThis.__confirmoPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__confirmoPrisma = prisma;
}

export default prisma;
