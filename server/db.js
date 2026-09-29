import pg from "pg";
export async function openDB() {
  if (process.env.TEST_DB === "pglite") {
    if (process.env.NODE_ENV === "production")
      throw Error("PGlite apenas para testes");
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(process.env.PGLITE_PATH || undefined);
    let tail = Promise.resolve();
    const serial = (fn) => {
      const p = tail.then(fn);
      tail = p.catch(() => {});
      return p;
    };
    return {
      query: (...a) => serial(() => db.query(...a)),
      exec: (q) => serial(() => db.exec(q)),
      tx: (fn) =>
        serial(() =>
          db.transaction((t) => fn({ query: (...a) => t.query(...a) })),
        ),
      close: () => db.close(),
      embedded: true,
    };
  }
  if (!process.env.DATABASE_URL) throw Error("Defina DATABASE_URL no .env");
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
  });
  return {
    query: (...a) => pool.query(...a),
    exec: (q) => pool.query(q),
    tx: async (fn) => {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const out = await fn(c);
        await c.query("COMMIT");
        return out;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
    close: () => pool.end(),
    pool,
  };
}
