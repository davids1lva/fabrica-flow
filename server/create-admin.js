import { openDB } from "./db.js";
import { id, pinHash } from "./security.js";
// Recebe os dados por stdin para evitar o PIN no histórico da shell.
let text = "";
for await (const chunk of process.stdin) text += chunk;
const { code, name, pin } = JSON.parse(text);
if (!/^\d{1,12}$/.test(code) || !name?.trim() || !/^(\d{4}|\d{6})$/.test(pin))
  throw Error("Código, nome ou PIN inválidos");
const db = await openDB();
try {
  await db.query(
    "INSERT INTO users(id,code,name,pin_hash,role) VALUES($1,$2,$3,$4,$5)",
    [id(), code, name, await pinHash(pin), "admin"],
  );
  console.log("Administrador criado.");
} finally {
  await db.close();
}
