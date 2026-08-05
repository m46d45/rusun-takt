import { formatDuration } from "@/lib/takt/constants";
import type { ProjectFinance, SimMetrics, TeamState } from "@/lib/takt/types";
import { formatNumber, formatRp, cn } from "@/lib/utils";

function wastePct(waste: number, total: number): string {
  if (total <= 0) return "—";
  return `${((waste / total) * 100).toFixed(0)}%`;
}

export function MetricsPanel({
  metrics,
  teams,
  finance,
}: {
  metrics: SimMetrics;
  teams: TeamState[];
  finance: ProjectFinance;
}) {
  const waitDays = teams.reduce((s, t) => s + t.waitDays, 0);
  const pct = wastePct(metrics.wasteCost, metrics.totalCost);
  const running = !metrics.finished && metrics.day > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">
          Metrik
        </p>
        <div className="mt-3 space-y-3">
          <Stat
            label="Durasi aktual"
            value={
              metrics.finishDay
                ? formatDuration(metrics.finishDay)
                : metrics.day > 0
                  ? `Hari ${metrics.day}`
                  : "—"
            }
          />
          <Stat
            label="Durasi proyek rusun"
            value={`${finance.ownerDurationDays} hari`}
          />
          <Stat label="Biaya tenaga" value={formatRp(metrics.totalCost)} />
          <Stat
            label="Waste (menunggu)"
            value={formatRp(metrics.wasteCost)}
            danger={metrics.wasteCost > 0}
          />
          <Stat
            label="Waste % dari biaya"
            value={pct}
            danger={metrics.wasteCost > 0}
          />
          <Stat label="Hari menunggu" value={formatNumber(waitDays)} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-subtle">
            Kontrak & margin
          </p>
          {running ? (
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-400">
              live
            </span>
          ) : null}
        </div>
        <div className="mt-3 space-y-3">
          <Stat label="Kontrak (porsi tenaga)" value={formatRp(finance.contractValue)} />
          <Stat
            label={
              finance.lateDays > 0
                ? running
                  ? `Terlambat ${finance.lateDays} hari (berjalan)`
                  : `Terlambat ${finance.lateDays} hari`
                : "Ketepatan waktu"
            }
            value={
              finance.lateDays > 0
                ? `+${finance.lateDays}h vs owner`
                : metrics.day === 0
                  ? "Belum mulai"
                  : "Dalam target"
            }
            danger={finance.lateDays > 0}
            ok={finance.lateDays === 0 && metrics.day > 0}
          />
          <Stat
            label="Penalti"
            value={formatRp(finance.penalty)}
            danger={finance.penalty > 0}
          />
          <Stat
            label="Margin"
            value={`${formatRp(finance.margin)} (${finance.marginPct.toFixed(1)}%)`}
            danger={finance.margin < 0}
            ok={finance.margin > 0}
          />
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-subtle">
          Biaya & kontrak di sini = tenaga kerja saja. Material dari kontraktor
          utama (bukan kendala, tidak dihitung). Penalti = terlambat × (1/1000)
          × kontrak tenaga. Margin = kontrak − biaya tenaga − penalti.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  danger,
  ok,
}: {
  label: string;
  value: string;
  danger?: boolean;
  ok?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] text-subtle">{label}</p>
      <p
        className={cn(
          "tabular text-sm font-semibold",
          danger ? "text-danger" : ok ? "text-ok" : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}
