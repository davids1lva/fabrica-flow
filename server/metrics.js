export function metrics(s, now = Date.now()) {
  const extra = Math.max(
    0,
    Math.min(now, s.ended_at ? +new Date(s.ended_at) : now) -
      +new Date(s.checkpoint_at),
  );
  const productive =
    Number(s.productive_ms) + (s.status === "production" ? extra : 0);
  const paused = Number(s.pause_ms) + (s.status === "pause" ? extra : 0);
  const expected =
    Number(s.expected) +
    (s.status === "production" ? (extra * Number(s.target)) / 3600000 : 0);
  return {
    ...s,
    target: Number(s.target),
    productive_ms: productive,
    pause_ms: paused,
    expected,
    total_ms: productive + paused,
    efficiency: expected > 0 ? (s.quantity / expected) * 100 : null,
    per_hour: productive > 0 ? (s.quantity * 3600000) / productive : 0,
  };
}
export async function checkpoint(t, s) {
  const {
    rows: [clock],
  } = await t.query("SELECT clock_timestamp() AS now");
  const now = new Date(clock.now),
    m = metrics(s, +now);
  const {
    rows: [v],
  } = await t.query(
    "UPDATE work_sessions SET productive_ms=$2,pause_ms=$3,expected=$4,checkpoint_at=$5,version=version+1,updated_at=$5 WHERE id=$1 RETURNING *",
    [s.id, m.productive_ms, m.pause_ms, m.expected, now],
  );
  return v;
}
