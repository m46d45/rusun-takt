import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAP_MAX,
  CAP_MIN,
  CURING_DAYS,
  DEFAULT_CONTRACT_VALUE,
  DEFAULT_DAILY_COST,
  DEFAULT_OWNER_DURATION,
  DEFAULT_SPEED_MS,
  MAX_START_WEEK,
  SPEED_OPTIONS,
  START_JIT,
  TEAMS,
  TOTAL_UNITS,
  ZONE_LABELS,
  dayToWeekNumber,
  formatDayWeek,
  formatDuration,
} from "@/lib/takt/constants";
import {
  computeFinance,
  createInitialState,
  createRng,
  defaultConfig,
  runPresetCompare,
  runToCompletion,
  stepDay,
} from "@/lib/takt/engine";
import {
  playProjectComplete,
  playTeamComplete,
  playZoneComplete,
  unlockAudio,
} from "@/lib/takt/sounds";
import type { RunResult, SimConfig, SimSnapshot, TeamSetup } from "@/lib/takt/types";
import { Button } from "@/components/ui/button";
import { Board } from "./Board";
import { MetricsPanel } from "./Metrics";
import { Debrief } from "./Debrief";
import { ResultsChart } from "./ResultsChart";
import { HelmetBadge } from "./Helmet";
import { ManualDialog } from "./ManualDialog";
import {
  FastForward,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  BookOpen,
} from "lucide-react";
import { formatRp } from "@/lib/utils";

const DEFAULT_SEED = 42;
const COST_INPUT_SCALE = 1000;
const CONTRACT_UI_SCALE = 1_000_000;

function cloneConfig(c: SimConfig): SimConfig {
  return {
    name: c.name,
    ownerDurationDays: c.ownerDurationDays,
    contractValue: c.contractValue,
    teams: c.teams.map((t) => ({ ...t })),
  };
}

function clampCap(n: number): number {
  return Math.max(CAP_MIN, Math.min(CAP_MAX, Math.round(n) || CAP_MIN));
}

/** Zona selesai = wagon terakhir (Cat) progress melewati index zona */
function completedZonesCount(teams: SimSnapshot["teams"]): number {
  const last = teams[TEAMS.length - 1]?.progress ?? 0;
  return Math.min(TOTAL_UNITS, last);
}

function finishedTeamCount(teams: SimSnapshot["teams"]): number {
  return teams.filter((t) => t.progress >= TOTAL_UNITS).length;
}

/**
 * Putar suara saat state maju (bukan saat reset).
 * Prioritas: Tada > Yes > Ting (hindari overlapping terlalu banyak).
 */
function playProgressSounds(prev: SimSnapshot, next: SimSnapshot): void {
  if (next.day <= prev.day) return;

  const zonesBefore = completedZonesCount(prev.teams);
  const zonesAfter = completedZonesCount(next.teams);
  const teamsBefore = finishedTeamCount(prev.teams);
  const teamsAfter = finishedTeamCount(next.teams);

  if (!prev.finished && next.finished) {
    playProjectComplete();
    return;
  }
  if (teamsAfter > teamsBefore) {
    playTeamComplete();
    return;
  }
  if (zonesAfter > zonesBefore) {
    playZoneComplete();
  }
}

export function Simulator() {
  const [draft, setDraft] = useState<SimConfig>(() => defaultConfig());
  const [seed] = useState(DEFAULT_SEED);
  const [state, setState] = useState<SimSnapshot>(() =>
    createInitialState(defaultConfig()),
  );
  const rngRef = useRef(createRng(DEFAULT_SEED));
  const prevStateRef = useRef(state);
  const [auto, setAuto] = useState(false);
  const [started, setStarted] = useState(false);
  const [compare, setCompare] = useState<RunResult[] | null>(null);
  const [speedMs, setSpeedMs] = useState(DEFAULT_SPEED_MS);
  const [showSetup, setShowSetup] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);

  // Deteksi momen: zona selesai / tim selesai / proyek selesai
  useEffect(() => {
    const prev = prevStateRef.current;
    if (started) {
      playProgressSounds(prev, state);
    }
    prevStateRef.current = state;
  }, [state, started]);

  const resetToSetup = useCallback(
    (cfg: SimConfig) => {
      const normalized = cloneConfig(cfg);
      rngRef.current = createRng(seed);
      setDraft(normalized);
      const initial = createInitialState(normalized);
      prevStateRef.current = initial;
      setState(initial);
      setAuto(false);
      setStarted(false);
      setCompare(null);
    },
    [seed],
  );

  const startRun = () => {
    unlockAudio();
    const normalized = cloneConfig(draft);
    rngRef.current = createRng(seed);
    const initial = createInitialState(normalized);
    prevStateRef.current = initial;
    setState(initial);
    setCompare(null);
    setStarted(true);
    setAuto(true);
  };

  useEffect(() => {
    if (!auto || !started || state.finished) return;
    const id = window.setTimeout(() => {
      setState((s) => (s.finished ? s : stepDay(s, rngRef.current)));
    }, speedMs);
    return () => window.clearTimeout(id);
  }, [auto, started, state.day, state.finished, speedMs]);

  useEffect(() => {
    if (state.finished && auto) setAuto(false);
  }, [state.finished, auto]);

  const step = () => {
    unlockAudio();
    setAuto(false);
    setState((s) => (s.finished ? s : stepDay(s, rngRef.current)));
  };

  const finishNow = () => {
    unlockAudio();
    setAuto(false);
    setState((s) => {
      if (s.finished) return s;
      let next = s;
      const rng = rngRef.current;
      let guard = 0;
      // Langkah demi langkah agar suara tetap terdengar per momen (cap agar tidak terlalu lama)
      // Untuk "Selesaikan" cepat: jalankan semua, suara hanya di momen penting terakhir
      while (!next.finished && guard < 2000) {
        next = stepDay(next, rng);
        guard++;
      }
      return next;
    });
  };

  const runCompare = () => {
    unlockAudio();
    setAuto(false);
    const cfg = cloneConfig(started ? state.config : draft);
    if (!started) {
      rngRef.current = createRng(seed);
      setStarted(true);
    }
    setCompare(runPresetCompare(cfg, seed));
    setState(runToCompletion(cfg, seed).final);
  };

  const setTeam = (index: number, patch: Partial<TeamSetup>) => {
    setDraft((d) => ({
      ...d,
      name: undefined,
      teams: d.teams.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  };

  const logTail = useMemo(() => state.log.slice(-6).reverse(), [state.log]);
  const weekNow = dayToWeekNumber(state.day);
  const activeConfig = started ? state.config : draft;
  const defaultInput = DEFAULT_DAILY_COST / COST_INPUT_SCALE;

  const finance = useMemo(() => {
    const dayRef = state.metrics.finishDay ?? state.day;
    return computeFinance(
      activeConfig,
      dayRef,
      state.metrics.totalCost,
      state.metrics.wasteCost,
      state.finished,
    );
  }, [activeConfig, state.metrics, state.finished, state.day]);

  const totalWastePct =
    state.metrics.totalCost > 0
      ? `${((state.metrics.wasteCost / state.metrics.totalCost) * 100).toFixed(0)}%`
      : null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-fg sm:text-2xl">
              Aturan Aliran Kerja
            </h2>
            <p className="mt-1 text-xs text-muted">
              Baca manual dulu sebelum menjalankan simulasi.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setManualOpen(true)}
            className="min-h-10 shrink-0"
          >
            <BookOpen className="h-4 w-4" />
            Baca manual
          </Button>
        </div>
        <div className="mt-3 space-y-2.5 text-sm text-muted">
          <p>
            <span className="font-semibold text-fg">1. Siapa memulai.</span>{" "}
            Wagon depan adalah <strong className="text-fg">Struktur</strong>{" "}
            (kolom & balok). Urutan tetap: Struktur → Pelat → Dinding → MEP →
            Plester → Keramik → Cat.
          </p>
          <p>
            <span className="font-semibold text-fg">2. Satu zona, satu tim.</span>{" "}
            Per lantai ada 5 zona:{" "}
            <strong className="text-fg">{ZONE_LABELS.join(" · ")}</strong>.
            Tidak boleh dua tim di zona yang sama. Tim berikutnya baru masuk
            setelah tim sebelumnya <em>meninggalkan</em> zona itu (paling cepat
            hari berikutnya).
          </p>
          <p>
            <span className="font-semibold text-fg">3. Alur zona.</span> Tiap
            tim mengerjakan zona berurutan: U1 → U2 → Tangga → U3 → U4, lalu
            naik ke lantai berikutnya dengan pola yang sama.
          </p>
          <p>
            <span className="font-semibold text-fg">
              4. Curing beton ({CURING_DAYS} hari).
            </span>{" "}
            Setelah <strong className="text-fg">Pelat</strong> selesai di suatu
            zona, zona itu di-curing {CURING_DAYS} hari, baru bekisting dilepas.
            Tim Dinding (dan setelahnya) baru boleh masuk zona itu setelah
            curing selesai. Struktur ke lantai atas menunggu curing zona di
            bawahnya.
          </p>
          <p>
            <span className="font-semibold text-fg">5. Start Kerja.</span>{" "}
            <strong className="text-fg">Minggu 1–7</strong> = tim sudah di site
            (dibayar) sejak minggu itu meski belum dapat zona (push → bisa
            waste). <strong className="text-fg">JIT</strong> = tim baru mulai
            (dan dibayar) segera saat zona pertama kali boleh dimasuki — sehari
            setelah wagon depan lepas / syarat curing terpenuhi.
          </p>
          <p>
            <span className="font-semibold text-fg">
              6. Biaya = tenaga kerja saja.
            </span>{" "}
            Nilai kontrak di simulasi ={" "}
            <strong className="text-fg">porsi tenaga kerja</strong> (bukan total
            kontrak bangunan). Material & alat diasumsikan dari{" "}
            <strong className="text-fg">kontraktor utama</strong> dan{" "}
            <strong className="text-fg">tidak menjadi kendala</strong> (selalu
            tersedia, tidak dihitung di sini).
          </p>
          {started && state.day > 0 ? (
            <p className="tabular text-xs text-subtle">
              Berjalan: Minggu {weekNow} · hari {state.day}
              {state.finished ? " · selesai" : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl text-fg">Setup tim kerja</h2>
            <p className="mt-1 text-xs text-muted">
              Start Kerja (M1–M7 / JIT) · variasi kapasitas · target owner &
              kontrak
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowSetup((v) => !v)}
          >
            {showSetup ? "Sembunyikan" : "Tampilkan"}
          </Button>
        </div>

        {showSetup && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 rounded-lg border border-border bg-surface-2 p-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Durasi proyek rusun (hari)
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.ownerDurationDays}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      ownerDurationDays: Math.max(
                        1,
                        Math.round(Number(e.target.value) || 1),
                      ),
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 tabular text-fg"
                />
                <span className="mt-0.5 block text-[10px] text-subtle">
                  Default {DEFAULT_OWNER_DURATION} hari
                </span>
              </label>
              <label className="block text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Kontrak tenaga (juta Rp)
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={Math.round(draft.contractValue / CONTRACT_UI_SCALE)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      contractValue: Math.max(
                        0,
                        Math.round(Number(e.target.value) || 0) *
                          CONTRACT_UI_SCALE,
                      ),
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 tabular text-fg"
                />
                <span className="mt-0.5 block text-[10px] text-subtle">
                  = {formatRp(draft.contractValue)} · default{" "}
                  {DEFAULT_CONTRACT_VALUE / CONTRACT_UI_SCALE} jt
                </span>
              </label>
              <p className="text-[11px] text-subtle sm:col-span-2">
                Biaya = tenaga kerja saja. Kontrak = porsi tenaga (bukan total
                bangunan). Material & alat dari kontraktor utama — selalu
                tersedia, tidak dihitung. Penalti = terlambat × (1/1000) ×
                kontrak tenaga. Margin = kontrak − biaya tenaga − penalti.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-subtle">
                    <th className="py-2 pr-2 font-medium">Tim kerja</th>
                    <th className="py-2 pr-2 font-medium">Start Kerja</th>
                    <th className="py-2 pr-2 font-medium" colSpan={2}>
                      Variasi kapasitas{" "}
                      <span className="normal-case text-subtle">
                        (hari / zona)
                      </span>
                    </th>
                    <th className="py-2 font-medium">
                      Biaya / hari{" "}
                      <span className="normal-case text-subtle">
                        (× Rp1.000)
                      </span>
                    </th>
                  </tr>
                  <tr className="border-b border-border text-[10px] text-subtle">
                    <th />
                    <th />
                    <th className="py-1 pr-1 font-medium">Bawah</th>
                    <th className="py-1 pr-2 font-medium">Atas</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {TEAMS.map((def, i) => {
                    const t = draft.teams[i]!;
                    const costInput = Math.round(t.dailyCost / COST_INPUT_SCALE);
                    const isConst = t.diceMin === t.diceMax;
                    return (
                      <tr
                        key={def.id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-2.5">
                            <HelmetBadge
                              color={def.color}
                              label={i + 1}
                              size={34}
                            />
                            <span className="font-medium text-fg">
                              {def.short}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-2">
                          <select
                            value={t.startWeek}
                            onChange={(e) =>
                              setTeam(i, {
                                startWeek: Number(e.target.value),
                              })
                            }
                            className="h-9 min-w-[7.5rem] rounded-md border border-border bg-surface-2 px-2 text-sm text-fg"
                          >
                            {Array.from({ length: MAX_START_WEEK }, (_, w) => (
                              <option key={w} value={w}>
                                Minggu {w + 1}
                              </option>
                            ))}
                            <option value={START_JIT}>Just-in-Time (JIT)</option>
                          </select>
                        </td>
                        <td className="py-2.5 pr-1">
                          <input
                            type="number"
                            min={CAP_MIN}
                            max={CAP_MAX}
                            value={t.diceMin}
                            onChange={(e) => {
                              const lo = clampCap(Number(e.target.value));
                              const hi = Math.max(lo, t.diceMax);
                              setTeam(i, {
                                diceMin: lo,
                                diceMax: clampCap(hi),
                              });
                            }}
                            className="h-9 w-14 rounded-md border border-border bg-surface-2 px-2 tabular text-sm text-fg"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={CAP_MIN}
                              max={CAP_MAX}
                              value={t.diceMax}
                              onChange={(e) => {
                                const hi = clampCap(Number(e.target.value));
                                const lo = Math.min(t.diceMin, hi);
                                setTeam(i, {
                                  diceMin: clampCap(lo),
                                  diceMax: hi,
                                });
                              }}
                              className="h-9 w-14 rounded-md border border-border bg-surface-2 px-2 tabular text-sm text-fg"
                            />
                            <span className="text-[10px] text-subtle">
                              {isConst
                                ? `= ${t.diceMin}h`
                                : `${t.diceMin}–${t.diceMax}h`}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              step={10}
                              value={costInput}
                              onChange={(e) =>
                                setTeam(i, {
                                  dailyCost:
                                    Math.max(0, Number(e.target.value) || 0) *
                                    COST_INPUT_SCALE,
                                })
                              }
                              className="h-9 w-20 rounded-md border border-border bg-surface-2 px-2 tabular text-sm text-fg"
                            />
                            <span className="text-[11px] text-subtle">
                              = {formatRp(t.dailyCost)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-subtle">
              JIT = mulai saat zona siap (tanpa idle bayar di depan). Minggu 1–7
              = push (bisa menunggu = waste). Variasi 2–2 = konstan 2 hari/zona.
              Biaya {defaultInput} → {formatRp(DEFAULT_DAILY_COST)}/hari.
            </p>

            {!started ? (
              <Button
                type="button"
                size="lg"
                onClick={startRun}
                className="min-h-12 w-full sm:w-auto sm:min-w-[10rem]"
              >
                <Play className="h-5 w-5" />
                Start
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-fg">
                  {auto
                    ? "Berjalan"
                    : state.finished
                      ? "Selesai"
                      : "Pause"}
                  {state.day > 0 ? (
                    <span className="ml-2 tabular text-muted">
                      · M{weekNow} · H{state.day}
                    </span>
                  ) : null}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => resetToSetup(draft)}
                >
                  Terapkan setup & reset
                </Button>
              </div>
            )}
          </div>
        )}

        {!showSetup && !started ? (
          <div className="mt-4">
            <Button
              type="button"
              size="lg"
              onClick={startRun}
              className="min-h-12 min-w-[10rem]"
            >
              <Play className="h-5 w-5" />
              Start
            </Button>
          </div>
        ) : null}
      </div>

      {started && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2 p-3">
          <Button
            type="button"
            variant="secondary"
            onClick={step}
            disabled={state.finished || auto}
            className="min-h-11"
          >
            <StepForward className="h-4 w-4" />
            +1 hari
          </Button>
          <Button
            type="button"
            variant={auto ? "outline" : "default"}
            onClick={() => {
              unlockAudio();
              setAuto((a) => !a);
            }}
            disabled={state.finished}
            className="min-h-11"
          >
            {auto ? (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Lanjut
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={finishNow}
            disabled={state.finished}
            className="min-h-11"
          >
            <FastForward className="h-4 w-4" />
            Selesaikan
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={runCompare}
            className="min-h-11"
          >
            Bandingkan
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => resetToSetup(state.config)}
            className="min-h-11"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <label className="flex w-full items-center gap-2 text-xs text-muted sm:ml-auto sm:w-auto">
            Kecepatan
            <select
              value={speedMs}
              onChange={(e) => setSpeedMs(Number(e.target.value))}
              className="h-10 min-w-[10rem] rounded-md border border-border bg-surface px-2 text-sm text-fg"
            >
              {SPEED_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <Board
          teams={state.teams}
          floors={state.floors}
          day={state.day}
          config={activeConfig}
        />
        <div className="space-y-4">
          <MetricsPanel
            metrics={state.metrics}
            teams={state.teams}
            finance={finance}
          />
          {started && logTail.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-subtle">
                Log
              </p>
              <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs text-muted">
                {logTail.map((line, i) => (
                  <li key={`${i}-${line.slice(0, 16)}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {state.finished ? <ResultsChart state={state} /> : null}
      {compare ? <Debrief results={compare} /> : null}
      {state.finished && !compare ? (
        <div className="rounded-xl border border-ok/40 bg-ok/10 p-4 text-sm text-muted">
          Selesai {formatDayWeek(state.metrics.finishDay ?? state.day)} (
          {formatDuration(state.metrics.finishDay ?? state.day)}
          {finance.lateDays > 0
            ? ` · terlambat ${finance.lateDays} hari`
            : " · tepat waktu"}
          ). Biaya tenaga{" "}
          <span className="font-medium text-fg">
            {formatRp(finance.laborCost)}
          </span>
          · Penalti{" "}
          <span className="font-medium text-danger">
            {formatRp(finance.penalty)}
          </span>
          · Margin{" "}
          <span
            className={
              finance.margin >= 0
                ? "font-medium text-ok"
                : "font-medium text-danger"
            }
          >
            {formatRp(finance.margin)} ({finance.marginPct.toFixed(1)}%)
          </span>
          {totalWastePct ? (
            <>
              {" "}
              · Waste{" "}
              <span className="font-medium text-danger">{totalWastePct}</span>
            </>
          ) : null}
          .
        </div>
      ) : null}

      <ManualDialog open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}
