import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";
try {
  loadEnvFile(".env");
} catch {}
const api = spawn(
  process.execPath,
  [
    "--watch",
    process.env.TEST_DB === "pglite" ? "server/demo.js" : "server/index.js",
  ],
  { stdio: "inherit", env: process.env },
);
const web = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)],
  { stdio: "inherit", env: process.env },
);
const stop = () => {
  api.kill();
  web.kill();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
api.on("exit", () => web.kill());
web.on("exit", () => api.kill());
