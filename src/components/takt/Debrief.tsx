import { formatDuration } from "@/lib/takt/constants";
import type { RunResult } from "@/lib/takt/types";
import {
  buildDebriefCopy,
  type DebriefKind,
} from "@/lib/takt/workshop";
import { formatRp } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function wastePct(waste: number, total: number): string {
  if (total <= 0) return "—";
  return `${((waste / total) * 100).toFixed(0)}%`;
}

export function Debrief({
  results,
  kind = "capacity",
}: {
  results: RunResult[];
  kind?: DebriefKind;
}) {
  if (results.length === 0) return null;

  const bestMargin = [...results].sort((a, b) => b.margin - a.margin)[0]!;
  const leastWaste = [...results].sort((a, b) => a.wasteCost - b.wasteCost)[0]!;
  const fastest = [...results].sort((a, b) => a.finishDay - b.finishDay)[0]!;
  const { findings, questions } = buildDebriefCopy(results, kind);

  const heading =
    kind === "push-jit"
      ? "Debrief: Push vs JIT"
      : kind === "single"
        ? "Debrief run"
        : "Debrief: variasi kapasitas";

  const sub =
    kind === "push-jit"
      ? "Kapasitas & kontrak sama · beda hanya cara memulai tim."
      : kind === "single"
        ? "Ringkasan pembelajaran dari run yang baru selesai."
        : "Durasi owner & nilai kontrak sama · beda variasi kapasitas.";

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="font-display text-2xl text-fg">{heading}</h2>
      <p className="mt-1 text-sm text-muted">{sub}</p>

      {findings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50/80 p-3 sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">
            Temuan kunci
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-sky-950">
            {findings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {questions.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-950">
            Diskusi
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-amber-950">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

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
