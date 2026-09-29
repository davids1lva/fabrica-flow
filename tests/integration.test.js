import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDB } from "../server/db.js";
import { migrate } from "../server/migrate.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
import { metrics } from "../server/metrics.js";
process.env.TEST_DB = "pglite";
process.env.APP_ORIGIN = "http://localhost:5173";
let db, server, base;
const jar = () => ({});
async function request(
  c,
  path,
  method = "GET",
  body,
  key,
  origin = process.env.APP_ORIGIN,
) {
  const res = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: Object.entries(c)
        .map(([k, v]) => k + "=" + v)
        .join("; "),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  for (const value of res.headers.getSetCookie()) {
    const [s] = value.split(";");
    const i = s.indexOf("=");
    c[s.slice(0, i)] = s.slice(i + 1);
  }
  const data = await res.json();
  return { status: res.status, data };
}
const login = (c, code, pin = "123456") =>
  request(c, "/login", "POST", { code, pin });
const mutate = (c, p, b = {}, k = randomUUID()) => request(c, p, "POST", b, k);
test.before(async () => {
  db = await openDB();
  await migrate(db);
  await migrate(db);
  await seed(db);
  await seed(db);
  const app = createApp(db);
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
});
test.after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
});
test("Seed, PIN hashing, roles and CSRF origin protection", async () => {
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM users")).rows[0].n,
    23,
  );
  const pin = (await db.query("SELECT pin_hash FROM users LIMIT 1")).rows[0]
    .pin_hash;
  assert(!pin.includes("123456"));
  const c = jar();
  assert.equal((await login(c, "1001", "999999")).status, 401);
  assert.equal((await login(c, "1001")).status, 200);
  assert.equal((await request(c, "/overview")).status, 403);
  assert.equal((await request(c, "/manage/users")).status, 403);
  assert.equal(
    (await request(c, "/logout", "POST", {}, undefined, "https://evil.invalid"))
      .status,
    403,
  );
  assert.equal((await request(jar(), "/reports")).status, 401);
});
test("Full shift: device, uniqueness, quantity idempotency, pause, target change, resume, history and permanent report", async () => {
  const a = jar();
  assert.equal((await login(a, "9001")).status, 200);
  const stations = (await request(a, "/manage/stations")).data;
  assert.equal(
    (
      await request(a, "/device/bind", "POST", {
        station_id: stations[0].id,
        label: "Test tablet",
      })
    ).status,
    200,
  );
  const worker = { device: a.device };
  assert.equal((await login(worker, "1001")).status, 200);
  const boot = (await request(worker, "/bootstrap")).data;
  assert.equal(boot.device.id, stations[0].id);
  const key = randomUUID(),
    started = await mutate(
      worker,
      "/work/start",
      { order_id: boot.orders[0].id, shift: "Manhã" },
      key,
    );
  assert.equal(started.status, 200, JSON.stringify(started));
  const sid = started.data.id;
  assert.equal(
    (
      await mutate(
        worker,
        "/work/start",
        { order_id: boot.orders[0].id, shift: "Manhã" },
        key,
      )
    ).data.id,
    sid,
  );
  const other = { device: a.device };
  await login(other, "1002");
  assert.equal(
    (
      await mutate(other, "/work/start", {
        order_id: boot.orders[0].id,
        shift: "Manhã",
      })
    ).status,
    409,
  );
  assert.equal(
    (await mutate(other, `/work/${sid}/quantity`, { mode: "add", quantity: 5 }))
      .status,
    403,
  );
  const qkey = randomUUID();
  const result = await mutate(
    worker,
    `/work/${sid}/quantity`,
    { mode: "add", quantity: 50 },
    qkey,
  );
  assert.equal(result.status, 200, JSON.stringify(result));
  await mutate(
    worker,
    `/work/${sid}/quantity`,
    { mode: "add", quantity: 50 },
    qkey,
  );
  assert.equal(
    (
      await mutate(
        worker,
        `/work/${sid}/quantity`,
        { mode: "add", quantity: 5 },
        qkey,
      )
    ).status,
    409,
  );
  let s = (await request(worker, "/bootstrap")).data.current;
  assert.equal(s.quantity, 50);
  assert.equal(
    (
      await mutate(worker, `/work/${sid}/quantity`, {
        mode: "set",
        quantity: 48,
        version: s.version - 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await mutate(worker, `/work/${sid}/quantity`, {
        mode: "set",
        quantity: 48,
        version: s.version,
      })
    ).status,
    200,
  );
  await db.query(
    "UPDATE work_sessions SET checkpoint_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
    [sid],
  );
  assert.equal(
    (
      await mutate(worker, `/work/${sid}/pause`, {
        type_id: boot.reasons[0].id,
      })
    ).status,
    200,
  );
  s = (await request(worker, "/bootstrap")).data.current;
  assert(s.expected >= 119.9 && s.expected < 121);
  assert.equal(s.status, "pause");
  assert.equal(
    (
      await mutate(worker, `/work/${sid}/quantity`, {
        mode: "add",
        quantity: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await mutate(worker, `/work/${sid}/pause`, {
        type_id: boot.reasons[0].id,
      })
    ).status,
    409,
  );
  await db.query(
    "UPDATE work_sessions SET checkpoint_at=clock_timestamp()-interval '10 minutes' WHERE id=$1",
    [sid],
  );
  const superv = jar();
  await login(superv, "8001");
  assert.equal(
    (
      await request(superv, `/stations/${stations[0].id}/target`, "POST", {
        target: 240,
      })
    ).status,
    200,
  );
  s = (await request(worker, "/bootstrap")).data.current;
  assert(s.expected < 121);
  assert(s.pause_ms >= 600000);
  assert.equal(s.target, 240);
  assert.equal((await mutate(worker, `/work/${sid}/resume`)).status, 200);
  await db.query(
    "UPDATE work_sessions SET checkpoint_at=clock_timestamp()-interval '30 minutes' WHERE id=$1",
    [sid],
  );
  assert.equal((await mutate(worker, `/work/${sid}/finish`)).status, 200);
  const history = (await request(a, "/history/" + sid)).data;
  assert.equal(history.session.quantity, 48);
  assert.equal(history.records.length, 2);
  assert.equal(history.pauses.length, 1);
  assert(history.pauses[0].ended_at);
  assert.equal(history.targets.length, 1);
  assert(history.session.expected >= 239.9 && history.session.expected < 241);
  assert.equal((await request(worker, "/bootstrap")).data.current, null);
  const report = await request(
    superv,
    "/reports?from=" +
      encodeURIComponent(new Date(Date.now() - 86400000).toISOString()) +
      "&to=" +
      encodeURIComponent(new Date(Date.now() + 86400000).toISOString()),
  );
  assert.equal(report.status, 200);
  assert.equal(report.data.sessions.length, 1);
  assert.equal(report.data.sessions[0].quantity, 48);
  assert.equal((await request(superv, "/manage/users")).status, 403);
  assert.equal((await request(superv, "/settings", "PUT", {})).status, 403);
  await request(worker, "/logout", "POST");
  assert.equal((await request(worker, "/me")).status, 401);
  assert.equal((await request(a, "/audit")).status, 200);
});
test("Administrative CRUD, deactivation, revocation and sensitive fields", async () => {
  const a = jar();
  await login(a, "9001");
  const r = await request(a, "/manage/users", "POST", {
    code: "5555",
    name: "Teste",
    department: "QA",
    role: "employee",
    active: true,
    pin: "6789",
  });
  assert.equal(r.status, 200);
  const c = jar();
  assert.equal((await login(c, "5555", "6789")).status, 200);
  assert.equal(
    (await request(a, "/manage/users")).data.some((u) => u.pin_hash || u.pin),
    false,
  );
  await request(a, "/manage/users/" + r.data.id, "PUT", {
    code: "5555",
    name: "Teste",
    department: "QA",
    role: "employee",
    active: false,
  });
  assert.equal((await request(c, "/me")).status, 401);
  const me = (await request(a, "/me")).data;
  assert.equal(
    (
      await request(a, "/manage/users/" + me.id, "PUT", {
        code: me.code,
        name: me.name,
        department: "",
        role: "employee",
        active: true,
      })
    ).status,
    400,
  );
  const st = (await request(a, "/manage/stations")).data[1];
  await request(a, "/device/bind", "POST", {
    station_id: st.id,
    label: "Revogar",
  });
  const d = (await request(a, "/devices")).data.find(
    (d) => d.label === "Revogar",
  );
  await request(a, "/devices/" + d.id + "/revoke", "POST");
  assert.equal((await request(a, "/device")).data, null);
});
test("Login rate limiting persists in the database", async () => {
  const c = jar();
  for (let i = 0; i < 8; i++)
    assert.equal((await login(c, "7777", "0000")).status, 401);
  assert.equal((await login(c, "7777", "0000")).status, 429);
});
test("Expected production uses productive time only and zero denominator is undefined", () => {
  const s = {
    checkpoint_at: new Date(0).toISOString(),
    productive_ms: 0,
    pause_ms: 0,
    expected: 0,
    target: 120,
    quantity: 0,
    status: "production",
  };
  assert.equal(metrics(s, 3600000).expected, 120);
  assert.equal(metrics({ ...s, status: "pause" }, 3600000).expected, 0);
  assert.equal(metrics(s, 0).efficiency, null);
});
