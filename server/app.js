import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { join } from "node:path";
import {
  id,
  token,
  hash,
  pinHash,
  checkPin,
  cookies,
  fail,
} from "./security.js";
import { metrics, checkpoint } from "./metrics.js";
const uuid = z.string().uuid(),
  str = z.string().trim().min(1).max(120),
  pin = z.string().regex(/^(\d{4}|\d{6})$/),
  role = z.enum(["employee", "supervisor", "admin"]);
const schemas = {
  users: z.object({
    code: z.string().regex(/^\d{1,12}$/),
    name: str,
    department: z.string().max(120),
    role,
    active: z.boolean(),
    pin: pin.optional(),
  }),
  machines: z.object({ code: str, name: str, active: z.boolean() }),
  stations: z.object({
    code: str,
    name: str,
    machine_id: uuid,
    sector: str,
    line: str,
    target: z.number().positive().max(1000000),
    status: z.enum(["available", "stopped", "maintenance", "problem"]),
    active: z.boolean(),
  }),
  orders: z.object({
    code: str,
    product: str,
    reference: str,
    quantity: z.number().int().positive().max(1000000000),
    target: z.number().positive().max(1000000).nullable(),
    status: z.enum([
      "pending",
      "production",
      "paused",
      "finished",
      "cancelled",
    ]),
    start_date: z.string().date().nullable(),
    due_date: z.string().date().nullable(),
  }),
  pause_types: z.object({ name: str, active: z.boolean() }),
};
const selectSessions = `SELECT w.*,u.name AS employee,u.code AS employee_code,s.name AS station,s.code AS station_code,s.sector,s.line,m.name AS machine,o.code AS order_code,o.product,o.reference,p.reason AS pause_reason,p.started_at AS pause_started FROM work_sessions w JOIN users u ON u.id=w.user_id JOIN stations s ON s.id=w.station_id JOIN machines m ON m.id=w.machine_id JOIN orders o ON o.id=w.order_id LEFT JOIN pauses p ON p.session_id=w.id AND p.ended_at IS NULL`;
const publicUser = (u) => ({
  id: u.id,
  code: u.code,
  name: u.name,
  role: u.role,
  department: u.department,
});
export function createApp(db) {
  const app = express(),
    streams = new Set();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests:
            process.env.NODE_ENV === "production" ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("Origin") !== process.env.APP_ORIGIN)
        return res.status(403).json({ error: "Origem não autorizada." });
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Utilize JSON." });
    }
    next();
  });
  const emit = () => {
    for (const res of streams) res.write("event: update\ndata: {}\n\n");
  };
  let listener;
  if (db.pool)
    db.pool
      .connect()
      .then(async (c) => {
        listener = c;
        await c.query("LISTEN production_change");
        c.on("notification", emit);
        c.on("error", () => {});
      })
      .catch(() => {});
  const notify = async () => {
    emit();
    if (db.pool)
      await db.query("SELECT pg_notify('production_change','changed')");
  };
  const cookie = (res, name, v, age) =>
    res.cookie(name, v, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: age,
      path: "/",
    });
  const audit = (t, u, action, entity, details = {}) =>
    t.query(
      "INSERT INTO audit_logs(id,user_id,action,entity_id,details) VALUES($1,$2,$3,$4,$5)",
      [id(), u?.id || null, action, entity, JSON.stringify(details)],
    );
  async function auth(req, res, next) {
    const v = cookies(req).sid;
    const { rows } = await db.query(
      "SELECT u.*,a.token_hash FROM auth_sessions a JOIN users u ON u.id=a.user_id WHERE a.token_hash=$1 AND a.expires_at>now() AND u.active=true",
      [hash(v || "")],
    );
    if (!rows.length) fail(401, "Sessão expirada. Inicie sessão.");
    req.user = rows[0];
    next();
  }
  const supervisor = (req, res, next) => {
    if (req.user.role === "employee")
      fail(403, "Acesso reservado à supervisão.");
    next();
  };
  const admin = (req, res, next) => {
    if (req.user.role !== "admin")
      fail(403, "Acesso reservado à administração.");
    next();
  };
  const getDevice = async (req, t = db) => {
    const { rows } = await t.query(
      "SELECT d.id AS device_id,s.*,m.name AS machine,m.active AS machine_active FROM devices d JOIN stations s ON s.id=d.station_id JOIN machines m ON m.id=s.machine_id WHERE d.token_hash=$1 AND d.active=true",
      [hash(cookies(req).device || "")],
    );
    return rows[0] || null;
  };
  app.get("/api/health", async (req, res) => {
    await db.query("SELECT 1");
    res.json({ ok: true, now: new Date().toISOString() });
  });
  app.get("/api/device", async (req, res) => res.json(await getDevice(req)));
  app.post("/api/login", async (req, res) => {
    const b = z
      .object({ code: z.string().regex(/^\d{1,12}$/), pin })
      .parse(req.body);
    for (const key of ["ip:" + req.ip, "code:" + b.code]) {
      const {
        rows: [r],
      } = await db.query(
        "INSERT INTO login_limits(key,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.reset_at<now() THEN 1 ELSE login_limits.attempts+1 END,reset_at=CASE WHEN login_limits.reset_at<now() THEN now()+interval '15 minutes' ELSE login_limits.reset_at END RETURNING attempts",
        [key],
      );
      if (r.attempts > (key.startsWith("ip:") ? 60 : 8))
        fail(429, "Demasiadas tentativas. Aguarde 15 minutos.");
    }
    const {
      rows: [u],
    } = await db.query("SELECT * FROM users WHERE code=$1", [b.code]);
    if (!u || !u.active || !(await checkPin(b.pin, u.pin_hash))) {
      await audit(db, null, "login_failed", b.code);
      fail(401, "Código ou PIN incorreto.");
    }
    const tok = token();
    await db.tx(async (t) => {
      await t.query(
        "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '16 hours')",
        [hash(tok), u.id],
      );
      await audit(t, u, "login", u.id);
      await t.query("DELETE FROM login_limits WHERE key=$1", [
        "code:" + b.code,
      ]);
    });
    cookie(res, "sid", tok, 16 * 3600000);
    res.json(publicUser(u));
  });
  app.use("/api", auth);
  app.get("/api/me", (req, res) => res.json(publicUser(req.user)));
  app.post("/api/logout", async (req, res) => {
    await db.tx(async (t) => {
      await t.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
        req.user.token_hash,
      ]);
      await audit(t, req.user, "logout", req.user.id);
    });
    cookie(res, "sid", "", 0);
    res.json({ ok: true });
  });
  app.get("/api/events", supervisor, (req, res) => {
    res.set({ "Content-Type": "text/event-stream", Connection: "keep-alive" });
    res.flushHeaders();
    res.write("event: update\ndata: {}\n\n");
    streams.add(res);
    const heartbeat = setInterval(async () => {
      try {
        const { rows } = await db.query(
          "SELECT u.id FROM users u JOIN auth_sessions a ON a.user_id=u.id WHERE a.token_hash=$1 AND a.expires_at>now() AND u.active AND u.role<>'employee'",
          [req.user.token_hash],
        );
        if (!rows.length) return res.end();
        res.write(": ping\n\n");
      } catch {
        res.end();
      }
    }, 30000);
    req.on("close", () => {
      clearInterval(heartbeat);
      streams.delete(res);
    });
  });
  app.get("/api/bootstrap", async (req, res) => {
    const [orders, reasons, current, settings] = await Promise.all([
      db.query(
        "SELECT o.*,COALESCE((SELECT sum(quantity) FROM work_sessions WHERE order_id=o.id),0)::int AS produced FROM orders o ORDER BY code",
      ),
      db.query("SELECT * FROM pause_types WHERE active ORDER BY name"),
      db.query(
        selectSessions + " WHERE w.user_id=$1 AND w.status<>'finished'",
        [req.user.id],
      ),
      db.query("SELECT * FROM settings"),
    ]);
    res.json({
      orders: orders.rows,
      reasons: reasons.rows,
      current: current.rows[0] ? metrics(current.rows[0]) : null,
      device: await getDevice(req),
      settings: settings.rows[0],
      server_time: new Date().toISOString(),
    });
  });
  async function mutation(req, fn) {
    const key = uuid.parse(req.get("Idempotency-Key")),
      fingerprint = hash(req.path + JSON.stringify(req.body));
    const result = await db.tx(async (t) => {
      await t.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        req.user.id,
      ]);
      const {
        rows: [old],
      } = await t.query("SELECT * FROM requests WHERE user_id=$1 AND key=$2", [
        req.user.id,
        key,
      ]);
      if (old) {
        if (old.fingerprint !== fingerprint)
          fail(409, "Identificador já utilizado noutra operação.");
        return old.result;
      }
      const out = await fn(t);
      await t.query(
        "INSERT INTO requests(user_id,key,fingerprint,result) VALUES($1,$2,$3,$4)",
        [req.user.id, key, fingerprint, JSON.stringify(out)],
      );
      return out;
    });
    await notify();
    return result;
  }
  app.post("/api/work/start", async (req, res) => {
    const b = z
      .object({ order_id: uuid, shift: z.enum(["Manhã", "Tarde", "Noite"]) })
      .parse(req.body);
    res.json(
      await mutation(req, async (t) => {
        const device = await getDevice(req, t);
        if (!device)
          fail(
            400,
            "Peça ao administrador para associar este tablet a um posto.",
          );
        const {
          rows: [station],
        } = await t.query("SELECT * FROM stations WHERE id=$1 FOR UPDATE", [
          device.id,
        ]);
        if (
          !station.active ||
          station.status !== "available" ||
          !device.machine_active
        )
          fail(409, "Posto indisponível.");
        const {
          rows: [order],
        } = await t.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
          b.order_id,
        ]);
        if (
          !order ||
          ["finished", "cancelled", "paused"].includes(order.status)
        )
          fail(409, "Ordem indisponível.");
        const sid = id();
        await t.query(
          "INSERT INTO work_sessions(id,user_id,station_id,machine_id,order_id,shift,status,target) VALUES($1,$2,$3,$4,$5,$6,'production',$7)",
          [
            sid,
            req.user.id,
            station.id,
            station.machine_id,
            order.id,
            b.shift,
            order.target || station.target,
          ],
        );
        await t.query(
          "UPDATE orders SET status='production',updated_at=now() WHERE id=$1",
          [order.id],
        );
        await audit(t, req.user, "start", sid);
        return { id: sid };
      }),
    );
  });
  app.post("/api/work/:id/:action", async (req, res) => {
    const sid = uuid.parse(req.params.id),
      action = z
        .enum(["quantity", "pause", "resume", "finish"])
        .parse(req.params.action);
    res.json(
      await mutation(req, async (t) => {
        const {
          rows: [s],
        } = await t.query(
          "SELECT * FROM work_sessions WHERE id=$1 FOR UPDATE",
          [sid],
        );
        if (!s || s.user_id !== req.user.id)
          fail(403, "Sessão não autorizada.");
        const device = await getDevice(req, t);
        if (!device || device.id !== s.station_id)
          fail(403, "Este tablet não pertence ao posto do turno.");
        if (s.status === "finished") fail(409, "Turno já terminado.");
        if (action === "quantity") {
          const b = z
            .object({
              mode: z.enum(["add", "set"]),
              quantity: z.number().int().min(0).max(1000000000),
              version: z.number().int().optional(),
            })
            .parse(req.body);
          if (s.status !== "production")
            fail(409, "Retome a produção antes de registar quantidades.");
          if (b.mode === "set" && b.version !== s.version)
            fail(
              409,
              "A quantidade mudou. Atualize o ecrã e confirme novamente.",
            );
          const qty = b.mode === "add" ? s.quantity + b.quantity : b.quantity;
          if (qty > 1000000000) fail(400, "Quantidade demasiado elevada.");
          await t.query(
            "UPDATE work_sessions SET quantity=$2,version=version+1,updated_at=now() WHERE id=$1",
            [sid, qty],
          );
          await t.query(
            "INSERT INTO production_records(id,session_id,user_id,previous,quantity,delta) VALUES($1,$2,$3,$4,$5,$6)",
            [id(), sid, req.user.id, s.quantity, qty, qty - s.quantity],
          );
        } else {
          await checkpoint(t, s);
          if (action === "pause") {
            if (s.status !== "production") fail(409, "Já está em pausa.");
            const b = z.object({ type_id: uuid }).parse(req.body),
              {
                rows: [reason],
              } = await t.query(
                "SELECT * FROM pause_types WHERE id=$1 AND active=true",
                [b.type_id],
              );
            if (!reason) fail(400, "Motivo inválido.");
            await t.query(
              "INSERT INTO pauses(id,session_id,type_id,reason) VALUES($1,$2,$3,$4)",
              [id(), sid, reason.id, reason.name],
            );
            await t.query(
              "UPDATE work_sessions SET status='pause' WHERE id=$1",
              [sid],
            );
          } else {
            if (action === "resume" && s.status !== "pause")
              fail(409, "A produção já está em curso.");
            await t.query(
              "UPDATE pauses SET ended_at=now() WHERE session_id=$1 AND ended_at IS NULL",
              [sid],
            );
            await t.query(
              "UPDATE work_sessions SET status=$2,ended_at=CASE WHEN $2='finished' THEN checkpoint_at ELSE NULL END WHERE id=$1",
              [sid, action === "finish" ? "finished" : "production"],
            );
          }
        }
        await audit(t, req.user, action, sid, req.body);
        return { ok: true };
      }),
    );
  });
  app.get("/api/overview", supervisor, async (req, res) => {
    const [stations, sessions, settings] = await Promise.all([
      db.query(
        "SELECT s.*,m.name AS machine FROM stations s JOIN machines m ON m.id=s.machine_id WHERE s.active ORDER BY s.code",
      ),
      db.query(
        selectSessions + " WHERE w.status<>'finished' ORDER BY w.started_at",
      ),
      db.query("SELECT * FROM settings"),
    ]);
    res.json({
      stations: stations.rows,
      sessions: sessions.rows.map((s) => metrics(s)),
      settings: settings.rows[0],
      server_time: new Date().toISOString(),
    });
  });
  app.get("/api/manage/:entity", supervisor, async (req, res) => {
    const entity = req.params.entity;
    if (!schemas[entity]) fail(404, "Lista inexistente.");
    if (entity === "users" && req.user.role !== "admin")
      fail(403, "Acesso reservado à administração.");
    const columns =
      entity === "users"
        ? "id,code,name,role,department,active,created_at,updated_at"
        : entity === "orders"
          ? "orders.*,COALESCE((SELECT sum(quantity) FROM work_sessions WHERE order_id=orders.id),0)::bigint AS produced"
          : "*";
    const { rows } = await db.query(
      `SELECT ${columns} FROM ${entity} ORDER BY ${entity === "pause_types" ? "name" : "code"}`,
    );
    res.json(rows);
  });
  async function applyTarget(t, req, entity, record, old) {
    const { rows } = await t.query(
      "SELECT * FROM work_sessions WHERE status<>'finished' AND " +
        (entity === "stations"
          ? "station_id=$1 AND order_id IN (SELECT id FROM orders WHERE target IS NULL)"
          : "order_id=$1") +
        " ORDER BY id FOR UPDATE",
      [record.id],
    );
    for (const s of rows) {
      await checkpoint(t, s);
      let target = record.target;
      if (!target) {
        const {
          rows: [st],
        } = await t.query("SELECT target FROM stations WHERE id=$1", [
          s.station_id,
        ]);
        target = st.target;
      }
      await t.query("UPDATE work_sessions SET target=$2 WHERE id=$1", [
        s.id,
        target,
      ]);
      await t.query(
        "INSERT INTO target_changes(id,session_id,user_id,previous,target) VALUES($1,$2,$3,$4,$5)",
        [id(), s.id, req.user.id, s.target, target],
      );
    }
    await audit(t, req.user, "target_change", record.id, {
      previous: old.target,
      target: record.target,
    });
  }
  app.post("/api/stations/:id/target", supervisor, async (req, res) => {
    const sid = uuid.parse(req.params.id),
      b = z
        .object({ target: z.number().positive().max(1000000) })
        .parse(req.body);
    await db.tx(async (t) => {
      const {
        rows: [old],
      } = await t.query("SELECT * FROM stations WHERE id=$1 FOR UPDATE", [sid]);
      if (!old) fail(404, "Posto inexistente.");
      await applyTarget(t, req, "stations", { ...old, target: b.target }, old);
      await t.query(
        "UPDATE stations SET target=$2,updated_at=now() WHERE id=$1",
        [sid, b.target],
      );
    });
    await notify();
    res.json({ ok: true });
  });
  app.post("/api/manage/:entity", admin, async (req, res) =>
    saveEntity(req, res, false),
  );
  app.put("/api/manage/:entity/:id", admin, async (req, res) =>
    saveEntity(req, res, true),
  );
  async function saveEntity(req, res, update) {
    const entity = req.params.entity;
    if (!schemas[entity]) fail(404, "Entidade inexistente.");
    const b = schemas[entity].strict().parse(req.body),
      eid = update ? uuid.parse(req.params.id) : id();
    if (entity === "users") {
      if (!update && !b.pin) fail(400, "Defina um PIN.");
      if (b.pin) b.pin_hash = await pinHash(b.pin);
      delete b.pin;
    }
    await db.tx(async (t) => {
      const {
        rows: [old],
      } = update
        ? await t.query(`SELECT * FROM ${entity} WHERE id=$1 FOR UPDATE`, [eid])
        : { rows: [] };
      if (update && !old) fail(404, "Registo inexistente.");
      if (
        entity === "users" &&
        eid === req.user.id &&
        (!b.active || b.role !== "admin")
      )
        fail(400, "Não pode retirar o seu próprio acesso administrativo.");
      if (update && entity === "stations" && old.machine_id !== b.machine_id) {
        if (
          (
            await t.query(
              "SELECT id FROM work_sessions WHERE station_id=$1 AND status<>'finished'",
              [eid],
            )
          ).rows.length
        )
          fail(409, "Termine o turno antes de alterar a máquina.");
      }
      if (
        update &&
        entity === "orders" &&
        ["finished", "cancelled", "paused"].includes(b.status)
      ) {
        if (
          (
            await t.query(
              "SELECT id FROM work_sessions WHERE order_id=$1 AND status<>'finished'",
              [eid],
            )
          ).rows.length
        )
          fail(409, "Termine os turnos desta ordem antes de alterar o estado.");
      }
      if (
        update &&
        ["stations", "orders"].includes(entity) &&
        Number(old.target) !== Number(b.target)
      )
        await applyTarget(t, req, entity, { id: eid, ...b }, old);
      const keys = Object.keys(b),
        values = Object.values(b);
      if (update)
        await t.query(
          `UPDATE ${entity} SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(",")},updated_at=now() WHERE id=$1`,
          [eid, ...values],
        );
      else
        await t.query(
          `INSERT INTO ${entity}(id,${keys.join(",")}) VALUES($1,${keys.map((_, i) => "$" + (i + 2)).join(",")})`,
          [eid, ...values],
        );
      if (update && entity === "users")
        await t.query("DELETE FROM auth_sessions WHERE user_id=$1", [eid]);
      const details = { ...b };
      delete details.pin_hash;
      await audit(
        t,
        req.user,
        (update ? "update:" : "create:") + entity,
        eid,
        details,
      );
    });
    await notify();
    res.json({ id: eid });
  }
  app.post("/api/device/bind", admin, async (req, res) => {
    const b = z.object({ station_id: uuid, label: str }).parse(req.body),
      tok = token();
    await db.tx(async (t) => {
      await t.query("UPDATE devices SET active=false WHERE token_hash=$1", [
        hash(cookies(req).device || ""),
      ]);
      await t.query(
        "INSERT INTO devices(id,station_id,token_hash,label) VALUES($1,$2,$3,$4)",
        [id(), b.station_id, hash(tok), b.label],
      );
      await audit(t, req.user, "bind_device", b.station_id, { label: b.label });
    });
    cookie(res, "device", tok, 365 * 86400000);
    res.json({ ok: true });
  });
  app.get("/api/devices", admin, async (req, res) =>
    res.json(
      (
        await db.query(
          "SELECT d.id,d.label,d.station_id,d.active,d.created_at,s.name AS station FROM devices d JOIN stations s ON s.id=d.station_id ORDER BY d.created_at DESC",
        )
      ).rows,
    ),
  );
  app.post("/api/devices/:id/revoke", admin, async (req, res) => {
    const did = uuid.parse(req.params.id);
    await db.tx(async (t) => {
      await t.query("UPDATE devices SET active=false WHERE id=$1", [did]);
      await audit(t, req.user, "revoke_device", did);
    });
    res.json({ ok: true });
  });
  app.get("/api/settings", supervisor, async (req, res) =>
    res.json((await db.query("SELECT * FROM settings")).rows[0]),
  );
  app.put("/api/settings", admin, async (req, res) => {
    const b = z
      .object({
        company: str,
        warning_threshold: z.number().int().min(1).max(99),
        timezone: z.enum(["Europe/Lisbon", "Atlantic/Azores", "UTC"]),
      })
      .parse(req.body);
    await db.tx(async (t) => {
      await t.query(
        "UPDATE settings SET company=$1,warning_threshold=$2,timezone=$3 WHERE id=1",
        [b.company, b.warning_threshold, b.timezone],
      );
      await audit(t, req.user, "settings", "1", b);
    });
    await notify();
    res.json({ ok: true });
  });
  app.get("/api/history/:id", async (req, res) => {
    const sid = uuid.parse(req.params.id),
      {
        rows: [s],
      } = await db.query(selectSessions + " WHERE w.id=$1", [sid]);
    if (!s) fail(404, "Sessão inexistente.");
    if (req.user.role === "employee" && s.user_id !== req.user.id)
      fail(403, "Acesso não autorizado.");
    const [records, pauses, targets] = await Promise.all([
      db.query(
        "SELECT * FROM production_records WHERE session_id=$1 ORDER BY created_at",
        [sid],
      ),
      db.query("SELECT * FROM pauses WHERE session_id=$1 ORDER BY started_at", [
        sid,
      ]),
      db.query(
        "SELECT * FROM target_changes WHERE session_id=$1 ORDER BY created_at",
        [sid],
      ),
    ]);
    res.json({
      session: metrics(s),
      records: records.rows,
      pauses: pauses.rows,
      targets: targets.rows,
    });
  });
  app.get("/api/reports", supervisor, async (req, res) => {
    const b = z
      .object({
        from: z.string().datetime({ offset: true }),
        to: z.string().datetime({ offset: true }),
      })
      .parse(req.query);
    if (
      +new Date(b.to) <= +new Date(b.from) ||
      +new Date(b.to) - +new Date(b.from) > 366 * 86400000
    )
      fail(400, "Selecione um período até 366 dias.");
    const { rows } = await db.query(
      selectSessions +
        " WHERE w.started_at>=$1 AND w.started_at<$2 ORDER BY w.started_at DESC LIMIT 20001",
      [b.from, b.to],
    );
    if (rows.length > 20000) fail(400, "Reduza o período do relatório.");
    const pauses = await db.query(
      "SELECT p.* FROM pauses p JOIN work_sessions w ON w.id=p.session_id WHERE w.started_at>=$1 AND w.started_at<$2",
      [b.from, b.to],
    );
    res.json({ sessions: rows.map((s) => metrics(s)), pauses: pauses.rows });
  });
  app.get("/api/audit", admin, async (req, res) => {
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(1000000)
      .parse(req.query.offset || 0);
    res.json(
      (
        await db.query(
          "SELECT a.*,u.name AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 100 OFFSET $1",
          [offset],
        )
      ).rows,
    );
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Operação inexistente." }),
  );
  app.use(express.static(join(process.cwd(), "dist"), { index: false }));
  app.get("/{*path}", (req, res) =>
    res.sendFile(join(process.cwd(), "dist/index.html")),
  );
  app.use((e, req, res, next) => {
    if (res.headersSent) return next(e);
    const status =
      e.status ||
      (e instanceof z.ZodError
        ? 400
        : ["23505", "23503", "23514", "22007"].includes(e.code)
          ? 409
          : 500);
    if (status === 500) console.error(e);
    res.status(status).json({
      error:
        e instanceof z.ZodError
          ? "Dados inválidos. Verifique os campos."
          : e.code === "23505"
            ? "Já existe um registo com estes dados ou um turno ativo neste posto/funcionário."
            : e.code === "23503"
              ? "Registo relacionado inválido."
              : status === 500
                ? "Erro no servidor. Tente novamente."
                : e.message,
    });
  });
  app.closeStreams = () => {
    for (const s of streams) s.end();
    if (listener) listener.release();
  };
  return app;
}
