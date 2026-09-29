import { writeFile, readFile, rm } from "node:fs/promises";
await writeFile("docs/.nojekyll", "");
// Public demo runs fully in the browser, without a service worker or backend.
await rm("docs/sw.js", { force: true });
const m = JSON.parse(await readFile("docs/manifest.webmanifest", "utf8"));
m.name = "Fábrica Flow · Demonstração";
m.start_url = "./";
m.scope = "./";
m.icons = m.icons.map((i) => ({ ...i, src: "." + i.src }));
await writeFile("docs/manifest.webmanifest", JSON.stringify(m, null, 2));
