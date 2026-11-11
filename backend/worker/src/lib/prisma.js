import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/client/edge.js";
import { createD1Client } from "./d1-client.js";

let prisma;
let activeConnectionString;
let activeD1Client;
let activeD1Instance;

export function getPrisma(env) {
  // If Cloudflare D1 database binding is present, use ultra-fast native Edge D1
  if (env?.DB && typeof env.DB.prepare === "function") {
    if (!activeD1Client || activeD1Instance !== env.DB) {
      activeD1Client = createD1Client(env.DB);
      activeD1Instance = env.DB;
    }
    return activeD1Client;
  }

  let connectionString = env?.HYPERDRIVE?.connectionString || env?.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Configure the HYPERDRIVE binding, DATABASE_URL Worker secret, or DB binding.");
  }

  connectionString = connectionString
    .replace(/([?&])channel_binding=[^&]*(&|$)/g, (m, p1, p2) => p2 ? p1 : "")
    .replace(/\?$/, "");

  if (!prisma || activeConnectionString !== connectionString) {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    activeConnectionString = connectionString;
  }

  return prisma;
}
