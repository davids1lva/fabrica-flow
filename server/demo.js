// Ambiente local demonstrativo. Nunca utilizar para alojamento de produção.
process.env.TEST_DB = "pglite";
process.env.PGLITE_PATH ||= ".test-data";
process.env.APP_ORIGIN ||= "http://localhost:3001";
process.env.PORT ||= "3001";
if (process.env.NODE_ENV === "production")
  throw Error("Demo bloqueada em produção");
const { openDB } = await import("./db.js");
const { migrate } = await import("./migrate.js");
const { seed } = await import("./seed.js");
const db = await openDB();
await migrate(db);
await seed(db);
await db.close();
await import("./index.js");
