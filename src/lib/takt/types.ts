/** Domain types — Rusun Takt */

export interface DiceRangeOption {
  id: string;
  min: number;
  max: number;
  label: string;
  hint: string;
}

export interface TeamDef {
  id: number;
  name: string;
  short: string;
  color: string;
  colorFg: string;
}

export interface TeamSetup {
  startWeek: number;
  diceMin: number;
  diceMax: number;
  dailyCost: number;
}

export interface SimConfig {
  teams: TeamSetup[];
  name?: string;
  ownerDurationDays: number;
  contractValue: number;
}

export interface TeamState {
  progress: number;
  lastRoll: number;
  lastWorked: number;
  status: "idle" | "working" | "blocked" | "curing" | "done" | "waiting";
  statusLabel: string;
  totalWorked: number;
  waitDays: number;
  wasteCost: number;
  daysOnSite: number;
  capacityTotal: number;
  unusedCapacity: number;
  finishDay: number | null;
  weeklyCapacity: number[];
  weeklyUnused: number[];
  zoneDaysLeft: number;
  zoneDaysTotal: number;
  mobilized: boolean;
  /** Durasi (hari) setiap zona yang diselesaikan — untuk min/max/avg */
  zoneDurations: number[];
}

export interface DayHistory {
  day: number;
  teams: {
    roll: number;
    worked: number;
    unused: number;
    onSite: boolean;
    zonesCompleted: number[];
    waitingZone: number | null;
    /** Zona yang sedang dikerjakan hari ini (bukan hanya saat selesai) */
    activeZone: number | null;
  }[];
}

export interface ZoneCure {
  pouredDay: number | null;
  readyDay: number | null;
  stripped: boolean;
}

export interface FloorCure {
  pouredDay: number | null;
  readyDay: number | null;
  formworkStripped: boolean;
}

export interface SimMetrics {
  day: number;
  totalLaborDays: number;
  totalCost: number;
  wasteCost: number;
  waitDays: number;
  finished: boolean;
  finishDay: number | null;
}

export interface ProjectFinance {
  ownerDurationDays: number;
  contractValue: number;
  finishDay: number;
  lateDays: number;
  penalty: number;
  laborCost: number;
  wasteCost: number;
  margin: number;
  marginPct: number;
  onTime: boolean;
}

export interface SimSnapshot {
  day: number;
  teams: TeamState[];
  zoneCures: ZoneCure[];
  floors: FloorCure[];
  metrics: SimMetrics;
  log: string[];
  finished: boolean;
  config: SimConfig;
  history: DayHistory[];
}

export interface RunResult {
  name: string;
  finishDay: number;
  totalCost: number;
  wasteCost: number;
  waitDays: number;
  totalLaborDays: number;
  diceLabel: string;
  lateDays: number;
  penalty: number;
  margin: number;
  marginPct: number;
}

export type TradeDef = TeamDef;
export type TradeSetup = TeamSetup;
export type TradeState = TeamState;
