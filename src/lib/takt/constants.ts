import type { DiceRangeOption, SimConfig, TeamDef, TeamSetup } from "./types";

export const FLOORS = 3;

export const ZONES_PER_FLOOR = 5;
export const ZONE_LABELS = ["U1", "U2", "Tangga", "U3", "U4"] as const;

export const UNITS_PER_FLOOR = ZONES_PER_FLOOR;
export const TOTAL_UNITS = FLOORS * ZONES_PER_FLOOR;

export const CURING_DAYS = 7;
export const DAYS_PER_WEEK = 7;

export const DEFAULT_DAILY_COST = 350_000;

export const MAX_START_WEEK = 7;

/** startWeek = -1 → Just-in-Time */
export const START_JIT = -1;

export const CAP_MIN = 1;
export const CAP_MAX = 9;
export const DEFAULT_CAP_LO = 1;
export const DEFAULT_CAP_HI = 6;

export const DEFAULT_OWNER_DURATION = 120;
/** Default nilai kontrak Rp 210 juta */
export const DEFAULT_CONTRACT_VALUE = 210_000_000;

export const PENALTY_PER_DAY_FRACTION = 1 / 1000;

export const SPEED_OPTIONS = [
  { value: 1000, label: "Lambat · 1 dtk/hari" },
  { value: 450, label: "Normal · 0,5 dtk" },
  { value: 80, label: "Cepat" },
] as const;

export const DEFAULT_SPEED_MS = 450;

export const DICE_RANGES: DiceRangeOption[] = [
  { id: "1-6", min: 1, max: 6, label: "1–6", hint: "Variasi sedang" },
  { id: "1-9", min: 1, max: 9, label: "1–9", hint: "Variasi lebar" },
  { id: "2-2", min: 2, max: 2, label: "2–2", hint: "Konstan 2 hari" },
  { id: "3-3", min: 3, max: 3, label: "3–3", hint: "Konstan 3 hari" },
];

export const TEAMS: TeamDef[] = [
  {
    id: 0,
    name: "Kolom & balok",
    short: "Struktur",
    color: "#6b7280",
    colorFg: "#f9fafb",
  },
  {
    id: 1,
    name: "Pelat & tangga",
    short: "Pelat",
    color: "#eab308",
    colorFg: "#1c1917",
  },
  {
    id: 2,
    name: "Dinding & pasangan",
    short: "Dinding",
    color: "#dc2626",
    colorFg: "#fef2f2",
  },
  {
    id: 3,
    name: "MEP",
    short: "MEP",
    color: "#16a34a",
    colorFg: "#f0fdf4",
  },
  {
    id: 4,
    name: "Plester & acian",
    short: "Plester",
    color: "#9333ea",
    colorFg: "#faf5ff",
  },
  {
    id: 5,
    name: "Keramik & plafon",
    short: "Keramik",
    color: "#ea580c",
    colorFg: "#fff7ed",
  },
  {
    id: 6,
    name: "Pengecatan",
    short: "Cat",
    color: "#38bdf8",
    colorFg: "#0c4a6e",
  },
];

export const TRADES = TEAMS;

export function defaultTeamSetup(
  diceMin = DEFAULT_CAP_LO,
  diceMax = DEFAULT_CAP_HI,
  startWeek = 0,
  dailyCost = DEFAULT_DAILY_COST,
): TeamSetup {
  return { startWeek, diceMin, diceMax, dailyCost };
}

export function makeConfig(
  diceMin: number,
  diceMax: number,
  startWeeks?: number[],
  name?: string,
  dailyCost = DEFAULT_DAILY_COST,
  ownerDurationDays = DEFAULT_OWNER_DURATION,
  contractValue = DEFAULT_CONTRACT_VALUE,
): SimConfig {
  return {
    name,
    ownerDurationDays,
    contractValue,
    teams: TEAMS.map((_, i) =>
      defaultTeamSetup(diceMin, diceMax, startWeeks?.[i] ?? 0, dailyCost),
    ),
  };
}

export function defaultConfig(): SimConfig {
  return makeConfig(DEFAULT_CAP_LO, DEFAULT_CAP_HI, undefined, "default");
}

export function diceLabel(min: number, max: number): string {
  return min === max ? `${min}–${min} (konstan)` : `${min}–${max}`;
}

export function startLabel(startWeek: number): string {
  if (startWeek === START_JIT) return "JIT";
  return `M${startWeek + 1}`;
}

export function isJitStart(startWeek: number): boolean {
  return startWeek === START_JIT;
}

export function configDiceSummary(config: SimConfig): string {
  const first = config.teams[0]!;
  const allSame = config.teams.every(
    (t) => t.diceMin === first.diceMin && t.diceMax === first.diceMax,
  );
  if (allSame) return diceLabel(first.diceMin, first.diceMax);
  return "campuran";
}

export function weekToStartDay(startWeek: number): number {
  if (startWeek < 0) return 1; // JIT: eligible from day 1 if zone free
  return Math.max(0, startWeek) * DAYS_PER_WEEK + 1;
}

export function dayToWeekNumber(day: number): number {
  if (day <= 0) return 0;
  return Math.ceil(day / DAYS_PER_WEEK);
}

export function formatDayWeek(day: number): string {
  if (day <= 0) return "Belum mulai";
  return `Minggu ${dayToWeekNumber(day)} · hari ${day}`;
}

export function formatDuration(days: number): string {
  if (days <= 0) return "0 hari";
  const w = days / DAYS_PER_WEEK;
  const approx =
    Number.isInteger(w) || Math.abs(w - Math.round(w)) < 0.05
      ? `${Math.round(w)} minggu`
      : `≈ ${w.toFixed(1)} minggu`;
  return `${days} hari (${approx})`;
}

export function zoneLabel(progressOrZone: number): string {
  if (progressOrZone >= TOTAL_UNITS) return "Selesai";
  const floor = Math.floor(progressOrZone / UNITS_PER_FLOOR);
  const z = progressOrZone % UNITS_PER_FLOOR;
  return `Lt.${floor + 1} ${ZONE_LABELS[z]}`;
}

export function floorOfProgress(progress: number): number {
  if (progress >= TOTAL_UNITS) return FLOORS - 1;
  return Math.min(FLOORS - 1, Math.floor(progress / UNITS_PER_FLOOR));
}
