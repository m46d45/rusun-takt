import {
  DAYS_PER_WEEK,
  FLOORS,
  TEAMS,
  TOTAL_UNITS,
  UNITS_PER_FLOOR,
  ZONE_LABELS,
  dayToWeekNumber,
} from "@/lib/takt/constants";
import type { DayHistory, SimSnapshot } from "@/lib/takt/types";
import { cn, formatNumber } from "@/lib/utils";

function dayToWeekIndex0(day: number): number {
  if (day <= 0) return 0;
  return Math.ceil(day / DAYS_PER_WEEK) - 1;
}

function weekComplete(finishDay: number | null, fallbackDay: number): number {
  if (finishDay === null) return dayToWeekNumber(fallbackDay) || 0;
  return dayToWeekNumber(finishDay);
}

function durationStats(durations: number[]): {
  max: number;
  min: number;
  avg: number;
} {
  if (!durations.length) return { max: 0, min: 0, avg: 0 };
  const max = Math.max(...durations);
  const min = Math.min(...durations);
  const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
  return { max, min, avg };
}

function buildTaktGrid(history: DayHistory[]) {
  const lastDay =
    history.length === 0 ? 0 : history[history.length - 1]!.day;
  const weeks = Math.max(1, Math.ceil(lastDay / DAYS_PER_WEEK));

  const daysWorked: number[][][] = Array.from({ length: TOTAL_UNITS }, () =>
    Array.from({ length: weeks }, () =>
      Array.from({ length: TEAMS.length }, () => 0),
    ),
  );
  const waitDays: number[][][] = Array.from({ length: TOTAL_UNITS }, () =>
    Array.from({ length: weeks }, () =>
      Array.from({ length: TEAMS.length }, () => 0),
    ),
  );

  for (const h of history) {
    const w = dayToWeekIndex0(h.day);
    if (w < 0 || w >= weeks) continue;

    for (let ti = 0; ti < h.teams.length; ti++) {
      const rec = h.teams[ti]!;

      if (
        rec.activeZone !== null &&
        rec.activeZone >= 0 &&
        rec.activeZone < TOTAL_UNITS
      ) {
        daysWorked[rec.activeZone]![w]![ti]! += 1;
      }

      if (
        rec.waitingZone !== null &&
        rec.waitingZone >= 0 &&
        rec.waitingZone < TOTAL_UNITS
      ) {
        waitDays[rec.waitingZone]![w]![ti]! += 1;
      }
    }
  }

  const peak: number[][] = Array.from({ length: TOTAL_UNITS }, () =>
    Array.from({ length: TEAMS.length }, () => 0),
  );
  for (let z = 0; z < TOTAL_UNITS; z++) {
    for (let ti = 0; ti < TEAMS.length; ti++) {
      let p = 0;
      for (let w = 0; w < weeks; w++) {
        p = Math.max(p, daysWorked[z]![w]![ti]!);
      }
      peak[z]![ti] = p;
    }
  }

  const work: number[][] = Array.from({ length: TOTAL_UNITS }, () =>
    Array.from({ length: weeks }, () => -1),
  );
  const wait: number[][] = Array.from({ length: TOTAL_UNITS }, () =>
    Array.from({ length: weeks }, () => -1),
  );

  for (let z = 0; z < TOTAL_UNITS; z++) {
    for (let w = 0; w < weeks; w++) {
      let bestT = -1;
      let bestD = 0;
      for (let ti = 0; ti < TEAMS.length; ti++) {
        const d = daysWorked[z]![w]![ti]!;
        const pk = peak[z]![ti]!;
        if (pk > 0 && d === pk && d > bestD) {
          bestD = d;
          bestT = ti;
        }
      }
      if (bestT >= 0) {
        work[z]![w] = bestT;
        continue;
      }

      let bestW = -1;
      let bestWD = 0;
      for (let ti = 0; ti < TEAMS.length; ti++) {
        const d = waitDays[z]![w]![ti]!;
        if (d > bestWD) {
          bestWD = d;
          bestW = ti;
        }
      }
      if (bestW >= 0 && bestWD >= 2) wait[z]![w] = bestW;
    }
  }

  return { weeks, work, wait, lastDay };
}

export function ResultsChart({ state }: { state: SimSnapshot }) {
  if (!state.finished && state.history.length === 0) return null;

  const { weeks, work, wait, lastDay } = buildTaktGrid(state.history);

  const rows = state.teams.map((t, i) => {
    const { max, min, avg } = durationStats(t.zoneDurations ?? []);
    return {
      id: i,
      def: TEAMS[i]!,
      weekComplete: weekComplete(t.finishDay, state.day),
      capacityTotal: t.capacityTotal,
      unused: t.unusedCapacity,
      maxDays: max,
      minDays: min,
      avgDays: avg,
    };
  });

  const totalCap = rows.reduce((s, r) => s + r.capacityTotal, 0);
  const totalUnused = rows.reduce((s, r) => s + r.unused, 0);
  const projectWeek = dayToWeekNumber(state.metrics.finishDay ?? state.day);

  return (
    <div className="space-y-6 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div>
        <h2 className="font-display text-2xl text-fg">Hasil akhir</h2>
        <p className="mt-1 text-sm text-muted">
          Selesai minggu ke-{projectWeek || "—"} (hari{" "}
          {state.metrics.finishDay ?? state.day}).{" "}
          <strong className="text-fg">1 minggu = {DAYS_PER_WEEK} hari</strong>.
          Curing pelat = {DAYS_PER_WEEK} hari penuh (minggu kosong di peta).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-zinc-900 text-[10px] uppercase tracking-wide text-zinc-200">
              <th className="px-2 py-2 font-semibold">Tim (wagon)</th>
              <th className="px-2 py-2 text-center font-semibold">
                Minggu selesai
              </th>
              <th className="px-2 py-2 text-center font-semibold">
                Total hari kerja
              </th>
              <th className="px-2 py-2 text-center font-semibold">
                Tak terpakai
              </th>
              <th className="px-2 py-2 text-center font-semibold">
                Maks (hari)
              </th>
              <th className="px-2 py-2 text-center font-semibold">
                Min (hari)
              </th>
              <th className="px-2 py-2 text-center font-semibold">
                Rata-rata (hari)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border/80 even:bg-surface-2/50"
              >
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-6 w-8 items-center justify-center rounded border border-black/20 text-[10px] font-bold"
                      style={{
                        backgroundColor: r.def.color,
                        color: r.def.colorFg,
                      }}
                    >
                      {r.id + 1}
                    </span>
                    <span className="font-semibold text-fg">{r.def.short}</span>
                  </div>
                </td>
                <td className="tabular px-2 py-2 text-center font-medium text-fg">
                  {r.weekComplete || "—"}
                </td>
                <td className="tabular px-2 py-2 text-center text-fg">
                  {formatNumber(r.capacityTotal)}
                </td>
                <td
                  className={cn(
                    "tabular px-2 py-2 text-center font-medium",
                    r.unused > 0 ? "text-danger" : "text-fg",
                  )}
                >
                  {r.unused > 0 ? formatNumber(r.unused) : "—"}
                </td>
                <td className="tabular px-2 py-2 text-center text-fg">
                  {r.maxDays || "—"}
                </td>
                <td className="tabular px-2 py-2 text-center text-fg">
                  {r.minDays || "—"}
                </td>
                <td className="tabular px-2 py-2 text-center text-fg">
                  {r.avgDays > 0 ? r.avgDays.toFixed(1) : "—"}
                </td>
              </tr>
            ))}
            <tr className="bg-zinc-900 text-zinc-50">
              <td className="px-2 py-2.5 font-bold uppercase">Total</td>
              <td className="px-2 py-2.5 text-center">—</td>
              <td className="tabular px-2 py-2.5 text-center text-lg font-bold">
                {formatNumber(totalCap)}
              </td>
              <td className="tabular px-2 py-2.5 text-center text-lg font-bold text-red-300">
                {formatNumber(totalUnused)}
              </td>
              <td className="px-2 py-2.5 text-center">—</td>
              <td className="px-2 py-2.5 text-center">—</td>
              <td className="px-2 py-2.5 text-center">—</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1.5 text-[11px] text-subtle">
          Maks / min / rata-rata = durasi (hari) per zona dari roll variasi
          kapasitas.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">
          Arti sel takt plan
        </p>
        <div className="grid gap-2 text-sm text-muted sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 h-5 w-7 shrink-0 rounded-sm border border-black/20"
              style={{ backgroundColor: TEAMS[2]!.color }}
            />
            <div>
              <p className="font-semibold text-fg">Warna solid</p>
              <p className="text-xs">Tim bekerja di zona itu minggu itu.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="relative mt-0.5 flex h-5 w-7 shrink-0 items-center justify-center rounded-sm border border-zinc-400 bg-red-400/40">
              <span className="text-xs font-black text-zinc-900">×</span>
            </span>
            <div>
              <p className="font-semibold text-fg">Pudar + ×</p>
              <p className="text-xs">Menunggu zona (waste / push).</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-5 w-7 shrink-0 rounded-sm border border-zinc-300 bg-white" />
            <div>
              <p className="font-semibold text-fg">Putih</p>
              <p className="text-xs">
                Kosong — termasuk <strong>minggu curing</strong>.
              </p>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-subtle">
          Kolom 1 = hari 1–{DAYS_PER_WEEK}, … (total {lastDay} hari · {weeks}{" "}
          minggu).
        </p>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-subtle">
          Takt plan — timeline minggu
        </p>
        <p className="mb-3 text-sm text-muted">
          Baris = zona · Kolom = minggu (
          <strong className="text-fg">1 minggu = {DAYS_PER_WEEK} hari</strong>
          ).
        </p>

        <div className="overflow-x-auto rounded-lg border-2 border-zinc-400 bg-[#9aab8e] p-3 shadow-inner">
          <table className="border-separate border-spacing-0 text-[10px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[4.5rem] bg-[#9aab8e] px-1 py-1 text-left font-bold text-zinc-800">
                  Zona
                </th>
                {Array.from({ length: weeks }, (_, w) => (
                  <th
                    key={w}
                    className="min-w-[1.55rem] px-0 py-1 text-center font-bold text-zinc-800"
                  >
                    {w + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: FLOORS }, (_, floor) =>
                Array.from({ length: UNITS_PER_FLOOR }, (_, zi) => {
                  const z = floor * UNITS_PER_FLOOR + zi;
                  const isStair = zi === 2;
                  const label = `${floor + 1}.${ZONE_LABELS[zi]}`;
                  return (
                    <tr key={z}>
                      <td
                        className={cn(
                          "sticky left-0 z-20 whitespace-nowrap border border-zinc-500/40 px-1 py-0 font-semibold",
                          isStair
                            ? "bg-amber-200/90 text-amber-950"
                            : "bg-[#b8c4a8] text-zinc-900",
                        )}
                      >
                        {label}
                      </td>
                      {Array.from({ length: weeks }, (_, w) => {
                        const workTeam = work[z]![w]!;
                        const waitTeam = wait[z]![w]!;

                        if (workTeam >= 0) {
                          const def = TEAMS[workTeam]!;
                          return (
                            <td
                              key={w}
                              className="border border-zinc-600/50 p-0"
                            >
                              <div
                                className="h-5 w-full sm:h-6"
                                style={{ backgroundColor: def.color }}
                              />
                            </td>
                          );
                        }

                        if (waitTeam >= 0) {
                          const def = TEAMS[waitTeam]!;
                          return (
                            <td
                              key={w}
                              className="border border-zinc-500/40 p-0"
                            >
                              <div
                                className="relative flex h-5 w-full items-center justify-center sm:h-6"
                                style={{
                                  background: `repeating-linear-gradient(
                                    -45deg,
                                    ${def.color}55,
                                    ${def.color}55 3px,
                                    ${def.color}99 3px,
                                    ${def.color}99 6px
                                  )`,
                                }}
                              >
                                <span className="text-[12px] font-black text-zinc-900">
                                  ×
                                </span>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={w}
                            className="border border-zinc-400/40 bg-white/90 p-0"
                          >
                            <div className="h-5 w-full sm:h-6" />
                          </td>
                        );
                      })}
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {TEAMS.map((def, i) => (
            <div
              key={def.id}
              className="flex items-center gap-1.5 text-[11px] text-muted"
            >
              <span
                className="h-3.5 w-5 rounded-sm border border-black/20"
                style={{ backgroundColor: def.color }}
              />
              <span className="font-medium text-fg">
                {i + 1}. {def.short}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
