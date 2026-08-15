import { useEffect, useState } from "react";
import {
  formatStat,
  loadUsageStats,
  recordUniqueVisit,
  subscribeUsageStats,
  type UsageStats,
} from "@/lib/takt/stats";

export function UsageStatsBar() {
  const [stats, setStats] = useState<UsageStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void recordUniqueVisit().then((s) => {
      if (!cancelled) setStats(s);
    });
    const unsub = subscribeUsageStats((s) => setStats(s));
    const poll = window.setInterval(() => {
      void loadUsageStats().then((s) => {
        if (!cancelled) setStats(s);
      });
    }, 60_000);
    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(poll);
    };
  }, []);

  return (
    <div
      className="flex flex-wrap items-stretch gap-2"
      aria-label="Statistik penggunaan"
    >
      <StatChip
        label="Pengunjung"
        value={stats ? formatStat(stats.visitors) : "…"}
        hint="Perangkat unik yang pernah membuka aplikasi"
      />
      <StatChip
        label="Simulasi"
        value={stats ? formatStat(stats.simulations) : "…"}
        hint="Berapa kali tombol Start / bandingkan dijalankan"
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      title={hint}
      className="min-w-[7.5rem] rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
        {label}
      </p>
      <p className="font-display text-xl tabular-nums leading-tight text-sky-950">
        {value}
      </p>
    </div>
  );
}
