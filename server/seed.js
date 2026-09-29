import { openDB } from "./db.js";
import { id, pinHash } from "./security.js";
export async function seed(db) {
  if (process.env.NODE_ENV === "production")
    throw Error("Seed de demonstração bloqueado em produção");
  if ((await db.query("SELECT id FROM users LIMIT 1")).rows.length) return;
  const pin = await pinHash("123456");
  await db.tx(async (t) => {
    const names = [
      "João Silva",
      "Ana Costa",
      "Carlos Santos",
      "Maria Ferreira",
      "Pedro Sousa",
      "Inês Martins",
      "Miguel Oliveira",
      "Sofia Rodrigues",
      "Tiago Pereira",
      "Beatriz Lopes",
      "Rui Almeida",
      "Diana Mendes",
      "André Pinto",
      "Catarina Gomes",
      "Nuno Ribeiro",
      "Mariana Dias",
      "Luís Correia",
      "Carolina Castro",
      "Diogo Neves",
      "Rita Teixeira",
    ];
    for (let i = 0; i < 23; i++)
      await t.query(
        "INSERT INTO users(id,code,name,pin_hash,role,department) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id(),
          i < 20 ? String(1001 + i) : i === 20 ? "9001" : String(8001 + i - 21),
          i < 20
            ? names[i]
            : i === 20
              ? "Administrador demo"
              : `Supervisor ${i - 20}`,
          pin,
          i < 20 ? "employee" : i === 20 ? "admin" : "supervisor",
          i % 2 ? "Montagem" : "Maquinação",
        ],
      );
    for (let i = 1; i <= 10; i++) {
      const m = id();
      await t.query("INSERT INTO machines(id,code,name) VALUES($1,$2,$3)", [
        m,
        `CNC-${String(i).padStart(2, "0")}`,
        `Máquina CNC ${i}`,
      ]);
      await t.query(
        "INSERT INTO stations(id,code,name,machine_id,sector,line,target) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id(),
          `P${String(i).padStart(3, "0")}`,
          `Posto ${String(i).padStart(2, "0")}`,
          m,
          i <= 5 ? "Maquinação" : "Montagem",
          i <= 5 ? "Linha 1" : "Linha 2",
          120,
        ],
      );
    }
    for (let i = 1; i <= 5; i++)
      await t.query(
        "INSERT INTO orders(id,code,product,reference,quantity,target,start_date,due_date) VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,CURRENT_DATE+7)",
        [
          id(),
          `OP-2026-${String(i).padStart(4, "0")}`,
          [
            "Flange de ligação",
            "Suporte de motor",
            "Eixo de transmissão",
            "Corpo de válvula",
            "Painel de montagem",
          ][i - 1],
          `REF-${40 + i}`,
          2000,
          i === 2 ? 100 : null,
        ],
      );
    for (const name of [
      "Intervalo",
      "Almoço",
      "Casa de banho",
      "Falta de material",
      "Máquina avariada",
      "Mudança de ferramenta",
      "Mudança de ordem",
      "Manutenção",
      "Limpeza",
      "Espera por supervisor",
      "Problema de qualidade",
      "Outro motivo",
    ])
      await t.query("INSERT INTO pause_types(id,name) VALUES($1,$2)", [
        id(),
        name,
      ]);
  });
}
if (process.argv[1]?.endsWith("/seed.js")) {
  const db = await openDB();
  await seed(db);
  await db.close();
  console.log(
    "Demo: 9001 administrador; 8001/8002 supervisores; 1001–1020 funcionários. PIN 123456.",
  );
}
