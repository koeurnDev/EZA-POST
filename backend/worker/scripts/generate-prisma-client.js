import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceSchemaPath = path.resolve(workerRoot, "..", "prisma", "schema.prisma");
const temporarySchemaDirectory = path.join(workerRoot, ".prisma");
const temporarySchemaPath = path.join(temporarySchemaDirectory, "schema.prisma");
const prismaCliPath = path.join(workerRoot, "node_modules", "prisma", "build", "index.js");

const schema = await readFile(sourceSchemaPath, "utf8");
const clientGenerator = /generator client \{([\s\S]*?)\n\}/;
const match = schema.match(clientGenerator);

if (!match || !/provider\s*=\s*"prisma-client-js"/.test(match[1])) {
  throw new Error("Could not find the prisma-client-js generator in the backend Prisma schema.");
}

const workerSchema = schema.replace(clientGenerator, (_block, contents) => {
  return `generator client {${contents}\n  output        = "../generated/client"\n}`;
});

await mkdir(temporarySchemaDirectory, { recursive: true });
await writeFile(temporarySchemaPath, workerSchema);

try {
  const result = spawnSync(
    process.execPath,
    [prismaCliPath, "generate", "--schema", temporarySchemaPath],
    { cwd: workerRoot, stdio: "inherit" }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Prisma client generation failed with exit code ${result.status}.`);
  }
} finally {
  await rm(temporarySchemaDirectory, { recursive: true, force: true });
}
