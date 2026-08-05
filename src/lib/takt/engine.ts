import {
  CAP_MAX,
  CAP_MIN,
  CURING_DAYS,
  DAYS_PER_WEEK,
  DEFAULT_CONTRACT_VALUE,
  DEFAULT_DAILY_COST,
  DEFAULT_OWNER_DURATION,
  FLOORS,
  PENALTY_PER_DAY_FRACTION,
  START_JIT,
  TEAMS,
  TOTAL_UNITS,
  UNITS_PER_FLOOR,
  ZONE_LABELS,
  configDiceSummary,
  defaultConfig,
  diceLabel,
  isJitStart,
  makeConfig,
  weekToStartDay,
  zoneLabel,
} from "./constants";
import type {
  DayHistory,
  FloorCure,
  ProjectFinance,
  RunResult,
  SimConfig,
  SimSnapshot,
  TeamSetup,
  TeamState,
  ZoneCure,
} from "./types";

export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rollDice(rng: () => number, min: number, max: number): number {
  if (min >= max) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

function clampCap(n: number): number {
  return Math.max(CAP_MIN, Math.min(CAP_MAX, Math.round(n)));
}

function emptyTeams(): TeamState[] {
  return TEAMS.map(() => ({
    progress: 0,
    lastRoll: 0,
    lastWorked: 0,
    status: "waiting" as const,
    statusLabel: "Belum start",
    totalWorked: 0,
    waitDays: 0,
    wasteCost: 0,
    daysOnSite: 0,
    capacityTotal: 0,
    unusedCapacity: 0,
    finishDay: null,
    weeklyCapacity: [],
    weeklyUnused: [],
    zoneDaysLeft: 0,
    zoneDaysTotal: 0,
    mobilized: false,
    zoneDurations: [],
  }));
}

function emptyZoneCures(): ZoneCure[] {
  return Array.from({ length: TOTAL_UNITS }, () => ({
    pouredDay: null,
    readyDay: null,
    stripped: false,
  }));
}

function deriveFloors(zoneCures: ZoneCure[], day: number): FloorCure[] {
  return Array.from({ length: FLOORS }, (_, f) => {
    const start = f * UNITS_PER_FLOOR;
    const zones = zoneCures.slice(start, start + UNITS_PER_FLOOR);
    const allPoured = zones.every((z) => z.pouredDay !== null);
    const allReady = zones.every(
      (z) => z.readyDay !== null && day > z.readyDay!,
    );
    const pouredDay = allPoured
      ? Math.max(...zones.map((z) => z.pouredDay!))
      : null;
    const readyDay = allPoured
      ? Math.max(...zones.map((z) => z.readyDay!))
      : null;
    return {
      pouredDay,
      readyDay,
      formworkStripped: allReady,
    };
  });
}

function normalizeConfig(config?: SimConfig): SimConfig {
  const base = config ?? defaultConfig();
  const teams = TEAMS.map((_, i) => {
    const t = base.teams[i];
    let startWeek = Math.floor(t?.startWeek ?? 0);
    if (startWeek !== START_JIT) {
      startWeek = Math.max(0, Math.min(6, startWeek));
    }
    let diceMin = clampCap(t?.diceMin ?? 1);
    let diceMax = clampCap(t?.diceMax ?? 6);
    if (diceMin > diceMax) {
      const x = diceMin;
      diceMin = diceMax;
      diceMax = x;
    }
    const dailyCost = Math.max(
      0,
      Math.round(t?.dailyCost ?? DEFAULT_DAILY_COST),
    );
    return { startWeek, diceMin, diceMax, dailyCost };
  });
  const ownerDurationDays = Math.max(
    1,
    Math.round(base.ownerDurationDays ?? DEFAULT_OWNER_DURATION),
  );
  const contractValue = Math.max(
    0,
    Math.round(base.contractValue ?? DEFAULT_CONTRACT_VALUE),
  );
  return { name: base.name, teams, ownerDurationDays, contractValue };
}

export function computeFinance(
  config: SimConfig,
  currentOrFinishDay: number,
  laborCost: number,
  wasteCost: number,
  finished = false,
): ProjectFinance {
  const cfg = normalizeConfig(config);
  const day = Math.max(0, currentOrFinishDay);
  const lateDays = Math.max(0, day - cfg.ownerDurationDays);
  const penalty = lateDays * PENALTY_PER_DAY_FRACTION * cfg.contractValue;
  const margin = cfg.contractValue - laborCost - penalty;
  const marginPct =
    cfg.contractValue > 0 ? (margin / cfg.contractValue) * 100 : 0;
  return {
    ownerDurationDays: cfg.ownerDurationDays,
    contractValue: cfg.contractValue,
    finishDay: day,
    lateDays,
    penalty,
    laborCost,
    wasteCost,
    margin,
    marginPct,
    onTime: finished ? lateDays === 0 && day > 0 : day <= cfg.ownerDurationDays,
  };
}

export function createInitialState(config?: SimConfig): SimSnapshot {
  const cfg = normalizeConfig(config);
  const zoneCures = emptyZoneCures();
  return {
    day: 0,
    teams: emptyTeams(),
    zoneCures,
    floors: deriveFloors(zoneCures, 0),
    metrics: {
      day: 0,
      totalLaborDays: 0,
      totalCost: 0,
      wasteCost: 0,
      waitDays: 0,
      finished: false,
      finishDay: null,
    },
    log: [],
    finished: false,
    config: cfg,
    history: [],
  };
}

function zoneReady(zc: ZoneCure, day: number): boolean {
  // readyDay = pouredDay + 7 → hari curing penuh; baru boleh kerja HARI BERIKUTNYA
  // contoh: cor H14 → curing H15–H21 → siap H22
  return zc.readyDay !== null && day > zc.readyDay;
}

function canAccessZone(
  teamId: number,
  startProgress: number[],
  myProgress: number,
  zoneCures: ZoneCure[],
  day: number,
): { ok: boolean; reason: string | null } {
  if (myProgress >= TOTAL_UNITS) return { ok: false, reason: null };

  const nextZone = myProgress;
  const nextFloor = Math.floor(nextZone / UNITS_PER_FLOOR);
  const zoneOnFloor = nextZone % UNITS_PER_FLOOR;
  const zoneName = ZONE_LABELS[zoneOnFloor]!;

  if (teamId > 0) {
    const prevStart = startProgress[teamId - 1]!;
    if (prevStart <= nextZone) {
      return {
        ok: false,
        reason: `Tunggu ${TEAMS[teamId - 1]!.short} lepas ${zoneName}`,
      };
    }
  }

  if (teamId >= 2) {
    const zc = zoneCures[nextZone]!;
    if (!zoneReady(zc, day)) {
      if (zc.pouredDay === null) {
        return { ok: false, reason: `Tunggu pelat ${zoneLabel(nextZone)}` };
      }
      const remain = Math.max(0, (zc.readyDay ?? day) + 1 - day);
      return {
        ok: false,
        reason: `Curing ${zoneLabel(nextZone)} · ${remain}h`,
      };
    }
  }

  if (teamId === 0 && nextFloor > 0) {
    const belowZone = nextZone - UNITS_PER_FLOOR;
    const zc = zoneCures[belowZone]!;
    if (!zoneReady(zc, day)) {
      if (zc.pouredDay === null) {
        return { ok: false, reason: `Tunggu pelat ${zoneLabel(belowZone)}` };
      }
      const remain = Math.max(0, (zc.readyDay ?? day) + 1 - day);
      return {
        ok: false,
        reason: `Curing ${zoneLabel(belowZone)} · ${remain}h`,
      };
    }
  }

  return { ok: true, reason: null };
}

function markPelatZone(
  zoneCures: ZoneCure[],
  zoneIndex: number,
  day: number,
  log: string[],
): void {
  const zc = zoneCures[zoneIndex]!;
  if (zc.pouredDay !== null) return;
  zc.pouredDay = day;
  zc.readyDay = day + CURING_DAYS;
  log.push(
    `H${day}: Pelat ${zoneLabel(zoneIndex)} dicor · curing H${day + 1}–H${zc.readyDay} · siap H${zc.readyDay + 1}`,
  );
}

function applyZoneStrip(
  zoneCures: ZoneCure[],
  day: number,
  log: string[],
): void {
  for (let z = 0; z < TOTAL_UNITS; z++) {
    const zc = zoneCures[z]!;
    if (zc.readyDay !== null && day > zc.readyDay && !zc.stripped) {
      zc.stripped = true;
      log.push(`H${day}: Bekisting ${zoneLabel(z)} dilepas`);
    }
  }
}

/**
 * Week start: on payroll from that week even if blocked.
 * JIT: not on payroll until zone first becomes accessible (then mobilized).
 */
function shouldBeOnSite(
  setup: TeamSetup,
  team: TeamState,
  day: number,
  accessOk: boolean,
): { onSite: boolean; label: string } {
  if (team.progress >= TOTAL_UNITS) {
    return { onSite: false, label: "Selesai" };
  }

  if (isJitStart(setup.startWeek)) {
    if (team.mobilized) {
      return { onSite: true, label: "" };
    }
    // Not yet mobilized: only appear when zone is free today
    if (accessOk) {
      return { onSite: true, label: "" };
    }
    return { onSite: false, label: "JIT · menunggu zona" };
  }

  const earliest = weekToStartDay(setup.startWeek);
  if (day < earliest) {
    return { onSite: false, label: `Start M${setup.startWeek + 1}` };
  }
  return { onSite: true, label: "" };
}

function ensureWeekSlot(arr: number[], weekIdx: number): void {
  while (arr.length <= weekIdx) arr.push(0);
}

export function stepDay(state: SimSnapshot, rng: () => number): SimSnapshot {
  if (state.finished) return state;

  const config = normalizeConfig(state.config);
  const day = state.day + 1;
  const weekIdx = Math.ceil(day / DAYS_PER_WEEK) - 1;

  const startProgress = state.teams.map((t) => t.progress);

  const teams = state.teams.map((t) => ({
    ...t,
    weeklyCapacity: [...t.weeklyCapacity],
    weeklyUnused: [...t.weeklyUnused],
    zoneDurations: [...t.zoneDurations],
  }));
  const zoneCures = state.zoneCures.map((z) => ({ ...z }));
  const log = [...state.log];

  applyZoneStrip(zoneCures, day, log);

  let dayCost = 0;
  let dayWaste = 0;
  let dayWait = 0;
  let dayLabor = 0;

  const dayHist: DayHistory = {
    day,
    teams: TEAMS.map(() => ({
      roll: 0,
      worked: 0,
      unused: 0,
      onSite: false,
      zonesCompleted: [] as number[],
      waitingZone: null as number | null,
      activeZone: null as number | null,
    })),
  };

  for (let i = 0; i < TEAMS.length; i++) {
    const t = teams[i]!;
    const setup = config.teams[i]!;
    const hist = dayHist.teams[i]!;

    if (t.progress >= TOTAL_UNITS) {
      t.lastRoll = 0;
      t.lastWorked = 0;
      t.status = "done";
      t.statusLabel = "Selesai";
      t.zoneDaysLeft = 0;
      t.zoneDaysTotal = 0;
      continue;
    }

    const access = canAccessZone(
      i,
      startProgress,
      t.progress,
      zoneCures,
      day,
    );

    const site = shouldBeOnSite(setup, t, day, access.ok);
    if (!site.onSite) {
      t.lastRoll = 0;
      t.lastWorked = 0;
      t.status = "waiting";
      t.statusLabel = site.label;
      continue;
    }

    // Mobilize JIT on first on-site day
    if (isJitStart(setup.startWeek) && !t.mobilized && access.ok) {
      t.mobilized = true;
      log.push(`H${day}: ${TEAMS[i]!.short} JIT mulai di ${zoneLabel(t.progress)}`);
    }
    if (!isJitStart(setup.startWeek) && !t.mobilized) {
      t.mobilized = true;
    }

    t.daysOnSite += 1;
    dayLabor += 1;
    dayCost += setup.dailyCost;
    hist.onSite = true;

    if (!access.ok) {
      t.lastRoll = 0;
      t.lastWorked = 0;
      t.waitDays += 1;
      t.wasteCost += setup.dailyCost;
      t.unusedCapacity += 1;
      dayWaste += setup.dailyCost;
      dayWait += 1;
      hist.unused = 1;
      hist.waitingZone = t.progress;

      ensureWeekSlot(t.weeklyUnused, weekIdx);
      t.weeklyUnused[weekIdx]! += 1;

      if (access.reason) {
        const isCure =
          access.reason.toLowerCase().includes("curing") ||
          access.reason.toLowerCase().includes("tunggu pelat");
        t.status = isCure ? "curing" : "blocked";
        t.statusLabel = access.reason;
      } else {
        t.status = "blocked";
        t.statusLabel = "Menunggu zona";
      }
      continue;
    }

    if (t.zoneDaysLeft <= 0) {
      const days = rollDice(rng, setup.diceMin, setup.diceMax);
      t.zoneDaysLeft = days;
      t.zoneDaysTotal = days;
      t.lastRoll = days;
      t.capacityTotal += days;
      ensureWeekSlot(t.weeklyCapacity, weekIdx);
      t.weeklyCapacity[weekIdx]! += days;
      hist.roll = days;
    } else {
      t.lastRoll = t.zoneDaysTotal;
      hist.roll = t.zoneDaysTotal;
    }

    // Kerja di zona saat ini (setiap hari, bukan hanya saat selesai)
    hist.activeZone = t.progress;

    t.zoneDaysLeft -= 1;
    t.lastWorked = 1;
    t.totalWorked += 1;
    hist.worked = 1;
    t.status = "working";
    const done = t.zoneDaysTotal - t.zoneDaysLeft;
    t.statusLabel = `${zoneLabel(t.progress)} · ${done}/${t.zoneDaysTotal}h`;

    if (t.zoneDaysLeft <= 0) {
      const zoneDone = t.progress;
      const dur = t.zoneDaysTotal;
      t.progress += 1;
      hist.zonesCompleted.push(zoneDone);
      t.zoneDurations = [...t.zoneDurations, dur];
      t.zoneDaysLeft = 0;
      t.zoneDaysTotal = 0;

      if (i === 1) {
        markPelatZone(zoneCures, zoneDone, day, log);
      }

      if (t.progress >= TOTAL_UNITS) {
        t.status = "done";
        t.statusLabel = "Selesai";
        t.finishDay = day;
        log.push(`H${day}: ${TEAMS[i]!.short} selesai seluruh zona`);
      } else {
        t.statusLabel = `${zoneLabel(zoneDone)} selesai`;
      }
    }
  }

  const floors = deriveFloors(zoneCures, day);
  const finished = teams.every((t) => t.progress >= TOTAL_UNITS);
  if (finished) log.push(`H${day}: Proyek selesai`);

  return {
    day,
    teams,
    zoneCures,
    floors,
    metrics: {
      day,
      totalLaborDays: state.metrics.totalLaborDays + dayLabor,
      totalCost: state.metrics.totalCost + dayCost,
      wasteCost: state.metrics.wasteCost + dayWaste,
      waitDays: state.metrics.waitDays + dayWait,
      finished,
      finishDay: finished ? day : null,
    },
    log: log.slice(-40),
    finished,
    config,
    history: [...state.history, dayHist],
  };
}

export function runToCompletion(
  config: SimConfig,
  seed: number,
  maxDays = 2000,
): { final: SimSnapshot; result: RunResult } {
  const rng = createRng(seed);
  let state = createInitialState(config);
  for (let i = 0; i < maxDays && !state.finished; i++) {
    state = stepDay(state, rng);
  }
  const summary = configDiceSummary(state.config);
  const finishDay = state.metrics.finishDay ?? state.day;
  const fin = computeFinance(
    state.config,
    finishDay,
    state.metrics.totalCost,
    state.metrics.wasteCost,
    true,
  );
  return {
    final: state,
    result: {
      name: config.name ?? summary,
      finishDay,
      totalCost: state.metrics.totalCost,
      wasteCost: state.metrics.wasteCost,
      waitDays: state.metrics.waitDays,
      totalLaborDays: state.metrics.totalLaborDays,
      diceLabel: summary,
      lateDays: fin.lateDays,
      penalty: fin.penalty,
      margin: fin.margin,
      marginPct: fin.marginPct,
    },
  };
}

export function runPresetCompare(
  base: SimConfig,
  seed: number,
): RunResult[] {
  const starts = base.teams.map((t) => t.startWeek);
  const costs = base.teams.map((t) => t.dailyCost);
  const owner = base.ownerDurationDays ?? DEFAULT_OWNER_DURATION;
  const contract = base.contractValue ?? DEFAULT_CONTRACT_VALUE;
  const presets = [
    makeConfig(1, 6, starts, "1–6 hari", DEFAULT_DAILY_COST, owner, contract),
    makeConfig(2, 2, starts, "2–2 konstan", DEFAULT_DAILY_COST, owner, contract),
    makeConfig(3, 3, starts, "3–3 konstan", DEFAULT_DAILY_COST, owner, contract),
  ].map((c) => ({
    ...c,
    ownerDurationDays: owner,
    contractValue: contract,
    teams: c.teams.map((t, i) => ({
      ...t,
      dailyCost: costs[i] ?? DEFAULT_DAILY_COST,
      startWeek: starts[i] ?? 0,
    })),
  }));
  return presets.map((c) => runToCompletion(c, seed).result);
}

export function buildFlowGrid(history: DayHistory[]): {
  weeks: number;
  completedBy: number[][];
  unusedByTeamWeek: { teamId: number; week: number; unused: number }[];
} {
  const weeks =
    history.length === 0
      ? 0
      : Math.ceil(history[history.length - 1]!.day / DAYS_PER_WEEK);
  const completedBy: number[][] = Array.from({ length: TOTAL_UNITS }, () =>
    Array.from({ length: Math.max(weeks, 1) }, () => -1),
  );

  for (const h of history) {
    const w = Math.ceil(h.day / DAYS_PER_WEEK) - 1;
    for (let ti = 0; ti < h.teams.length; ti++) {
      for (const z of h.teams[ti]!.zonesCompleted) {
        if (z >= 0 && z < TOTAL_UNITS && w >= 0) {
          completedBy[z]![w] = ti;
        }
      }
    }
  }

  const unusedByTeamWeek: {
    teamId: number;
    week: number;
    unused: number;
  }[] = [];
  const map = new Map<string, number>();
  for (const h of history) {
    const w = Math.ceil(h.day / DAYS_PER_WEEK) - 1;
    for (let ti = 0; ti < h.teams.length; ti++) {
      const u = h.teams[ti]!.unused;
      if (u > 0) {
        const key = `${ti}-${w}`;
        map.set(key, (map.get(key) ?? 0) + u);
      }
    }
  }
  for (const [key, unused] of map) {
    const [ti, w] = key.split("-").map(Number);
    unusedByTeamWeek.push({ teamId: ti!, week: w!, unused });
  }

  return { weeks: Math.max(weeks, 1), completedBy, unusedByTeamWeek };
}

export { diceLabel, makeConfig, defaultConfig, zoneLabel };
