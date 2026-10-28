import { readFile } from "node:fs/promises";
import pg from "pg";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(
    await readFile(
      new URL("../migrations/20261028_vendor_credits.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log("Vendor credit migration complete");
} finally {
  await client.end();
}
