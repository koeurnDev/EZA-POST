import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/client/edge.js";

let prisma;
let activeConnectionString;

export function getPrisma(env) {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Configure the HYPERDRIVE binding or DATABASE_URL Worker secret.");
  }

  if (!prisma || activeConnectionString !== connectionString) {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    activeConnectionString = connectionString;
  }

  return prisma;
}
