import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema";
import { PG_LITE_BOOTSTRAP_SQL } from "./pglite-bootstrap.js";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim();

let pool: pg.Pool | undefined;
let db: ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;

if (databaseUrl) {
  pool = new Pool({ connectionString: databaseUrl });
  db = drizzlePg(pool, { schema });
} else {
  console.warn(
    "[@workspace/db] DATABASE_URL is not set — using in-memory PGlite (demo). Data is lost when the process exits. Set DATABASE_URL for Postgres.",
  );
  const client = new PGlite();
  await client.waitReady;
  await client.exec(PG_LITE_BOOTSTRAP_SQL);
  db = drizzlePglite(client, { schema });
}

export { db, pool };
export * from "./schema";
