import { type Row, live, newId } from "./api";
// Standalone portfolio sandbox: no server, credentials or company data.
const STORAGE = "fabrica-flow-public-demo-v1";
const uid = newId;
const iso = (offset = 0) => new Date(Date.now() + offset).toISOString();
function seed(): Row {
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
  const users: Row[] = names.map((name, i) => ({
    id: uid(),
    code: String(1001 + i),
    name,
    role: "employee",
    department: i < 10 ? "Maquinação" : "Montagem",
    active: true,
    created_at: iso(),
  }));
  const admin = {
    id: uid(),
    code: "9001",
    name: "Visitante · demonstração",
    role: "admin",
    department: "Gestão",
    active: true,
  };
  users.push(
    admin,
    ...[1, 2].map((i) => ({
      id: uid(),
      code: String(8000 + i),
      name: `Supervisor ${i}`,
      role: "supervisor",
      department: "Produção",
      active: true,
      created_at: iso(),
    })),
  );
  const machines = Array.from({ length: 10 }, (_, i) => ({
    id: uid(),
    code: `CNC-${String(i + 1).padStart(2, "0")}`,
    name: `Máquina CNC ${i + 1}`,
    active: true,
  }));
  const stations = machines.map((m, i) => ({
    id: uid(),
    code: `P${String(i + 1).padStart(3, "0")}`,
    name: `Posto ${String(i + 1).padStart(2, "0")}`,
    machine_id: m.id,
    machine: m.name,
    sector: i < 5 ? "Maquinação" : "Montagem",
    line: i < 5 ? "Linha 1" : "Linha 2",
    target: 120,
    status: i === 8 ? "maintenance" : i === 9 ? "stopped" : "available",
    active: true,
  }));
  const orders = [
    "Flange de ligação",
    "Suporte de motor",
    "Eixo de transmissão",
    "Corpo de válvula",
    "Painel de montagem",
  ].map((product, i) => ({
    id: uid(),
    code: `OP-2026-${String(i + 1).padStart(4, "0")}`,
    product,
    reference: `REF-${i + 41}`,
    quantity: 2000,
    target: i === 1 ? 100 : null,
    status: i < 4 ? "production" : "pending",
    start_date: iso().slice(0, 10),
    due_date: iso(7 * 86400000).slice(0, 10),
  }));
  const pause_types = [
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
  ].map((name) => ({ id: uid(), name, active: true }));
  const sessions: Row[] = [],
    pauses: Row[] = [],
    records: Row[] = [];
  for (let i = 0; i < 8; i++) {
    const station = stations[i % 6],
      order = orders[i % 4],
      employee = users[i],
      finished = i >= 6,
      paused = [1, 4].includes(i),
      productive = (1.7 + i * 0.17) * 3600000,
      target = order.target || station.target,
      pauseMs = (i + 1) * 90000,
      expected = (productive * target) / 3600000,
      quantity = Math.round(
        expected * [0.95, 0.88, 1.08, 0.99, 0.91, 1.03][i % 6],
      );
    const s = {
      id: uid(),
      user_id: employee.id,
      station_id: station.id,
      machine_id: station.machine_id,
      order_id: order.id,
      employee: employee.name,
      employee_code: employee.code,
      station: station.name,
      station_code: station.code,
      sector: station.sector,
      line: station.line,
      machine: station.machine,
      order_code: order.code,
      product: order.product,
      reference: order.reference,
      shift: "Manhã",
      status: finished ? "finished" : paused ? "pause" : "production",
      started_at: iso(-(finished ? 86400000 : 0) - productive - pauseMs),
      ended_at: finished ? iso(-86400000) : null,
      productive_ms: productive,
      pause_ms: pauseMs,
      expected,
      target,
      quantity,
      version: 0,
      snapshot: Date.now(),
      efficiency: (quantity / expected) * 100,
      total_ms: productive + pauseMs,
      per_hour: (quantity * 3600000) / productive,
      pause_reason: paused ? pause_types[i === 1 ? 3 : 4].name : null,
      pause_started: paused ? iso(-pauseMs) : null,
    };
    sessions.push(s);
    records.push({
      id: uid(),
      session_id: s.id,
      user_id: s.user_id,
      previous: 0,
      quantity,
      delta: quantity,
      created_at: s.started_at,
    });
    pauses.push({
      id: uid(),
      session_id: s.id,
      type_id: pause_types[paused ? (i === 1 ? 3 : 4) : 0].id,
      reason: paused ? s.pause_reason : "Intervalo",
      started_at: iso(-(finished ? 86400000 : 0) - pauseMs),
      ended_at: paused && !finished ? null : iso(finished ? -86400000 : 0),
    });
  }
  return {
    admin,
    users,
    machines,
    stations,
    orders,
    pause_types,
    sessions,
    pauses,
    records,
    targets: [],
    audit: [],
    requests: {},
    devices: [
      {
        id: uid(),
        label: "Tablet de demonstração",
        station_id: stations[7].id,
        station: stations[7].name,
        active: true,
        created_at: iso(),
      },
    ],
    deviceStation: stations[7].id,
    settings: {
      company: "Fábrica Flow · Demo",
      warning_threshold: 90,
      timezone: "Europe/Lisbon",
    },
  };
}
let state: Row;
try {
  state = JSON.parse(localStorage.getItem(STORAGE) || "null") || seed();
} catch {
  state = seed();
}
const persist = () => localStorage.setItem(STORAGE, JSON.stringify(state));
const snapshot = (s: Row) => ({
  ...live(s, Date.now() - s.snapshot),
  snapshot: Date.now(),
});
function settle(s: Row) {
  Object.assign(s, snapshot(s));
}
function device() {
  const s = state.stations.find((s: Row) => s.id === state.deviceStation);
  return s && state.devices.some((d: Row) => d.station_id === s.id && d.active)
    ? s
    : null;
}
const log = (action: string, entity_id: string, details: Row = {}) =>
  state.audit.unshift({
    id: uid(),
    actor: state.admin.name,
    action,
    entity_id,
    details,
    created_at: iso(),
  });
function enrich() {
  for (const s of state.stations)
    s.machine =
      state.machines.find((m: Row) => m.id === s.machine_id)?.name || s.machine;
  for (const o of state.orders)
    o.produced = state.sessions
      .filter((s: Row) => s.order_id === o.id)
      .reduce((n: number, s: Row) => n + s.quantity, 0);
}
export function resetDemo() {
  localStorage.removeItem(STORAGE);
  localStorage.removeItem("production-queue:" + state.admin.id);
  location.reload();
}
export async function demoApi(
  path: string,
  method = "GET",
  body: Row = {},
  key?: string,
): Promise<any> {
  if (method !== "GET" && key && state.requests[key])
    return structuredClone(state.requests[key]);
  enrich();
  const [url, query] = path.split("?"),
    parts = url.split("/").filter(Boolean),
    now = iso();
  let result: any = { ok: true };
  if (url === "/me" || url === "/login") result = state.admin;
  else if (url === "/health") result = { ok: true, now };
  else if (url === "/logout") result = { ok: true };
  else if (url === "/device") result = device();
  else if (url === "/bootstrap")
    result = {
      orders: state.orders,
      reasons: state.pause_types.filter((p: Row) => p.active),
      current:
        state.sessions
          .filter(
            (s: Row) => s.user_id === state.admin.id && s.status !== "finished",
          )
          .map(snapshot)[0] || null,
      device: device(),
      settings: state.settings,
      server_time: now,
    };
  else if (url === "/overview")
    result = {
      stations: state.stations.filter((s: Row) => s.active),
      sessions: state.sessions
        .filter((s: Row) => s.status !== "finished")
        .map(snapshot),
      settings: state.settings,
      server_time: now,
    };
  else if (parts[0] === "manage") {
    const entity = parts[1];
    if (
      !["users", "stations", "machines", "orders", "pause_types"].includes(
        entity,
      )
    )
      throw Error("Lista inexistente.");
    if (method === "GET") result = state[entity];
    else {
      const data = { ...body };
      delete data.pin;
      const existing = state[entity].find((r: Row) => r.id === parts[2]);
      if (
        state[entity].some(
          (r: Row) =>
            r.id !== existing?.id &&
            (data.code ? r.code === data.code : r.name === data.name),
        )
      )
        throw Error("Já existe um registo com esse código ou nome.");
      if (
        entity === "users" &&
        existing?.id === state.admin.id &&
        (!data.active || data.role !== "admin")
      )
        throw Error("Mantenha o administrador da demonstração ativo.");
      if (
        entity === "orders" &&
        ["paused", "finished", "cancelled"].includes(data.status) &&
        state.sessions.some(
          (s: Row) => s.order_id === existing?.id && s.status !== "finished",
        )
      )
        throw Error("Termine os turnos desta ordem primeiro.");
      if (
        existing &&
        ["stations", "orders"].includes(entity) &&
        Number(existing.target) !== Number(data.target)
      )
        changeTarget(entity, existing, data.target);
      const row = {
        ...existing,
        ...data,
        id: existing?.id || uid(),
        created_at: existing?.created_at || now,
        updated_at: now,
      };
      if (existing) Object.assign(existing, row);
      else state[entity].push(row);
      log(
        method === "POST" ? "create:" + entity : "update:" + entity,
        row.id,
        data,
      );
      result = { id: row.id };
    }
  } else if (parts[0] === "stations" && parts[2] === "target") {
    const station = state.stations.find((s: Row) => s.id === parts[1]);
    changeTarget("stations", station, body.target);
    station.target = body.target;
  } else if (url === "/settings") {
    if (method === "GET") result = state.settings;
    else {
      Object.assign(state.settings, body);
      log("settings", "1", body);
    }
  } else if (url === "/devices") result = state.devices;
  else if (url === "/device/bind") {
    const station = state.stations.find((s: Row) => s.id === body.station_id);
    if (!station) throw Error("Posto inválido.");
    state.devices.forEach((d: Row) => (d.active = false));
    state.devices.push({
      id: uid(),
      label: body.label,
      station_id: station.id,
      station: station.name,
      active: true,
      created_at: now,
    });
    state.deviceStation = station.id;
    log("bind_device", station.id);
  } else if (parts[0] === "devices" && parts[2] === "revoke") {
    const d = state.devices.find((d: Row) => d.id === parts[1]);
    d.active = false;
    log("revoke_device", d.id);
  } else if (url === "/work/start") {
    const station = device(),
      order = state.orders.find((o: Row) => o.id === body.order_id);
    if (!station?.active || station.status !== "available")
      throw Error("Associe um posto disponível nas configurações.");
    if (
      state.sessions.some(
        (s: Row) =>
          s.status !== "finished" &&
          (s.station_id === station.id || s.user_id === state.admin.id),
      )
    )
      throw Error("Posto ou operador já tem turno ativo.");
    if (!order || !["pending", "production"].includes(order.status))
      throw Error("Ordem indisponível.");
    const s = {
      id: uid(),
      user_id: state.admin.id,
      station_id: station.id,
      machine_id: station.machine_id,
      order_id: order.id,
      employee: state.admin.name,
      employee_code: state.admin.code,
      station: station.name,
      station_code: station.code,
      machine: station.machine,
      sector: station.sector,
      line: station.line,
      order_code: order.code,
      product: order.product,
      reference: order.reference,
      shift: body.shift,
      status: "production",
      started_at: now,
      ended_at: null,
      productive_ms: 0,
      pause_ms: 0,
      expected: 0,
      target: order.target || station.target,
      quantity: 0,
      version: 0,
      snapshot: Date.now(),
      efficiency: null,
      per_hour: 0,
      total_ms: 0,
    };
    state.sessions.push(s);
    order.status = "production";
    result = { id: s.id };
    log("start", s.id);
  } else if (parts[0] === "work") {
    const s = state.sessions.find((s: Row) => s.id === parts[1]);
    if (!s || s.status === "finished") throw Error("Turno indisponível.");
    settle(s);
    const action = parts[2];
    if (action === "quantity") {
      if (s.status !== "production") throw Error("Retome a produção.");
      if (body.mode === "set" && s.version !== body.version)
        throw Error("O total mudou. Atualize e tente novamente.");
      const previous = s.quantity;
      s.quantity =
        body.mode === "add" ? s.quantity + body.quantity : body.quantity;
      state.records.push({
        id: uid(),
        session_id: s.id,
        user_id: state.admin.id,
        previous,
        quantity: s.quantity,
        delta: s.quantity - previous,
        created_at: now,
      });
    } else if (action === "pause") {
      if (s.status !== "production") throw Error("Já está em pausa.");
      const reason = state.pause_types.find(
        (p: Row) => p.id === body.type_id && p.active,
      );
      if (!reason) throw Error("Motivo inválido.");
      s.status = "pause";
      s.pause_reason = reason.name;
      s.pause_started = now;
      state.pauses.push({
        id: uid(),
        session_id: s.id,
        type_id: reason.id,
        reason: reason.name,
        started_at: now,
        ended_at: null,
      });
    } else if (["resume", "finish"].includes(action)) {
      state.pauses
        .filter((p: Row) => p.session_id === s.id && !p.ended_at)
        .forEach((p: Row) => (p.ended_at = now));
      s.status = action === "resume" ? "production" : "finished";
      s.ended_at = action === "finish" ? now : null;
      s.pause_reason = null;
      s.pause_started = null;
    } else throw Error("Operação desconhecida.");
    s.version++;
    log(action, s.id, body);
  } else if (parts[0] === "history") {
    const s = state.sessions.find((s: Row) => s.id === parts[1]);
    if (!s) throw Error("Turno inexistente.");
    result = {
      session: snapshot(s),
      records: state.records.filter((r: Row) => r.session_id === s.id),
      pauses: state.pauses.filter((p: Row) => p.session_id === s.id),
      targets: state.targets.filter((t: Row) => t.session_id === s.id),
    };
  } else if (url === "/reports") {
    const params = new URLSearchParams(query),
      from = +new Date(params.get("from")!),
      to = +new Date(params.get("to")!);
    const sessions = state.sessions
      .filter(
        (s: Row) =>
          +new Date(s.started_at) >= from && +new Date(s.started_at) < to,
      )
      .map(snapshot);
    const ids = new Set(sessions.map((s: Row) => s.id));
    result = {
      sessions,
      pauses: state.pauses.filter((p: Row) => ids.has(p.session_id)),
    };
  } else if (url === "/audit") {
    const offset = Number(new URLSearchParams(query).get("offset") || 0);
    result = state.audit.slice(offset, offset + 100);
  } else throw Error("Operação não disponível nesta demonstração.");
  if (method !== "GET") {
    if (key) state.requests[key] = result;
    persist();
    window.dispatchEvent(new Event("demo-update"));
  }
  return structuredClone(result);
}
function changeTarget(entity: string, record: Row, target: number | null) {
  for (const s of state.sessions) {
    const order = state.orders.find((o: Row) => o.id === s.order_id);
    if (
      s.status === "finished" ||
      (entity === "stations"
        ? s.station_id !== record.id || order.target !== null
        : s.order_id !== record.id)
    )
      continue;
    settle(s);
    const next =
      target || state.stations.find((st: Row) => st.id === s.station_id).target;
    state.targets.push({
      id: uid(),
      session_id: s.id,
      previous: s.target,
      target: next,
      created_at: iso(),
    });
    s.target = next;
    s.version++;
  }
  log("target_change", record.id, { previous: record.target, target });
}
