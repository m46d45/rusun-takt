import {
  DEFAULT_CONTRACT_VALUE,
  DEFAULT_DAILY_COST,
  DEFAULT_OWNER_DURATION,
  START_JIT,
  TEAMS,
  formatDuration,
  makeConfig,
} from "./constants";
import type { ProjectFinance, RunResult, SimConfig, SimSnapshot } from "./types";
import { formatRp } from "@/lib/utils";

export type WorkshopScenarioId =
  | "push-16"
  | "jit-77"
  | "jit-33"
  | "compare-push-jit";

export type WorkshopScenario = {
  id: WorkshopScenarioId;
  letter: string;
  title: string;
  blurb: string;
  /** Jika true, jalankan perbandingan Push vs JIT, bukan animasi tunggal */
  compare: boolean;
  build: () => SimConfig;
};

function allStarts(startWeek: number): number[] {
  return TEAMS.map(() => startWeek);
}

export const WORKSHOP_SCENARIOS: WorkshopScenario[] = [
  {
    id: "push-16",
    letter: "A",
    title: "Push · Minggu 1 · 1–6",
    blurb:
      "Semua tim start minggu 1; kapasitas zona acak 1–6 hari. Amati idle (waste) saat menunggu.",
    compare: false,
    build: () =>
      makeConfig(
        1,
        6,
        allStarts(0),
        "Push · M1 · 1–6",
        DEFAULT_DAILY_COST,
        DEFAULT_OWNER_DURATION,
        DEFAULT_CONTRACT_VALUE,
      ),
  },
  {
    id: "jit-77",
    letter: "B",
    title: "JIT · kapasitas 7–7",
    blurb:
      "Just-in-Time: tim baru dibayar saat zona siap. Kapasitas konstan 7 hari/zona.",
    compare: false,
    build: () =>
      makeConfig(
        7,
        7,
        allStarts(START_JIT),
        "JIT · 7–7",
        DEFAULT_DAILY_COST,
        DEFAULT_OWNER_DURATION,
        DEFAULT_CONTRACT_VALUE,
      ),
  },
  {
    id: "jit-33",
    letter: "C",
    title: "JIT · kapasitas 3–3",
    blurb:
      "JIT dengan kapasitas lebih cepat (3 hari/zona). Bandingkan durasi & margin dengan skenario B.",
    compare: false,
    build: () =>
      makeConfig(
        3,
        3,
        allStarts(START_JIT),
        "JIT · 3–3",
        DEFAULT_DAILY_COST,
        DEFAULT_OWNER_DURATION,
        DEFAULT_CONTRACT_VALUE,
      ),
  },
  {
    id: "compare-push-jit",
    letter: "D",
    title: "Bandingkan Push vs JIT",
    blurb:
      "Kapasitas sama (1–6). Hanya beda: push minggu 1 vs JIT. Fokus pembelajaran utama.",
    compare: true,
    build: () =>
      makeConfig(
        1,
        6,
        allStarts(0),
        "Push vs JIT",
        DEFAULT_DAILY_COST,
        DEFAULT_OWNER_DURATION,
        DEFAULT_CONTRACT_VALUE,
      ),
  },
];

export type GlossaryEntry = {
  term: string;
  meaning: string;
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Takt",
    meaning:
      "Irama kerja: berapa lama (hari) tiap wagon mengerjakan satu zona, agar aliran antar trade stabil.",
  },
  {
    term: "Wagon / parade of trades",
    meaning:
      "Barisan 7 tim yang masuk berurutan (Struktur → … → Cat). Seperti kereta: wagon depan harus lepas dulu.",
  },
  {
    term: "Push",
    meaning:
      "Tim dikirim ke site sejak minggu yang ditetapkan, meski zona belum siap — tetap dibayar saat menunggu.",
  },
  {
    term: "JIT (Just-in-Time)",
    meaning:
      "Tim baru mulai (dan dibayar) saat zona pertama kali boleh dimasuki — mengurangi idle bayar di depan.",
  },
  {
    term: "Waste (menunggu)",
    meaning:
      "Hari di site tanpa kerja produktif karena menunggu wagon depan / curing. Tetap masuk biaya tenaga.",
  },
  {
    term: "Curing",
    meaning:
      "7 hari setelah pelat dicor sebelum dinding (dan seterusnya) boleh masuk zona itu.",
  },
  {
    term: "Kapasitas (hari/zona)",
    meaning:
      "Berapa hari satu tim butuh untuk menyelesaikan satu zona. Rentang bawah–atas = variasi (acak).",
  },
  {
    term: "Margin",
    meaning:
      "Kontrak tenaga − biaya tenaga − penalti keterlambatan. Bukan laba total proyek bangunan.",
  },
];

export type DebriefKind = "push-jit" | "capacity" | "single";

export function buildDebriefCopy(
  results: RunResult[],
  kind: DebriefKind,
): { findings: string[]; questions: string[] } {
  if (results.length === 0) {
    return { findings: [], questions: [] };
  }

  const byMargin = [...results].sort((a, b) => b.margin - a.margin);
  const byWaste = [...results].sort((a, b) => a.wasteCost - b.wasteCost);
  const bySpeed = [...results].sort((a, b) => a.finishDay - b.finishDay);
  const best = byMargin[0]!;
  const leanest = byWaste[0]!;
  const fastest = bySpeed[0]!;

  const findings =
    kind === "push-jit"
      ? [
          `Margin terbaik: ${best.name} (${formatRp(best.margin)}, ${best.marginPct.toFixed(1)}%).`,
          `Waste terendah: ${leanest.name} (${formatRp(leanest.wasteCost)}). Push sering membesarkan idle bayar.`,
          `Durasi tercepat: ${fastest.name} (${formatDuration(fastest.finishDay)}). Cepat belum tentu margin tertinggi jika waste/penalti besar.`,
        ]
      : kind === "capacity"
        ? [
            `Dengan start yang sama, variasi kapasitas mengubah durasi & biaya. Terbaik margin: ${best.name}.`,
            `Waste terendah: ${leanest.name}. Kapasitas konstan sering lebih mudah direncanakan.`,
            `Tercepat: ${fastest.name} (${formatDuration(fastest.finishDay)}).`,
          ]
        : [
            `Selesai dalam ${formatDuration(results[0]!.finishDay)}; margin ${formatRp(results[0]!.margin)}.`,
            `Waste ${formatRp(results[0]!.wasteCost)} — bagian biaya yang “dibayar menunggu”.`,
            results[0]!.lateDays > 0
              ? `Terlambat ${results[0]!.lateDays} hari → penalti ${formatRp(results[0]!.penalty)}.`
              : "Selesai dalam target owner (tanpa penalti keterlambatan).",
          ];

  const questions =
    kind === "push-jit"
      ? [
          "Di mana waste paling terlihat pada skenario Push?",
          "Mengapa JIT bisa mengurangi biaya menunggu tanpa mengubah urutan wagon?",
          "Kalau owner mempersingkat target hari, skenario mana yang lebih rentan penalti?",
        ]
      : kind === "capacity"
        ? [
            "Apa risiko kapasitas sangat bervariasi (mis. 1–6) bagi perencanaan takt?",
            "Kapan kapasitas konstan (2–2 / 3–3) lebih mudah diajarkan ke lapangan?",
            "Apakah mempercepat semua trade selalu memperbaiki margin?",
          ]
        : [
            "Tim mana yang paling lama menunggu, dan kenapa?",
            "Apakah Anda akan memilih Push atau JIT untuk proyek serupa?",
            "Satu perubahan setup apa yang akan Anda coba di run berikutnya?",
          ];

  return { findings, questions };
}

export function snapshotToRunResult(
  name: string,
  state: SimSnapshot,
  finance: ProjectFinance,
): RunResult {
  const finishDay = state.metrics.finishDay ?? state.day;
  return {
    name,
    finishDay,
    totalCost: state.metrics.totalCost,
    wasteCost: state.metrics.wasteCost,
    waitDays: state.metrics.waitDays,
    totalLaborDays: state.metrics.totalLaborDays,
    diceLabel: name,
    lateDays: finance.lateDays,
    penalty: finance.penalty,
    margin: finance.margin,
    marginPct: finance.marginPct,
  };
}

export function buildExportText(opts: {
  title: string;
  seed: number;
  configName?: string;
  results: RunResult[];
  notes?: string[];
}): string {
  const lines: string[] = [
    "Rusun Takt — ringkasan hasil",
    `Judul: ${opts.title}`,
    `Seed: ${opts.seed}`,
    opts.configName ? `Setup: ${opts.configName}` : "",
    `Diekspor: ${new Date().toISOString()}`,
    "",
    "Hasil:",
  ].filter(Boolean) as string[];

  for (const r of opts.results) {
    lines.push(
      `- ${r.name}: selesai H${r.finishDay} (${formatDuration(r.finishDay)}); biaya ${formatRp(r.totalCost)}; waste ${formatRp(r.wasteCost)}; penalti ${formatRp(r.penalty)}; margin ${formatRp(r.margin)} (${r.marginPct.toFixed(1)}%)`,
    );
  }

  if (opts.notes && opts.notes.length > 0) {
    lines.push("", "Catatan pembelajaran:");
    for (const n of opts.notes) lines.push(`- ${n}`);
  }

  lines.push(
    "",
    "Catatan: angka = model pendidikan (tenaga di site). Material/alat/headcount tidak dimodelkan.",
  );
  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
