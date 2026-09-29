export const IS_DEMO = import.meta.env.VITE_PUBLIC_DEMO === "true";
export type Row = Record<string, any>;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
) {
  if (IS_DEMO)
    return (await import("./demo")).demoApi(
      path,
      method,
      (body || {}) as Row,
      key,
    );
  let r: Response;
  try {
    r = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError("Sem ligação ao servidor.", 0);
  }
  const data = await r
    .json()
    .catch(() => ({ error: "Resposta inválida do servidor." }));
  if (!r.ok) throw new ApiError(data.error, r.status);
  return data;
}
export const duration = (ms: number) => {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
    .map((x) => String(x).padStart(2, "0"))
    .join(":");
};
export const number = (n: number, d = 0) =>
  new Intl.NumberFormat("pt-PT", { maximumFractionDigits: d }).format(n || 0);
export const date = (v: string) => new Date(v).toLocaleString("pt-PT");
export function live(s: Row | null, elapsed: number): Row | null {
  if (!s) return null;
  const add = Math.max(0, elapsed),
    productive_ms = s.productive_ms + (s.status === "production" ? add : 0),
    pause_ms = s.pause_ms + (s.status === "pause" ? add : 0),
    expected =
      s.expected + (s.status === "production" ? (add * s.target) / 3600000 : 0);
  return {
    ...s,
    productive_ms,
    pause_ms,
    expected,
    total_ms: productive_ms + pause_ms,
    efficiency: expected > 0 ? (s.quantity / expected) * 100 : null,
    per_hour: productive_ms ? (s.quantity * 3600000) / productive_ms : 0,
  };
}
export const states: Row = {
  production: "Em produção",
  pause: "Em pausa",
  finished: "Terminado",
  available: "Sem operador",
  stopped: "Parado",
  maintenance: "Manutenção",
  problem: "Problema",
  pending: "Pendente",
  paused: "Pausada",
  cancelled: "Cancelada",
};
export const roleNames: Row = {
  employee: "Funcionário",
  supervisor: "Supervisor",
  admin: "Administrador",
};
export function efficiency(s: Row, threshold = 90) {
  return s.efficiency === null
    ? ["neutral", "Sem produção esperada"]
    : s.efficiency >= 100
      ? ["good", "Dentro da meta"]
      : s.efficiency >= threshold
        ? ["warning", "Próximo da meta"]
        : ["danger", "Abaixo da meta"];
}

export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
