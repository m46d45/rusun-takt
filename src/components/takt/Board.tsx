import {
  FLOORS,
  TEAMS,
  UNITS_PER_FLOOR,
  TOTAL_UNITS,
  ZONE_LABELS,
  diceLabel,
  startLabel,
  zoneLabel,
} from "@/lib/takt/constants";
import type { FloorCure, SimConfig, TeamState } from "@/lib/takt/types";
import { cn, formatRp } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BuildingView } from "./BuildingView";
import { HelmetBadge } from "./Helmet";

function statusTone(
  s: TeamState["status"],
): "neutral" | "ok" | "warn" | "danger" | "info" {
  if (s === "done") return "ok";
  if (s === "working") return "info";
  if (s === "curing") return "warn";
  if (s === "blocked") return "danger";
  return "neutral";
}

function formatCostRibuan(fullRp: number): string {
  return String(Math.round(fullRp / 1000));
}

function wastePct(waste: number, total: number): number | null {
  if (total <= 0) return null;
  return (waste / total) * 100;
}

function formatPct(p: number | null): string {
  if (p === null) return "—";
  return `${p.toFixed(0)}%`;
}

export function Board({
  teams,
  floors,
  day,
  config,
}: {
  teams: TeamState[];
  floors: FloorCure[];
  day: number;
  config: SimConfig;
}) {
  const maxWaste = Math.max(0, ...teams.map((t) => t.wasteCost));

  return (
    <div className="space-y-4">
      <BuildingView teams={teams} floors={floors} day={day} />

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-2 grid gap-2 sm:grid-cols-3">
          {[...Array(FLOORS)].map((_, f) => {
            const cure = floors[f]!;
            const curing =
              cure.pouredDay !== null &&
              !cure.formworkStripped &&
              cure.readyDay !== null &&
              day < cure.readyDay;
            const ready = cure.formworkStripped;
            const remain =
              curing && cure.readyDay !== null
                ? Math.max(0, cure.readyDay - day)
                : 0;
            return (
              <div
                key={f}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2",
                  curing && "border-warn/40 bg-warn/5",
                  ready && "border-ok/30 bg-ok/5",
                  !cure.pouredDay && "border-border bg-surface-2",
                )}
              >
                <span className="text-sm font-medium text-fg">Lt.{f + 1}</span>
                {!cure.pouredDay && <Badge>Pelat</Badge>}
                {curing && <Badge tone="warn">Curing {remain}h</Badge>}
                {ready && <Badge tone="ok">Siap</Badge>}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-subtle">
          Zona: {ZONE_LABELS.join(" · ")} · curing per zona 7 hari
        </p>
      </div>

      <div className="space-y-2">
        {TEAMS.map((def, i) => {
          const t = teams[i]!;
          const setup = config.teams[i]!;
          const pct = Math.min(100, (t.progress / TOTAL_UNITS) * 100);
          const teamCost = t.daysOnSite * setup.dailyCost;
          const wPct = wastePct(t.wasteCost, teamCost);
          const isMaxWaste = maxWaste > 0 && t.wasteCost === maxWaste;

          return (
            <div
              key={def.id}
              className={cn(
                "rounded-lg border bg-surface-2 px-3 py-2.5",
                isMaxWaste ? "border-danger/50" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <HelmetBadge
                    color={def.color}
                    label={i + 1}
                    size={36}
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
                  <div>
                    <p className="text-sm font-medium text-fg">{def.short}</p>
                    <p className="text-[11px] text-subtle">
                      {formatCostRibuan(setup.dailyCost)}/hari · var{" "}
                      {diceLabel(setup.diceMin, setup.diceMax)} ·{" "}
                      {startLabel(setup.startWeek)}
                      {t.progress > 0 || t.status === "working"
                        ? ` · ${zoneLabel(Math.min(t.progress, TOTAL_UNITS - 1))}`
                        : ""}
                      {t.status === "working" && t.zoneDaysTotal > 0
                        ? ` · sisa ${t.zoneDaysLeft}h`
                        : ""}
                    </p>
                  </div>
                </div>
                <Badge tone={statusTone(t.status)}>{t.statusLabel}</Badge>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-subtle">Biaya tim</p>
                  <p className="tabular font-semibold text-fg">
                    {teamCost > 0 ? formatRp(teamCost) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-subtle">Waste</p>
                  <p
                    className={cn(
                      "tabular font-semibold",
                      isMaxWaste && t.wasteCost > 0
                        ? "text-danger"
                        : t.wasteCost > 0
                          ? "text-fg"
                          : "text-subtle",
                    )}
                  >
                    {t.wasteCost > 0 ? formatRp(t.wasteCost) : "—"}
                    {isMaxWaste && t.wasteCost > 0 ? " ↑" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-subtle">Waste %</p>
                  <p
                    className={cn(
                      "tabular font-semibold",
                      isMaxWaste && t.wasteCost > 0
                        ? "text-danger"
                        : wPct !== null && wPct > 0
                          ? "text-fg"
                          : "text-subtle",
                    )}
                  >
                    {formatPct(wPct)}
                  </p>
                </div>
              </div>

              <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                  style={{ width: `${pct}%`, backgroundColor: def.color }}
                />
                {[1, 2].map((mark) => (
                  <div
                    key={mark}
                    className="absolute inset-y-0 w-px bg-border-strong"
                    style={{
                      left: `${(mark * UNITS_PER_FLOOR * 100) / TOTAL_UNITS}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
