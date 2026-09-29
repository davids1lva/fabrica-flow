import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  Factory,
  LayoutDashboard,
  Monitor,
  Users,
  ClipboardList,
  Pause,
  BarChart3,
  Settings,
  LogOut,
  Play,
  Plus,
  Search,
  ArrowUpRight,
  ChevronRight,
  Activity,
  Clock,
  Check,
  Wifi,
  WifiOff,
  History,
  Shield,
  Tablet,
  RefreshCw,
  Download,
  X,
  Pencil,
  Target,
  Box,
  ArrowLeft,
  Square,
  AlertTriangle,
} from "lucide-react";
import {
  api,
  IS_DEMO,
  newId,
  ApiError,
  Row,
  duration,
  number,
  date,
  live,
  states,
  roleNames,
  efficiency,
} from "./api";
import "./style.css";
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [modalError, setModalError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
    const listener = (e: Event) =>
      setModalError((e as CustomEvent<string>).detail);
    window.addEventListener("app-error", listener);
    return () => window.removeEventListener("app-error", listener);
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon" onClick={onClose} aria-label="Fechar">
          <X />
        </button>
      </div>
      {modalError && (
        <div className="message error" role="alert">
          {modalError}
        </div>
      )}
      {children}
    </dialog>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span className={"badge " + status}>
      <i />
      {states[status] || status}
    </span>
  );
}
function Metric({
  label,
  value,
  unit,
  icon: Icon = Activity,
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: any;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        <Icon size={17} />
      </div>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </div>
  );
}
function App() {
  const [user, setUser] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("dashboard"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(true),
    [device, setDevice] = useState<Row | null>(null);
  useEffect(() => {
    Promise.all([
      api("/me")
        .then(setUser)
        .catch(() => {}),
      api("/device")
        .then(setDevice)
        .catch(() => setOnline(false)),
    ]).finally(() => setLoading(false));
    const timer = setInterval(
      () =>
        api("/health")
          .then(() => setOnline(true))
          .catch(() => setOnline(false)),
      15000,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const handle = (e: unknown) => {
    const er = e as ApiError;
    setError(er.message || "Ocorreu um erro.");
    window.dispatchEvent(
      new CustomEvent("app-error", {
        detail: er.message || "Ocorreu um erro.",
      }),
    );
    if (er.status === 0) setOnline(false);
    if (er.status === 401) setUser(null);
  };
  async function logout() {
    try {
      await api("/logout", "POST", {});
      if (!IS_DEMO) setUser(null);
      setPage("dashboard");
      setError("");
    } catch (e) {
      handle(e);
    }
  }
  const props = { user: user!, onError: handle, notify: setNotice, online };
  if (loading)
    return (
      <div className="loading">
        <Factory size={40} />
        <p>A abrir a fábrica…</p>
      </div>
    );
  return (
    <>
      <div
        className={
          user && user.role !== "employee" && page !== "operator"
            ? "app-shell"
            : "operator-shell"
        }
      >
        {user && user.role !== "employee" && page !== "operator" && (
          <aside className="sidebar">
            <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
              <span className="brand-mark">
                <Factory size={24} />
              </span>
              <div>
                fábrica<span>FLOW / PRODUÇÃO</span>
              </div>
            </a>
            <div className="nav-caption">ESPAÇO DE TRABALHO</div>
            <nav>
              {[
                ["dashboard", "Visão geral", LayoutDashboard],
                ["production", "Produção", Activity],
                ["stations", "Postos", Monitor],
                ["machines", "Máquinas", Factory],
                ...(user.role === "admin"
                  ? [["users", "Funcionários", Users]]
                  : []),
                ["orders", "Ordens de produção", ClipboardList],
                ["pause_types", "Motivos de pausa", Pause],
                ["reports", "Relatórios", BarChart3],
                ["operator", "Modo operador", Tablet],
                ...(user.role === "admin"
                  ? [
                      ["audit", "Histórico", History],
                      ["settings", "Configurações", Settings],
                    ]
                  : []),
              ].map(([key, label, Icon]: any) => (
                <button
                  key={key}
                  className={page === key ? "active" : ""}
                  onClick={() => {
                    setPage(key);
                    setError("");
                  }}
                >
                  <Icon size={19} />
                  {label}
                  {page === key && <span className="nav-active" />}
                </button>
              ))}
            </nav>
            <button className="tablet-link" onClick={() => setPage("operator")}>
              <Tablet size={20} />
              <div>
                Modo operador<small>Abrir interface do tablet</small>
              </div>
              <ArrowUpRight size={17} />
            </button>
            <div className="sidebar-bottom">
              <span className="avatar">
                {user.name
                  .split(" ")
                  .map((x: string) => x[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                {user.name}
                <small>{roleNames[user.role]}</small>
              </div>
              <button
                className="icon"
                onClick={logout}
                aria-label="Terminar sessão"
              >
                <LogOut size={18} />
              </button>
            </div>
          </aside>
        )}
        <div className="workspace">
          <header className="topbar">
            <div>
              {user ? (
                <>
                  <span className="muted">Fábrica</span>
                  <ChevronRight size={15} />
                  <b>
                    {page === "operator" || user.role === "employee"
                      ? "Posto de trabalho"
                      : "Controlo de produção"}
                  </b>
                </>
              ) : (
                <b className="compact-brand">
                  <Factory /> fábrica flow
                </b>
              )}
            </div>
            <div>
              <span className={"connection " + (!online ? "offline" : "")}>
                {online ? <Wifi size={15} /> : <WifiOff size={15} />}{" "}
                {IS_DEMO
                  ? "Modo demonstração"
                  : online
                    ? "Online"
                    : "Sem ligação ao servidor"}
              </span>
              <span className="today">
                {new Date().toLocaleDateString("pt-PT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {user && (
                <button className="secondary" onClick={logout}>
                  <LogOut size={17} />
                  Sair
                </button>
              )}
            </div>
          </header>
          {error && (
            <div className="message error" role="alert">
              <AlertTriangle size={18} />
              {error}
              <button
                className="icon"
                onClick={() => setError("")}
                aria-label="Fechar erro"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {IS_DEMO && (
            <div className="demo-banner">
              <div>
                <b>Demonstração interativa</b>
                <span>
                  Dados fictícios · As alterações ficam apenas neste navegador.
                </span>
              </div>
              <button
                onClick={async () => {
                  if (confirm("Repor os dados de demonstração?"))
                    (await import("./demo")).resetDemo();
                }}
              >
                Repor demonstração
              </button>
            </div>
          )}
          {!user ? (
            <Login
              device={device}
              onLogin={(u) => {
                setUser(u);
                setError("");
              }}
              onError={handle}
            />
          ) : user.role === "employee" || page === "operator" ? (
            <Operator
              {...props}
              onFinish={logout}
              back={
                user.role !== "employee"
                  ? () => setPage("dashboard")
                  : undefined
              }
            />
          ) : (
            <main className="main">
              {page === "dashboard" || page === "production" ? (
                <Overview {...props} detailed={page === "production"} />
              ) : [
                  "stations",
                  "machines",
                  "users",
                  "orders",
                  "pause_types",
                ].includes(page) ? (
                <Manage {...props} entity={page} />
              ) : page === "reports" ? (
                <Reports {...props} />
              ) : page === "audit" ? (
                <Audit {...props} />
              ) : (
                <Configuration {...props} onBind={setDevice} />
              )}
            </main>
          )}
        </div>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={19} />
          {notice}
        </div>
      )}
    </>
  );
}
function Login({
  device,
  onLogin,
  onError,
}: {
  device: Row | null;
  onLogin: (u: Row) => void;
  onError: (e: unknown) => void;
}) {
  const [code, setCode] = useState(""),
    [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-layout">
      <section className="login-intro">
        <span className="eyebrow">CHÃO DE FÁBRICA / LIGAÇÃO DIRETA</span>
        <h1>
          Cada posto.
          <br />
          Cada peça.
          <br />
          <em>Tudo ligado.</em>
        </h1>
        <p>
          Acompanhe a produção, registe o trabalho e mantenha a equipa em
          sintonia.
        </p>
        <div className="login-station">
          <Monitor />
          <div>
            {device ? device.name : "Tablet por configurar"}
            <span>
              {device
                ? device.machine
                : "O administrador deve associar este tablet a um posto."}
            </span>
          </div>
        </div>
        <div className="intro-bottom">
          FÁBRICA FLOW<span>SISTEMA DE PRODUÇÃO</span>
        </div>
      </section>
      <section className="login-form">
        <div className="login-form-inner">
          <div className="kicker">BEM-VINDO AO SEU POSTO</div>
          <h2>Vamos começar?</h2>
          <p className="muted">Introduza o seu número e PIN de acesso.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                onLogin(await api("/login", "POST", { code, pin }));
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Número de funcionário">
              <input
                autoFocus
                inputMode="numeric"
                pattern="[0-9]{1,12}"
                maxLength={12}
                autoComplete="username"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex.: 1001"
                required
              />
            </Field>
            <Field label="PIN de acesso">
              <input
                type="password"
                inputMode="numeric"
                pattern="([0-9]{4}|[0-9]{6})"
                maxLength={6}
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••"
                required
              />
            </Field>
            <button className="primary full" disabled={busy}>
              {busy ? "A entrar…" : "Iniciar sessão"}
              <ArrowUpRight size={19} />
            </button>
          </form>
          <p className="login-help">
            <Shield size={16} />
            Acesso reservado a utilizadores autorizados.
          </p>
        </div>
      </section>
    </main>
  );
}
type Props = {
  user: Row;
  onError: (e: unknown) => void;
  notify: (s: string) => void;
  online: boolean;
};
function Operator({
  user,
  onError,
  notify,
  online,
  onFinish,
  back,
}: Props & { onFinish: () => void; back?: () => void }) {
  const [data, setData] = useState<Row | null>(null),
    [stamp, setStamp] = useState(0),
    [now, setNow] = useState(Date.now()),
    [order, setOrder] = useState(""),
    [shift, setShift] = useState("Manhã"),
    [qty, setQty] = useState(""),
    [modal, setModal] = useState(""),
    [busy, setBusy] = useState(false),
    [queued, setQueued] = useState<Row[]>(() => {
      try {
        return JSON.parse(
          localStorage.getItem("production-queue:" + user.id) || "[]",
        );
      } catch {
        return [];
      }
    });
  const queueRef = useRef(queued),
    syncing = useRef(false);
  const saveQueue = (q: Row[]) => {
    localStorage.setItem("production-queue:" + user.id, JSON.stringify(q));
    queueRef.current = q;
    setQueued(q);
  };
  const load = useCallback(async () => {
    const d = await api("/bootstrap");
    setData(d);
    setStamp(Date.now());
  }, []);
  useEffect(() => {
    load().catch(onError);
    const t = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => {
      if (navigator.onLine) load().catch(() => {});
    }, 15000);
    return () => {
      clearInterval(t);
      clearInterval(refresh);
    };
  }, [load]);
  const sync = useCallback(async () => {
    if (syncing.current || !queueRef.current.length) return;
    syncing.current = true;
    try {
      while (queueRef.current.length) {
        const entry = queueRef.current[0];
        await api(entry.path, "POST", entry.body, entry.key);
        saveQueue(queueRef.current.slice(1));
      }
      await load();
      notify("Registos pendentes sincronizados.");
    } catch (e) {
      onError(e);
    } finally {
      syncing.current = false;
    }
  }, [load]);
  useEffect(() => {
    if (online) sync();
    const timer = setInterval(() => {
      if (navigator.onLine) sync();
    }, 15000);
    return () => clearInterval(timer);
  }, [online, sync]);
  const current = live(data?.current || null, now - stamp);
  async function action(path: string, body: Row = {}, offlineAllowed = false) {
    setBusy(true);
    const entry = { path, body, key: newId() };
    try {
      if (offlineAllowed) {
        saveQueue([...queueRef.current, entry]);
        await sync();
      } else {
        if (queueRef.current.length)
          throw Error(
            "Sincronize as quantidades pendentes antes de continuar.",
          );
        await api(path, "POST", body, entry.key);
        await load();
      }
      setModal("");
      setQty("");
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="main">
        <p>A carregar o posto…</p>
      </main>
    );
  const s = current,
    device = data.device,
    pending = queued.reduce((n, q) => n + q.body.quantity, 0);
  return (
    <main className="operator-main">
      {back && (
        <button className="text-button" onClick={back}>
          <ArrowLeft size={17} />
          Voltar à supervisão
        </button>
      )}
      <div className="page-heading">
        <div>
          <span className="kicker">
            {device
              ? `${device.code} / ${device.machine}`
              : "CONFIGURAÇÃO DO TABLET"}
          </span>
          <h1>{device?.name || "Posto não associado"}</h1>
          <p>
            {user.name} <span className="muted">· N.º {user.code}</span>
          </p>
        </div>
        {s && <Badge status={s.status} />}
      </div>
      {queued.length > 0 && (
        <div className="message warning">
          <WifiOff size={19} />
          {queued.length} registo(s) pendente(s) · +{pending} unidades. Mantenha
          esta sessão aberta.
          <button className="secondary" onClick={sync} disabled={busy}>
            Sincronizar
          </button>
        </div>
      )}
      {!s ? (
        <section className="panel start-panel">
          <div className="section-icon">
            <ClipboardList />
          </div>
          <h2>Iniciar um novo turno</h2>
          <p className="muted">
            Selecione a ordem que vai produzir neste posto.
          </p>
          {!device ? (
            <p className="message warning">
              Entre com uma conta de administrador e associe o tablet em
              Configurações.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action("/work/start", { order_id: order, shift });
              }}
            >
              <Field label="Ordem de produção">
                <select
                  required
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                >
                  <option value="">Selecionar ordem</option>
                  {data.orders
                    .filter((o: Row) =>
                      ["pending", "production"].includes(o.status),
                    )
                    .map((o: Row) => (
                      <option key={o.id} value={o.id}>
                        {o.code} · {o.product}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Turno">
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                >
                  {["Manhã", "Tarde", "Noite"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              {order && (
                <div className="order-preview">
                  <Box />
                  <div>
                    {data.orders.find((o: Row) => o.id === order)?.reference}
                    <strong>
                      {data.orders.find((o: Row) => o.id === order)?.target ||
                        device.target}{" "}
                      un/h
                    </strong>
                  </div>
                </div>
              )}
              <button className="primary full large" disabled={busy || !online}>
                <Play size={20} />
                Iniciar produção
              </button>
            </form>
          )}
        </section>
      ) : (
        <>
          <div className="order-strip">
            <ClipboardList size={23} />
            <div>
              <small>ORDEM EM CURSO</small>
              <b>{s.order_code}</b>
            </div>
            <div>
              <small>PRODUTO</small>
              <b>{s.product}</b>
            </div>
            <div>
              <small>META POR HORA</small>
              <b>
                {number(s.target)} <span>un/h</span>
              </b>
            </div>
          </div>
          {s.status === "pause" && (
            <div className="pause-banner">
              <Pause size={28} />
              <div>
                <h2>Em pausa · {s.pause_reason}</h2>
                <p>{duration(now - +new Date(s.pause_started))} nesta pausa</p>
              </div>
              <button
                className="primary large"
                disabled={busy || !online}
                onClick={() => action(`/work/${s.id}/resume`)}
              >
                <Play size={20} />
                Retomar produção
              </button>
            </div>
          )}
          <div className="metrics three">
            <Metric
              label="Tempo de trabalho"
              value={duration(s.total_ms)}
              icon={Clock}
            />
            <Metric
              label="Tempo em produção"
              value={duration(s.productive_ms)}
              icon={Play}
            />
            <Metric
              label="Tempo em pausa"
              value={duration(s.pause_ms)}
              icon={Pause}
            />
          </div>
          <div className="operator-grid">
            <section className="panel production-panel">
              <div className="panel-heading">
                <h2>Produção registada</h2>
                <Box size={20} />
              </div>
              <div className="big-quantity">
                {number(s.quantity)}
                <span>unidades</span>
              </div>
              <div className="quick-buttons">
                {[1, 5, 10, 50].map((n) => (
                  <button
                    key={n}
                    disabled={busy || s.status !== "production"}
                    onClick={() =>
                      action(
                        `/work/${s.id}/quantity`,
                        { mode: "add", quantity: n },
                        true,
                      )
                    }
                  >
                    +{n}
                  </button>
                ))}
              </div>
              <form
                className="total-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setModal("quantity");
                }}
              >
                <Field label="Ou introduza a quantidade total">
                  <input
                    type="number"
                    min="0"
                    max="1000000000"
                    step="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="Quantidade total"
                    required
                    disabled={s.status !== "production"}
                  />
                </Field>
                <button
                  className="secondary"
                  disabled={
                    busy ||
                    !online ||
                    s.status !== "production" ||
                    queued.length > 0
                  }
                >
                  Guardar total
                </button>
              </form>
            </section>
            <section className="panel efficiency-panel">
              <div className="panel-heading">
                <h2>Ritmo de produção</h2>
                <Target size={20} />
              </div>
              <div
                className={
                  "efficiency-large " +
                  efficiency(s, data.settings.warning_threshold)[0]
                }
              >
                {s.efficiency === null ? "—" : number(s.efficiency, 1) + "%"}
                <span>{efficiency(s, data.settings.warning_threshold)[1]}</span>
              </div>
              <progress max="100" value={Math.min(100, s.efficiency || 0)} />
              <dl>
                <div>
                  <dt>Produção esperada</dt>
                  <dd>{number(s.expected)} un.</dd>
                </div>
                <div>
                  <dt>Produção real</dt>
                  <dd>{number(s.quantity)} un.</dd>
                </div>
                <div>
                  <dt>Ritmo médio</dt>
                  <dd>{number(s.per_hour, 1)} un/h</dd>
                </div>
              </dl>
            </section>
          </div>
          <div className="operator-actions">
            <span>
              <Clock size={17} />
              Início: {date(s.started_at)}
            </span>
            {s.status === "production" && (
              <button
                className="pause-button large"
                onClick={() => setModal("pause")}
                disabled={busy || !online}
              >
                <Pause size={20} />
                Pausa
              </button>
            )}
            <button
              className="secondary large"
              onClick={() => setModal("finish")}
              disabled={busy || !online || queued.length > 0}
            >
              <Square size={18} />
              Terminar turno
            </button>
          </div>
          {modal === "pause" && (
            <Modal title="Qual o motivo da pausa?" onClose={() => setModal("")}>
              <div className="reason-grid">
                {data.reasons.map((p: Row) => (
                  <button
                    key={p.id}
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      action(`/work/${s.id}/pause`, { type_id: p.id })
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </Modal>
          )}
          {modal === "quantity" && (
            <Modal
              title="Confirmar quantidade total"
              onClose={() => setModal("")}
            >
              <p>
                Substituir <b>{number(s.quantity)}</b> por{" "}
                <b>{number(Number(qty))} unidades</b>? Esta alteração fica
                registada no histórico.
              </p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setModal("")}>
                  Cancelar
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    action(`/work/${s.id}/quantity`, {
                      mode: "set",
                      quantity: Number(qty),
                      version: s.version,
                    })
                  }
                >
                  Confirmar total
                </button>
              </div>
            </Modal>
          )}
          {modal === "finish" && (
            <Modal title="Resumo do turno" onClose={() => setModal("")}>
              <dl className="summary">
                {[
                  ["Tempo total", duration(s.total_ms)],
                  ["Tempo produtivo", duration(s.productive_ms)],
                  ["Pausas", duration(s.pause_ms)],
                  ["Produção", number(s.quantity) + " un."],
                  ["Produção esperada", number(s.expected) + " un."],
                  [
                    "Eficiência",
                    s.efficiency === null ? "—" : number(s.efficiency, 1) + "%",
                  ],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setModal("")}>
                  Cancelar
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api(`/work/${s.id}/finish`, "POST", {}, newId());
                      notify("Turno guardado.");
                      onFinish();
                    } catch (e) {
                      onError(e);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Confirmar fim do turno
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </main>
  );
}
function useOverview(onError: Props["onError"]): Row {
  const [data, setData] = useState<Row>({
      stations: [],
      sessions: [],
      settings: { warning_threshold: 90 },
    }),
    [stamp, setStamp] = useState(Date.now()),
    [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    const d = await api("/overview");
    setData(d);
    setStamp(Date.now());
  }, []);
  useEffect(() => {
    load().catch(onError);
    const e = IS_DEMO ? null : new EventSource("/api/events");
    e?.addEventListener("update", () => load().catch(onError));
    const demoUpdate = () => load().catch(onError);
    window.addEventListener("demo-update", demoUpdate);
    const timer = setInterval(() => setNow(Date.now()), 1000),
      fallback = setInterval(() => load().catch(() => {}), 30000);
    return () => {
      e?.close();
      window.removeEventListener("demo-update", demoUpdate);
      clearInterval(timer);
      clearInterval(fallback);
    };
  }, [load]);
  return {
    ...data,
    sessions: data.sessions.map((s: Row) => live(s, now - stamp)),
    load,
  };
}
function Overview({
  onError,
  notify,
  detailed,
}: Props & { detailed: boolean }) {
  const data = useOverview(onError),
    [search, setSearch] = useState(""),
    [filters, setFilters] = useState<Row>({}),
    [target, setTarget] = useState<Row | null>(null),
    [history, setHistory] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const all = data.stations.map((s: Row) => ({
    ...s,
    session: data.sessions.find((w: Row) => w.station_id === s.id),
  }));
  const rows = all.filter((s: Row) => {
    const w = s.session,
      status = w?.status || s.status;
    return (
      (!search ||
        [s.code, s.name, s.machine, w?.employee, w?.order_code]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      Object.entries(filters).every(
        ([k, v]) =>
          !v ||
          (k === "status" ? status : k === "shift" ? w?.shift : s[k]) === v,
      )
    );
  });
  const sessions = rows.map((s: Row) => s.session).filter(Boolean),
    quantity = sessions.reduce((a: number, s: Row) => a + s.quantity, 0),
    expected = sessions.reduce((a: number, s: Row) => a + s.expected, 0),
    active = sessions.filter((s: Row) => s.status === "production").length,
    paused = sessions.filter((s: Row) => s.status === "pause").length;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="kicker">
            {data.settings.company || "Fábrica"} / EM TEMPO REAL
          </span>
          <h1>{detailed ? "Produção em curso" : "Visão geral"}</h1>
          <p>O pulso da fábrica, posto a posto.</p>
        </div>
        <div className="live-tag">
          <span />
          Atualização automática
        </div>
      </div>
      <div className="metrics">
        <Metric
          label="Postos em produção"
          value={String(active).padStart(2, "0")}
          unit={"/ " + rows.length}
          icon={Monitor}
        />
        <Metric
          label="Unidades produzidas"
          value={number(quantity)}
          unit="un."
          icon={Box}
        />
        <Metric
          label="Eficiência dos turnos"
          value={expected ? number((quantity / expected) * 100, 1) + "%" : "—"}
          icon={Activity}
        />
        <Metric
          label="Postos em pausa"
          value={String(paused).padStart(2, "0")}
          unit="postos"
          icon={Pause}
        />
      </div>
      <section className="floor-section">
        <div className="section-heading">
          <h2>
            Chão de fábrica <span>{rows.length} postos</span>
          </h2>
          <div className="legend">
            <span>
              <i className="dot green" />
              Produção
            </span>
            <span>
              <i className="dot amber" />
              Pausa
            </span>
            <span>
              <i className="dot gray" />
              Sem operador
            </span>
          </div>
        </div>
        <div className="filter-bar">
          <label className="search">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar posto, operador, ordem…"
            />
          </label>
          {[
            [
              "sector",
              "Todos os setores",
              Array.from(new Set(all.map((s: Row) => s.sector))),
            ],
            [
              "line",
              "Todas as linhas",
              Array.from(new Set(all.map((s: Row) => s.line))),
            ],
            [
              "status",
              "Todos os estados",
              [
                "production",
                "pause",
                "available",
                "stopped",
                "maintenance",
                "problem",
              ],
            ],
            ["shift", "Todos os turnos", ["Manhã", "Tarde", "Noite"]],
          ].map(([key, label, values]: any) => (
            <select
              key={key}
              aria-label={label}
              value={filters[key] || ""}
              onChange={(e) =>
                setFilters({ ...filters, [key]: e.target.value })
              }
            >
              <option value="">{label}</option>
              {values.map((v: string) => (
                <option key={v} value={v}>
                  {states[v] || v}
                </option>
              ))}
            </select>
          ))}
        </div>
        <div className="station-grid">
          {rows.map((station: Row) => {
            const s = station.session,
              status = s?.status || station.status;
            return (
              <article className={"station-card " + status} key={station.id}>
                <div className="station-top">
                  <span className="station-symbol">
                    <Monitor size={21} />
                  </span>
                  <div>
                    <h3>{station.name}</h3>
                    <span>
                      {station.machine} · {station.line}
                    </span>
                  </div>
                  <Badge status={status} />
                </div>
                {s ? (
                  <>
                    <div className="station-person">
                      <span className="avatar light">
                        {s.employee
                          .split(" ")
                          .map((x: string) => x[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <b>{s.employee}</b>
                        <small>
                          {s.order_code} · {s.product}
                        </small>
                      </div>
                    </div>
                    {s.status === "pause" ? (
                      <div className="station-pause">
                        <Pause size={18} />
                        <b>{s.pause_reason}</b>
                        <span>
                          {duration(Date.now() - +new Date(s.pause_started))}
                        </span>
                      </div>
                    ) : (
                      <div className="station-progress">
                        <div>
                          <span>Eficiência</span>
                          <b
                            className={
                              efficiency(s, data.settings.warning_threshold)[0]
                            }
                          >
                            {s.efficiency === null
                              ? "—"
                              : number(s.efficiency, 1) + "%"}
                          </b>
                        </div>
                        <progress
                          max="100"
                          value={Math.min(100, s.efficiency || 0)}
                        />
                        <small>
                          {efficiency(s, data.settings.warning_threshold)[1]}
                        </small>
                      </div>
                    )}
                    <div className="station-numbers">
                      <div>
                        <small>PRODUZIDO</small>
                        <b>
                          {number(s.quantity)} <span>un.</span>
                        </b>
                      </div>
                      <div>
                        <small>ESPERADO</small>
                        <b>
                          {number(s.expected)} <span>un.</span>
                        </b>
                      </div>
                      <div>
                        <small>TEMPO ATIVO</small>
                        <b>{duration(s.productive_ms)}</b>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="station-empty">
                    <Users size={25} />
                    <p>
                      {status === "available"
                        ? "A aguardar operador"
                        : states[status]}
                    </p>
                    <small>{station.sector}</small>
                  </div>
                )}
                <footer>
                  <span>
                    Meta: <b>{number(s?.target || station.target)} un/h</b>
                  </span>
                  <div>
                    <button
                      className="text-button"
                      onClick={() =>
                        setTarget({ ...station, newTarget: station.target })
                      }
                    >
                      Alterar meta
                    </button>
                    {s && (
                      <button
                        className="icon"
                        onClick={() => setHistory(s.id)}
                        aria-label="Consultar turno"
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    )}
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
        {!rows.length && (
          <div className="empty">
            <Search />
            <h3>Sem postos neste filtro</h3>
            <p>Experimente outro setor ou termo de pesquisa.</p>
          </div>
        )}
      </section>
      {target && (
        <Modal title={"Meta · " + target.name} onClose={() => setTarget(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(`/stations/${target.id}/target`, "POST", {
                  target: Number(target.newTarget),
                });
                await data.load();
                setTarget(null);
                notify("Meta atualizada.");
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="muted">
              Aplica-se a partir de agora. As ordens com meta própria mantêm
              essa meta.
            </p>
            <Field label="Unidades por hora">
              <input
                autoFocus
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                required
                value={target.newTarget}
                onChange={(e) =>
                  setTarget({ ...target, newTarget: e.target.value })
                }
              />
            </Field>
            <button className="primary full" disabled={busy}>
              Guardar meta
            </button>
          </form>
        </Modal>
      )}
      {history && (
        <SessionHistory
          id={history}
          onClose={() => setHistory(null)}
          onError={onError}
        />
      )}
    </>
  );
}
const entityConfig: Row = {
  users: {
    title: "Funcionários e utilizadores",
    singular: "utilizador",
    icon: Users,
    fields: [
      ["code", "Número", "text"],
      ["name", "Nome", "text"],
      ["department", "Departamento", "text"],
      ["role", "Perfil", "role"],
      ["pin", "PIN (4 ou 6 dígitos)", "password"],
      ["active", "Ativo", "boolean"],
    ],
    columns: [
      ["code", "Número"],
      ["name", "Nome"],
      ["department", "Departamento"],
      ["role", "Perfil"],
      ["active", "Estado"],
    ],
    defaults: {
      code: "",
      name: "",
      department: "",
      role: "employee",
      pin: "",
      active: true,
    },
  },
  machines: {
    title: "Máquinas",
    singular: "máquina",
    icon: Factory,
    fields: [
      ["code", "Código", "text"],
      ["name", "Nome", "text"],
      ["active", "Ativa", "boolean"],
    ],
    columns: [
      ["code", "Código"],
      ["name", "Nome"],
      ["active", "Estado"],
    ],
    defaults: { code: "", name: "", active: true },
  },
  stations: {
    title: "Postos de trabalho",
    singular: "posto",
    icon: Monitor,
    fields: [
      ["code", "Código", "text"],
      ["name", "Nome", "text"],
      ["machine_id", "Máquina", "machine"],
      ["sector", "Setor", "text"],
      ["line", "Linha", "text"],
      ["target", "Meta por hora", "number"],
      ["status", "Estado", "stationStatus"],
      ["active", "Ativo", "boolean"],
    ],
    columns: [
      ["code", "Código"],
      ["name", "Posto"],
      ["sector", "Setor"],
      ["line", "Linha"],
      ["target", "Meta / hora"],
      ["status", "Estado"],
    ],
    defaults: {
      code: "",
      name: "",
      machine_id: "",
      sector: "",
      line: "",
      target: 120,
      status: "available",
      active: true,
    },
  },
  orders: {
    title: "Ordens de produção",
    singular: "ordem",
    icon: ClipboardList,
    fields: [
      ["code", "Número da ordem", "text"],
      ["product", "Produto", "text"],
      ["reference", "Referência", "text"],
      ["quantity", "Quantidade pretendida", "number"],
      ["target", "Meta própria / hora (opcional)", "number"],
      ["status", "Estado", "orderStatus"],
      ["start_date", "Data de início", "date"],
      ["due_date", "Conclusão prevista", "date"],
    ],
    columns: [
      ["code", "Ordem"],
      ["product", "Produto"],
      ["reference", "Referência"],
      ["quantity", "Pretendido"],
      ["produced", "Produzido"],
      ["target", "Meta / hora"],
      ["status", "Estado"],
    ],
    defaults: {
      code: "",
      product: "",
      reference: "",
      quantity: 1000,
      target: "",
      status: "pending",
      start_date: "",
      due_date: "",
    },
  },
  pause_types: {
    title: "Motivos de pausa",
    singular: "motivo",
    icon: Pause,
    fields: [
      ["name", "Motivo", "text"],
      ["active", "Ativo", "boolean"],
    ],
    columns: [
      ["name", "Motivo"],
      ["active", "Estado"],
    ],
    defaults: { name: "", active: true },
  },
};
function Manage({ entity, user, onError, notify }: Props & { entity: string }) {
  const [rows, setRows] = useState<Row[]>([]),
    [search, setSearch] = useState(""),
    [edit, setEdit] = useState<Row | null>(null),
    [machines, setMachines] = useState<Row[]>([]),
    [busy, setBusy] = useState(false),
    c = entityConfig[entity];
  const load = useCallback(
    () => api("/manage/" + entity).then(setRows),
    [entity],
  );
  useEffect(() => {
    setRows([]);
    setSearch("");
    setEdit(null);
    load().catch(onError);
    if (entity === "stations")
      api("/manage/machines").then(setMachines).catch(onError);
  }, [load, entity]);
  const filtered = rows.filter((r) =>
    Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase()),
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    const body: Row = {};
    for (const [key, , type] of c.fields) {
      let v = edit[key];
      if (type === "number") v = v === "" ? null : Number(v);
      if (type === "date") v = v || null;
      if (key === "pin" && !v) continue;
      body[key] = v;
    }
    try {
      await api(
        "/manage/" + entity + (edit.id ? "/" + edit.id : ""),
        edit.id ? "PUT" : "POST",
        body,
      );
      setEdit(null);
      await load();
      notify("Registo guardado.");
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="kicker">GESTÃO DA FÁBRICA</span>
          <h1>{c.title}</h1>
          <p>
            {rows.length} registos ·{" "}
            {user.role === "admin"
              ? "Organize os recursos da sua operação."
              : "Consulta dos recursos da operação."}
          </p>
        </div>
        {user.role === "admin" && (
          <button
            className="primary"
            onClick={() => setEdit({ ...c.defaults })}
          >
            <Plus size={18} />
            Adicionar {c.singular}
          </button>
        )}
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <label className="search">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar registos…"
            />
          </label>
          <span className="muted">{filtered.length} resultados</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {c.columns.map(([key, label]: string[]) => (
                  <th key={key}>{label}</th>
                ))}
                {user.role === "admin" && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  {c.columns.map(([key]: string[]) => (
                    <td key={key}>
                      {key === "active" ? (
                        <span
                          className={"pill " + (r[key] ? "good" : "neutral")}
                        >
                          {r[key] ? "Ativo" : "Inativo"}
                        </span>
                      ) : key === "role" ? (
                        roleNames[r[key]]
                      ) : key === "status" ? (
                        <Badge status={r[key]} />
                      ) : key === "target" ? (
                        r[key] ? (
                          number(Number(r[key])) + " un/h"
                        ) : (
                          "Meta do posto"
                        )
                      ) : (
                        r[key]
                      )}
                    </td>
                  ))}
                  {user.role === "admin" && (
                    <td>
                      <button
                        className="text-button"
                        onClick={() =>
                          setEdit({
                            ...r,
                            pin: "",
                            start_date: r.start_date?.slice(0, 10) || "",
                            due_date: r.due_date?.slice(0, 10) || "",
                            target: r.target ?? "",
                          })
                        }
                      >
                        <Pencil size={15} />
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty">Sem registos encontrados.</div>
        )}
      </section>
      {edit && (
        <Modal
          title={(edit.id ? "Editar " : "Adicionar ") + c.singular}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save}>
            <div className="form-grid">
              {c.fields.map(([key, label, type]: string[]) => {
                const choices =
                  type === "role"
                    ? ["employee", "supervisor", "admin"]
                    : type === "stationStatus"
                      ? ["available", "stopped", "maintenance", "problem"]
                      : type === "orderStatus"
                        ? [
                            "pending",
                            "production",
                            "paused",
                            "finished",
                            "cancelled",
                          ]
                        : null;
                return (
                  <Field key={key} label={label}>
                    {type === "boolean" ? (
                      <select
                        value={String(edit[key])}
                        onChange={(e) =>
                          setEdit({ ...edit, [key]: e.target.value === "true" })
                        }
                      >
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    ) : type === "machine" ? (
                      <select
                        required
                        value={edit[key]}
                        onChange={(e) =>
                          setEdit({ ...edit, [key]: e.target.value })
                        }
                      >
                        <option value="">Selecionar máquina</option>
                        {machines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.code} · {m.name}
                          </option>
                        ))}
                      </select>
                    ) : choices ? (
                      <select
                        value={edit[key]}
                        onChange={(e) =>
                          setEdit({ ...edit, [key]: e.target.value })
                        }
                      >
                        {choices.map((v) => (
                          <option key={v} value={v}>
                            {roleNames[v] || states[v]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={type}
                        value={edit[key] ?? ""}
                        maxLength={type === "password" ? 6 : 120}
                        pattern={
                          key === "pin"
                            ? "([0-9]{4}|[0-9]{6})"
                            : key === "code" && entity === "users"
                              ? "[0-9]{1,12}"
                              : undefined
                        }
                        min={type === "number" ? 0.01 : undefined}
                        step={key === "quantity" ? "1" : "any"}
                        placeholder={
                          key === "pin" && edit.id
                            ? "Deixar vazio para manter"
                            : undefined
                        }
                        required={
                          !(key === "pin" && edit.id) &&
                          !(
                            entity === "orders" &&
                            ["target", "start_date", "due_date"].includes(key)
                          ) &&
                          key !== "department"
                        }
                        onChange={(e) =>
                          setEdit({ ...edit, [key]: e.target.value })
                        }
                      />
                    )}
                  </Field>
                );
              })}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEdit(null)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "A guardar…" : "Guardar alterações"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function SessionHistory({
  id,
  onClose,
  onError,
}: {
  id: string;
  onClose: () => void;
  onError: Props["onError"];
}) {
  const [data, setData] = useState<Row | null>(null);
  useEffect(() => {
    api("/history/" + id)
      .then(setData)
      .catch(onError);
  }, [id]);
  return (
    <Modal title="Histórico do turno" onClose={onClose}>
      {data ? (
        <>
          <p>
            <b>{data.session.employee}</b> · {data.session.station}
            <br />
            {data.session.order_code} · {date(data.session.started_at)}
          </p>
          <div className="history-section">
            <h3>Quantidades</h3>
            {data.records.length ? (
              data.records.map((r: Row) => (
                <div className="history-row" key={r.id}>
                  <span>{date(r.created_at)}</span>
                  <b>
                    {r.previous} → {r.quantity}{" "}
                    <small>
                      ({r.delta > 0 ? "+" : ""}
                      {r.delta})
                    </small>
                  </b>
                </div>
              ))
            ) : (
              <p className="muted">Ainda sem registos de quantidade.</p>
            )}
          </div>
          <div className="history-section">
            <h3>Pausas</h3>
            {data.pauses.length ? (
              data.pauses.map((p: Row) => (
                <div className="history-row" key={p.id}>
                  <span>
                    {p.reason}
                    <small>{date(p.started_at)}</small>
                  </span>
                  <b>
                    {duration(
                      (p.ended_at ? +new Date(p.ended_at) : Date.now()) -
                        +new Date(p.started_at),
                    )}
                  </b>
                </div>
              ))
            ) : (
              <p className="muted">Sem pausas.</p>
            )}
          </div>
          <div className="history-section">
            <h3>Alterações de meta</h3>
            {data.targets.length ? (
              data.targets.map((t: Row) => (
                <div className="history-row" key={t.id}>
                  <span>{date(t.created_at)}</span>
                  <b>
                    {number(t.previous)} → {number(t.target)} un/h
                  </b>
                </div>
              ))
            ) : (
              <p className="muted">Sem alterações durante este turno.</p>
            )}
          </div>
        </>
      ) : (
        <p>A carregar…</p>
      )}
    </Modal>
  );
}
function Chart({
  title,
  items,
  unit = "un.",
}: {
  title: string;
  items: { label: string; value: number }[];
  unit?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="panel chart-panel">
      <h3>{title}</h3>
      {items.length ? (
        <div className="bar-chart">
          {items.map((i, index) => (
            <div key={i.label + index}>
              <div>
                <span title={i.label}>{i.label}</span>
                <b>
                  {number(i.value, 1)} {unit}
                </b>
              </div>
              <div className="bar-track">
                <div
                  style={{ width: Math.max(1, (i.value / max) * 100) + "%" }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">Sem dados para este período.</div>
      )}
    </section>
  );
}
function Reports({ onError }: Props) {
  const today = new Date().toISOString().slice(0, 10),
    [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today),
    [data, setData] = useState<Row>({ sessions: [], pauses: [] }),
    [filters, setFilters] = useState<Row>({}),
    [history, setHistory] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [group, setGroup] = useState("day");
  async function load() {
    setBusy(true);
    try {
      const end = new Date(to + "T00:00:00");
      end.setDate(end.getDate() + 1);
      setData(
        await api(
          "/reports?from=" +
            encodeURIComponent(new Date(from + "T00:00:00").toISOString()) +
            "&to=" +
            encodeURIComponent(end.toISOString()),
        ),
      );
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const rows: Row[] = data.sessions.filter((s: Row) =>
      Object.entries(filters).every(([key, v]) => !v || s[key] === v),
    ),
    ids = new Set(rows.map((s) => s.id)),
    pauses = data.pauses.filter((p: Row) => ids.has(p.session_id));
  const sum = (key: string) =>
      rows.reduce((n, s) => n + Number(s[key] || 0), 0),
    expected = sum("expected"),
    quantity = sum("quantity");
  function aggregate(key: string, metric = "quantity") {
    const out: Row = {};
    for (const s of rows) {
      const k = s[key];
      out[k] = (out[k] || 0) + Number(s[metric]);
    }
    return Object.entries(out)
      .map(([label, value]) => ({ label, value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }
  const reasons: Row = {};
  for (const p of pauses)
    reasons[p.reason] =
      (reasons[p.reason] || 0) +
      ((p.ended_at ? +new Date(p.ended_at) : Date.now()) -
        +new Date(p.started_at)) /
        60000;
  const timeline: Row = {};
  for (const s of rows) {
    const d = new Date(s.started_at);
    if (group === "week") {
      const n = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - n);
    }
    const k =
      group === "month"
        ? d.toLocaleDateString("sv-SE").slice(0, 7)
        : d.toLocaleDateString("sv-SE");
    timeline[k] = (timeline[k] || 0) + s.quantity;
  }
  const efficiencyItems = aggregate("station").map((i) => {
    const groupRows = rows.filter((s) => s.station === i.label),
      exp = groupRows.reduce((n, s) => n + s.expected, 0);
    return { label: i.label, value: exp ? (i.value / exp) * 100 : 0 };
  });
  function exportCsv() {
    const headers = [
      "Início",
      "Funcionário",
      "Posto",
      "Máquina",
      "Ordem",
      "Produto",
      "Turno",
      "Produção",
      "Esperado",
      "Eficiência %",
      "Tempo produtivo",
      "Pausa",
    ];
    const esc = (v: any) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const csv =
      "\ufeff" +
      [
        headers,
        ...rows.map((s) => [
          date(s.started_at),
          s.employee,
          s.station,
          s.machine,
          s.order_code,
          s.product,
          s.shift,
          s.quantity,
          s.expected.toFixed(2),
          s.efficiency?.toFixed(2) || "",
          duration(s.productive_ms),
          duration(s.pause_ms),
        ]),
      ]
        .map((r) => r.map(esc).join(";"))
        .join("\r\n");
    const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `producao-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="kicker">ANÁLISE DA OPERAÇÃO</span>
          <h1>Relatórios</h1>
          <p>
            Turnos iniciados no período selecionado · horas locais deste
            dispositivo.
          </p>
        </div>
        <button
          className="secondary"
          onClick={exportCsv}
          disabled={!rows.length}
        >
          <Download size={18} />
          Exportar CSV
        </button>
      </div>
      <section className="panel report-filters">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <Field label="Desde">
            <input
              type="date"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Até">
            <input
              type="date"
              required
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <button className="primary" disabled={busy}>
            <RefreshCw size={16} />
            {busy ? "A carregar…" : "Aplicar período"}
          </button>
        </form>
        <div className="filter-bar">
          {[
            ["employee", "Funcionário"],
            ["machine", "Máquina"],
            ["station", "Posto"],
            ["product", "Produto"],
            ["order_code", "Ordem"],
            ["shift", "Turno"],
          ].map(([key, label]) => (
            <select
              key={key}
              aria-label={label}
              value={filters[key] || ""}
              onChange={(e) =>
                setFilters({ ...filters, [key]: e.target.value })
              }
            >
              <option value="">{label}: todos</option>
              {Array.from(
                new Set<string>(data.sessions.map((s: Row) => s[key])),
              ).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ))}
        </div>
      </section>
      <div className="metrics">
        <Metric label="Produção total" value={number(quantity)} unit="un." />
        <Metric
          label="Produção esperada"
          value={number(expected)}
          unit="un."
          icon={Target}
        />
        <Metric
          label="Eficiência ponderada"
          value={expected ? number((quantity / expected) * 100, 1) + "%" : "—"}
        />
        <Metric
          label="Pausas registadas"
          value={String(pauses.length)}
          icon={Pause}
        />
      </div>
      <div className="report-time">
        <span>
          Tempo produtivo <b>{duration(sum("productive_ms"))}</b>
        </span>
        <span>
          Tempo em pausa <b>{duration(sum("pause_ms"))}</b>
        </span>
        <span>
          Turnos <b>{rows.length}</b>
        </span>
        <label>
          Agrupar por{" "}
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
          </select>
        </label>
      </div>
      <div className="charts-grid">
        <Chart
          title="Produção ao longo do tempo"
          items={Object.keys(timeline)
            .sort()
            .map((k) => ({ label: k, value: timeline[k] }))}
        />
        <Chart title="Produção por máquina" items={aggregate("machine")} />
        <Chart title="Produção por funcionário" items={aggregate("employee")} />
        <Chart
          title="Motivos de paragem"
          items={Object.entries(reasons)
            .map(([label, value]) => ({ label, value: Number(value) }))
            .sort((a, b) => b.value - a.value)}
          unit="min"
        />
        <Chart title="Eficiência por posto" items={efficiencyItems} unit="%" />
        <Chart
          title="Tempo de pausa por posto"
          items={aggregate("station", "pause_ms").map((i) => ({
            ...i,
            value: i.value / 60000,
          }))}
          unit="min"
        />
      </div>
      <section className="panel table-panel">
        <div className="panel-heading">
          <h2>Histórico de turnos</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Início</th>
                <th>Funcionário</th>
                <th>Posto / ordem</th>
                <th>Produção</th>
                <th>Estado</th>
                <th>Histórico</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{date(s.started_at)}</td>
                  <td>{s.employee}</td>
                  <td>
                    {s.station}
                    <small>{s.order_code}</small>
                  </td>
                  <td>{number(s.quantity)} un.</td>
                  <td>
                    <Badge status={s.status} />
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setHistory(s.id)}
                    >
                      Consultar
                      <ArrowUpRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">Ainda não existem turnos neste período.</div>
        )}
      </section>
      {history && (
        <SessionHistory
          id={history}
          onClose={() => setHistory(null)}
          onError={onError}
        />
      )}
    </>
  );
}
function Audit({ onError }: Props) {
  const [rows, setRows] = useState<Row[]>([]),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    api("/audit?offset=" + offset)
      .then(setRows)
      .catch(onError);
  }, [offset]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="kicker">RASTREABILIDADE</span>
          <h1>Histórico de ações</h1>
          <p>Registos de acesso, produção e alterações administrativas.</p>
        </div>
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Utilizador</th>
                <th>Ação</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{date(r.created_at)}</td>
                  <td>{r.actor || "Acesso não autenticado"}</td>
                  <td>{r.action}</td>
                  <td>
                    <details>
                      <summary>Consultar</summary>
                      <pre>
                        {JSON.stringify(
                          { entidade: r.entity_id, ...r.details },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button
            className="secondary"
            disabled={!offset}
            onClick={() => setOffset(offset - 100)}
          >
            Anterior
          </button>
          <span>Página {offset / 100 + 1}</span>
          <button
            className="secondary"
            disabled={rows.length < 100}
            onClick={() => setOffset(offset + 100)}
          >
            Seguinte
          </button>
        </div>
      </section>
    </>
  );
}
function Configuration({
  user,
  onError,
  notify,
  onBind,
}: Props & { onBind: (d: Row) => void }) {
  const [settings, setSettings] = useState<Row | null>(null),
    [stations, setStations] = useState<Row[]>([]),
    [devices, setDevices] = useState<Row[]>([]),
    [station, setStation] = useState(""),
    [label, setLabel] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    Promise.all([
      api("/settings").then(setSettings),
      api("/manage/stations").then(setStations),
      api("/devices").then(setDevices),
    ]);
  useEffect(() => {
    load().catch(onError);
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="kicker">ADMINISTRAÇÃO</span>
          <h1>Configurações</h1>
          <p>Identificação da fábrica e associação dos tablets.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Dados da fábrica</h2>
          {settings && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api("/settings", "PUT", {
                    company: settings.company,
                    warning_threshold: Number(settings.warning_threshold),
                    timezone: settings.timezone,
                  });
                  notify("Configurações guardadas.");
                } catch (e) {
                  onError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Nome da empresa">
                <input
                  value={settings.company}
                  required
                  onChange={(e) =>
                    setSettings({ ...settings, company: e.target.value })
                  }
                />
              </Field>
              <Field label="Limite de aviso da eficiência (%)">
                <input
                  type="number"
                  min="1"
                  max="99"
                  required
                  value={settings.warning_threshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      warning_threshold: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Fuso horário de referência">
                <select
                  value={settings.timezone}
                  onChange={(e) =>
                    setSettings({ ...settings, timezone: e.target.value })
                  }
                >
                  {["Europe/Lisbon", "Atlantic/Azores", "UTC"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <button className="primary" disabled={busy}>
                Guardar configurações
              </button>
            </form>
          )}
        </section>
        <section className="panel">
          <h2>Associar este tablet</h2>
          <p className="muted">
            Faça esta configuração no navegador de cada tablet. A associação
            fica guardada neste dispositivo.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/device/bind", "POST", {
                  station_id: station,
                  label,
                });
                onBind(await api("/device"));
                await load();
                notify(
                  "Tablet associado ao posto. Pode iniciar sessão como funcionário.",
                );
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Posto">
              <select
                required
                value={station}
                onChange={(e) => setStation(e.target.value)}
              >
                <option value="">Selecionar posto</option>
                {stations
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Nome do tablet">
              <input
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Tablet 12"
              />
            </Field>
            <button className="primary" disabled={busy}>
              <Tablet size={18} />
              Associar tablet
            </button>
          </form>
        </section>
      </div>
      <section className="panel table-panel">
        <div className="panel-heading">
          <h2>Tablets associados</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tablet</th>
                <th>Posto</th>
                <th>Estado</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td>{d.label}</td>
                  <td>{d.station}</td>
                  <td>{d.active ? "Ativo" : "Revogado"}</td>
                  <td>
                    {d.active && (
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={async () => {
                          if (!confirm("Revogar a associação deste tablet?"))
                            return;
                          setBusy(true);
                          try {
                            await api(
                              "/devices/" + d.id + "/revoke",
                              "POST",
                              {},
                            );
                            await load();
                            notify("Associação revogada.");
                          } catch (e) {
                            onError(e);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Revogar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
if (!IS_DEMO && "serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
