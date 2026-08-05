import {
  FLOORS,
  TEAMS,
  TOTAL_UNITS,
  UNITS_PER_FLOOR,
  ZONE_LABELS,
} from "@/lib/takt/constants";
import type { FloorCure, TeamState } from "@/lib/takt/types";
import { cn } from "@/lib/utils";
import { HelmetBadge } from "./Helmet";
import { Check } from "lucide-react";

const C_STRUCT = "#6b7280";
const C_SLAB = "#eab308";
const C_WALL = "#dc2626";
const C_MEP = "#16a34a";
const C_PLASTER = "#9333ea";
const C_TILE = "#ea580c";
const C_PAINT = "#38bdf8";

function floorFraction(progress: number, floor: number): number {
  const start = floor * UNITS_PER_FLOOR;
  const end = start + UNITS_PER_FLOOR;
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  return (progress - start) / UNITS_PER_FLOOR;
}

function highestDoneTeam(teams: TeamState[], floor: number): number {
  let best = -1;
  for (let i = 0; i < teams.length; i++) {
    if (teams[i]!.progress >= (floor + 1) * UNITS_PER_FLOOR) best = i;
  }
  return best;
}

function isZoneComplete(teams: TeamState[], absoluteZone: number): boolean {
  const last = teams[TEAMS.length - 1];
  if (!last) return false;
  return last.progress > absoluteZone;
}

/**
 * Helm hanya muncul jika tim benar-benar di site & aktif di zona itu
 * (working / blocked / curing). Progress 0 + belum start → jangan tampil.
 *
 * Penting: jangan tampilkan SEMUA tim yang menunggu di zona yang sama
 * (dulu: 7 helm menumpuk di U1, yang kelihatan hanya #7 di atas).
 * Per zona: prioritaskan yang working; jika hanya menunggu, tampilkan
 * wagon terdepan (team id terkecil) saja.
 */
function teamsOnFloor(teams: TeamState[], floor: number) {
  const candidates = teams
    .map((t, i) => {
      if (t.progress >= TOTAL_UNITS) return null;
      if (!t.mobilized) return null;
      if (
        t.status !== "working" &&
        t.status !== "blocked" &&
        t.status !== "curing"
      ) {
        return null;
      }
      const f = Math.floor(t.progress / UNITS_PER_FLOOR);
      if (f !== floor) return null;
      const z = t.progress % UNITS_PER_FLOOR;
      return { t, i, zone: z };
    })
    .filter(Boolean) as { t: TeamState; i: number; zone: number }[];

  const byZone = new Map<number, typeof candidates>();
  for (const c of candidates) {
    const list = byZone.get(c.zone) ?? [];
    list.push(c);
    byZone.set(c.zone, list);
  }

  const result: typeof candidates = [];
  for (const list of byZone.values()) {
    const working = list.filter((c) => c.t.status === "working");
    if (working.length > 0) {
      // Satu zona hanya satu yang boleh kerja — ambil yang working
      result.push(working[0]!);
      continue;
    }
    // Hanya menunggu: wagon terdepan (id terkecil) di zona itu
    list.sort((a, b) => a.i - b.i);
    result.push(list[0]!);
  }
  return result;
}

export function BuildingView({
  teams,
  floors,
  day,
}: {
  teams: TeamState[];
  floors: FloorCure[];
  day: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-xl text-fg sm:text-2xl">
          Rusun 3 lantai
        </h2>
        {day > 0 ? (
          <p className="tabular text-sm text-muted">Hari {day}</p>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TEAMS.map((def, i) => (
          <div
            key={def.id}
            className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-fg"
          >
            <HelmetBadge color={def.color} label={i + 1} size={22} />
            {def.short}
          </div>
        ))}
        <div className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          Zona selesai
        </div>
      </div>

      <div className="relative mx-auto max-w-xl">
        <div className="mx-auto flex w-11/12 justify-center">
          <div
            className="h-0 w-full border-b-[18px] border-l-[20px] border-r-[20px] border-l-transparent border-r-transparent"
            style={{ borderBottomColor: C_STRUCT }}
            aria-hidden
          />
        </div>
        <div
          className="mx-auto w-11/12 overflow-hidden rounded-t-md border-2 border-b-0 bg-slate-100"
          style={{ borderColor: C_STRUCT }}
        >
          {[...Array(FLOORS)].map((_, rev) => {
            const f = FLOORS - 1 - rev;
            return (
              <FloorStrip
                key={f}
                floor={f}
                teams={teams}
                cure={floors[f]!}
                day={day}
              />
            );
          })}
        </div>
        <div
          className="mx-auto w-[96%] rounded-b-md border-2 px-3 py-2"
          style={{ borderColor: `${C_STRUCT}aa`, backgroundColor: "#4b5563" }}
        >
          <div className="text-[10px] uppercase tracking-wide text-zinc-100">
            Fondasi & sloof
          </div>
          <div
            className="mt-1.5 h-2 rounded-sm"
            style={{ backgroundColor: C_STRUCT }}
          />
        </div>
      </div>
    </div>
  );
}

function GreenCheck({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md ring-2 ring-emerald-200/90",
        className,
      )}
      title="Zona selesai"
    >
      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} />
    </span>
  );
}

function UnitCell({
  label,
  showFrame,
  showWalls,
  hasSlab,
  slabFrac,
  hasMep,
  hasFinish,
  hasPlaster,
  hasPaint,
  occupied,
  complete,
}: {
  label: string;
  showFrame: boolean;
  showWalls: boolean;
  hasSlab: boolean;
  slabFrac: number;
  hasMep: boolean;
  hasFinish: boolean;
  hasPlaster: boolean;
  hasPaint: boolean;
  occupied?: boolean;
  complete?: boolean;
}) {
  // Base cerah; gelap hanya seiring progres finishing
  let bg = "#f1f5f9";
  if (hasPaint) bg = "#e0f2fe";
  else if (hasPlaster) bg = "#f3e8ff";
  else if (showWalls) bg = "#fee2e2";
  else if (showFrame) bg = "#e2e8f0";

  return (
    <div
      className={cn(
        "relative min-w-0 flex-1",
        occupied && "ring-1 ring-inset ring-sky-500/60",
        complete && "ring-2 ring-inset ring-emerald-500/70",
      )}
      style={{ background: bg }}
    >
      <span className="absolute left-1 top-1 z-[1] text-[8px] font-medium text-slate-500">
        {label}
      </span>
      {complete ? (
        <GreenCheck className="h-7 w-7 sm:h-8 sm:w-8" />
      ) : null}
      {showFrame ? (
        <>
          <div
            className="absolute bottom-0 left-1 top-2 w-1.5 rounded-sm"
            style={{ backgroundColor: C_STRUCT }}
          />
          <div
            className="absolute bottom-0 right-1 top-2 w-1.5 rounded-sm"
            style={{ backgroundColor: C_STRUCT }}
          />
          <div
            className="absolute left-1 right-1 top-2 h-1.5 rounded-sm"
            style={{ backgroundColor: C_STRUCT }}
          />
        </>
      ) : null}
      {hasSlab || slabFrac > 0 ? (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: hasSlab ? "18%" : `${Math.max(4, slabFrac * 18)}%`,
            backgroundColor: C_SLAB,
            opacity: hasSlab ? 0.85 : 0.45,
          }}
        />
      ) : null}
      {showWalls ? (
        <div
          className="absolute inset-x-3 bottom-2 top-5 rounded-sm border-2"
          style={{ borderColor: C_WALL, backgroundColor: `${C_WALL}22` }}
        />
      ) : null}
      {hasMep ? (
        <div
          className="absolute right-2 top-3 h-2 w-2 rounded-full"
          style={{ backgroundColor: C_MEP }}
        />
      ) : null}
      {hasPlaster ? (
        <div
          className="absolute left-2 bottom-3 h-1.5 w-6 rounded-sm"
          style={{ backgroundColor: C_PLASTER }}
        />
      ) : null}
      {hasFinish ? (
        <div
          className="absolute right-2 bottom-3 h-1.5 w-6 rounded-sm"
          style={{ backgroundColor: C_TILE }}
        />
      ) : null}
      {hasPaint ? (
        <div
          className="absolute inset-x-4 top-4 h-1 rounded-full"
          style={{ backgroundColor: C_PAINT }}
        />
      ) : null}
    </div>
  );
}

function FloorStrip({
  floor,
  teams,
  cure,
  day,
}: {
  floor: number;
  teams: TeamState[];
  cure: FloorCure;
  day: number;
}) {
  const done = highestDoneTeam(teams, floor);
  const curing =
    cure.pouredDay !== null &&
    !cure.formworkStripped &&
    cure.readyDay !== null &&
    day < cure.readyDay;
  const remain =
    curing && cure.readyDay !== null ? Math.max(0, cure.readyDay - day) : 0;

  const hasFrame = done >= 0;
  const hasSlab = done >= 1;
  const hasWalls = done >= 2;
  const hasMep = done >= 3;
  const hasPlaster = done >= 4;
  const hasFinish = done >= 5;
  const hasPaint = done >= 6;

  const onFloor = teamsOnFloor(teams, floor);
  const frameFrac = floorFraction(teams[0]!.progress, floor);
  const slabFrac = floorFraction(teams[1]!.progress, floor);
  const wallFrac = floorFraction(teams[2]!.progress, floor);

  const base = floor * UNITS_PER_FLOOR;
  const complete = [0, 1, 2, 3, 4].map((zi) =>
    isZoneComplete(teams, base + zi),
  );

  function zoneLeft(zone: number): string {
    if (zone === 0) return "10%";
    if (zone === 1) return "30%";
    if (zone === 2) return "50%";
    if (zone === 3) return "70%";
    return "90%";
  }

  const occupiedZones = new Set(onFloor.map((x) => x.zone));

  const unitProps = (zone: number, label: string) => ({
    label,
    showFrame: hasFrame || frameFrac > zone / 5,
    showWalls: hasWalls || wallFrac > zone / 5,
    hasSlab,
    slabFrac,
    hasMep,
    hasFinish,
    hasPlaster,
    hasPaint,
    occupied: occupiedZones.has(zone),
    complete: complete[zone],
  });

  return (
    <div
      className={cn(
        "relative border-b-2 last:border-b-0",
        curing ? "border-yellow-400/60 bg-yellow-100/80" : "border-slate-300",
      )}
    >
      <div className="relative flex min-h-[5.5rem] sm:min-h-[6.5rem]">
        <div className="relative flex min-w-0 flex-[2]">
          <UnitCell {...unitProps(0, "U1")} />
          <div className="w-px bg-slate-300" />
          <UnitCell {...unitProps(1, "U2")} />
        </div>
        <div
          className={cn(
            "relative w-12 shrink-0 border-x-2 sm:w-14",
            occupiedZones.has(2) && "ring-1 ring-inset ring-sky-500/60",
            complete[2] && "ring-2 ring-inset ring-emerald-500/70",
          )}
          style={{
            backgroundColor: hasSlab ? "#fef08a" : "#cbd5e1",
            borderColor: hasSlab ? C_SLAB : C_STRUCT,
          }}
        >
          <div className="absolute inset-x-1 top-2 bottom-2 flex flex-col justify-between">
            {[0, 1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className="h-1.5 rounded-sm"
                style={{
                  backgroundColor: hasSlab ? C_SLAB : "#64748b",
                  marginLeft: s % 2 === 0 ? "8%" : "35%",
                  marginRight: s % 2 === 0 ? "35%" : "8%",
                }}
              />
            ))}
          </div>
          <p className="absolute inset-x-0 bottom-1 z-[1] text-center text-[8px] font-bold uppercase text-slate-800">
            Tangga
          </p>
          {complete[2] ? (
            <GreenCheck className="h-7 w-7 sm:h-8 sm:w-8" />
          ) : null}
          {curing && !complete[2] ? (
            <div className="absolute inset-0 z-[1] flex items-center justify-center bg-yellow-400/45">
              <span className="-rotate-90 whitespace-nowrap text-[10px] font-bold text-yellow-950">
                Curing {remain}h
              </span>
            </div>
          ) : null}
        </div>
        <div className="relative flex min-w-0 flex-[2]">
          <UnitCell {...unitProps(3, "U3")} />
          <div className="w-px bg-slate-300" />
          <UnitCell {...unitProps(4, "U4")} />
        </div>

        <div className="pointer-events-none absolute inset-0 z-10">
          {onFloor.map(({ t, i, zone }) => {
            if (complete[zone]) return null;
            const def = TEAMS[i]!;
            return (
              <div
                key={def.id}
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500",
                  t.status === "working" && "scale-110",
                )}
                style={{ left: zoneLeft(zone) }}
                title={`${def.short}: ${ZONE_LABELS[zone]} · ${t.statusLabel}`}
              >
                <HelmetBadge
                  color={def.color}
                  label={i + 1}
                  size={34}
                  ring={
                    t.status === "working"
                      ? "#38bdf8"
                      : t.status === "blocked"
                        ? "#f87171"
                        : t.status === "curing"
                          ? "#facc15"
                          : undefined
                  }
                />
              </div>
            );
          })}
        </div>

        <div className="absolute left-2 top-1.5 z-20 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 shadow-sm">
          Lt.{floor + 1}
        </div>
      </div>
    </div>
  );
}
