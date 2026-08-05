import { formatDuration } from "@/lib/takt/constants";
import type { RunResult } from "@/lib/takt/types";
import { formatNumber, formatRp } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function wastePct(waste: number, total: number): string {
  if (total <= 0) return "—";
  return `${((waste / total) * 100).toFixed(0)}%`;
}

export function Debrief({ results }: { results: RunResult[] }) {
  if (results.length === 0) return null;

  const bestMargin = [...results].sort((a, b) => b.margin - a.margin)[0]!;
  const leastWaste = [...results].sort((a, b) => a.wasteCost - b.wasteCost)[0]!;
  const fastest = [...results].sort((a, b) => a.finishDay - b.finishDay)[0]!;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="font-display text-2xl text-fg">Perbandingan</h2>
      <p className="mt-1 text-sm text-muted">
        Durasi owner & nilai kontrak sama · beda variasi kapasitas.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-subtle">
              <th className="py-2 pr-3 font-medium">Setup</th>
              <th className="py-2 pr-3 font-medium">Durasi</th>
              <th className="py-2 pr-3 font-medium">Biaya</th>
              <th className="py-2 pr-3 font-medium">Penalti</th>
              <th className="py-2 pr-3 font-medium">Margin</th>
              <th className="py-2 font-medium">Waste %</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr
                key={r.name}
                className="border-b border-border/70 last:border-0"
              >
                <td className="py-3 pr-3">
                  <div className="font-medium text-fg">{r.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.name === bestMargin.name && (
                      <Badge tone="ok">Margin↑</Badge>
                    )}
                    {r.name === leastWaste.name && (
                      <Badge tone="info">Waste↓</Badge>
                    )}
                    {r.name === fastest.name && (
                      <Badge tone="neutral">Cepat</Badge>
                    )}
                  </div>
                </td>
                <td className="py-3 pr-3 text-fg">
                  <div className="tabular font-medium">{r.finishDay}h</div>
                  <div className="text-[11px] text-subtle">
                    {formatDuration(r.finishDay)}
                    {r.lateDays > 0 ? ` · +${r.lateDays}h` : ""}
                  </div>
                </td>
                <td className="tabular py-3 pr-3 font-medium text-fg">
                  {formatRp(r.totalCost)}
                </td>
                <td className="tabular py-3 pr-3 font-medium text-danger">
                  {formatRp(r.penalty)}
                </td>
                <td
                  className={
                    r.margin >= 0
                      ? "tabular py-3 pr-3 font-medium text-ok"
                      : "tabular py-3 pr-3 font-medium text-danger"
                  }
                >
                  {formatRp(r.margin)}
                  <div className="text-[11px]">{r.marginPct.toFixed(1)}%</div>
                </td>
                <td className="tabular py-3 text-fg">
                  {wastePct(r.wasteCost, r.totalCost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
