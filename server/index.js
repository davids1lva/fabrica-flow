import { openDB } from "./db.js";
import { createApp } from "./app.js";
if (!process.env.APP_ORIGIN) throw Error("APP_ORIGIN obrigatório");
const db = await openDB(),
  app = createApp(db),
  server = app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
    console.log("Fábrica Flow: porta " + (process.env.PORT || 3001)),
  );
const stop = () => {
  app.closeStreams();
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
