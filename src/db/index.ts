import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

/**
 * Bangun & cache instance drizzle pada pemanggilan pertama. Validasi
 * DATABASE_URL dilakukan di sini (lazy) agar mengimpor modul ini tidak melempar
 * saat env belum tersedia (mis. saat `next build` di aplikasi konsumen).
 */
function getDb(): Db {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("admin-kit: DATABASE_URL env var is required");
  const client = postgres(connectionString, { prepare: false }); // prepare: false wajib untuk Neon pgBouncer
  _db = drizzle(client, { schema });
  return _db;
}

/**
 * Proxy ke instance drizzle yang dibuat lazy: koneksi baru dibuka saat properti
 * pertama diakses (mis. `db.select(...)`), bukan saat modul diimpor.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
}) as Db;
