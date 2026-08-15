export type UsageStats = {
  visitors: number;
  simulations: number;
};

const NS = "rusun-takt";
const KEYS = { visit: "users", sim: "sims" } as const;
const BASE = "https://abacus.jasoncameron.dev";
const VISITOR_FLAG = "rusun-takt.visitor";
const CACHE_KEY = "rusun-takt.stats-cache";
const EVT = "rusun-takt-stats";

function emptyStats(): UsageStats {
  return { visitors: 0, simulations: 0 };
}

async function abacusGet(key: string): Promise<number> {
  const res = await fetch(`${BASE}/get/${NS}/${key}`, { cache: "no-store" });
  const json = (await res.json()) as { value?: number; error?: string };
  if (json.error || typeof json.value !== "number") return 0;
  return Math.max(0, json.value);
}

async function abacusHit(key: string): Promise<number> {
  const res = await fetch(`${BASE}/hit/${NS}/${key}`, { cache: "no-store" });
  const json = (await res.json()) as { value?: number };
  if (typeof json.value !== "number") throw new Error("stats hit gagal");
  return Math.max(0, json.value);
}

async function readRemote(): Promise<UsageStats> {
  const [visitors, simulations] = await Promise.all([
    abacusGet(KEYS.visit),
    abacusGet(KEYS.sim),
  ]);
  return { visitors, simulations };
}

function readCache(): UsageStats | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UsageStats;
    if (
      typeof parsed.visitors === "number" &&
      typeof parsed.simulations === "number"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(stats: UsageStats): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

export function subscribeUsageStats(fn: (s: UsageStats) => void): () => void {
  const onEvt = (e: Event) => {
    const detail = (e as CustomEvent<UsageStats>).detail;
    if (detail) fn(detail);
  };
  window.addEventListener(EVT, onEvt);
  return () => window.removeEventListener(EVT, onEvt);
}

function publish(stats: UsageStats): void {
  writeCache(stats);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT, { detail: stats }));
  }
}

export async function loadUsageStats(): Promise<UsageStats> {
  try {
    const stats = await readRemote();
    publish(stats);
    return stats;
  } catch {
    return readCache() ?? emptyStats();
  }
}

/** Satu kali per browser: pengunjung unik. */
export async function recordUniqueVisit(): Promise<UsageStats> {
  if (typeof window === "undefined") return emptyStats();
  try {
    if (!localStorage.getItem(VISITOR_FLAG)) {
      const visitors = await abacusHit(KEYS.visit);
      localStorage.setItem(VISITOR_FLAG, "1");
      const simulations = await abacusGet(KEYS.sim);
      const stats = { visitors, simulations };
      publish(stats);
      return stats;
    }
    return loadUsageStats();
  } catch {
    return readCache() ?? emptyStats();
  }
}

/** Setiap kali Start / bandingkan skenario dijalankan. */
export async function recordSimulationRun(): Promise<UsageStats> {
  try {
    const simulations = await abacusHit(KEYS.sim);
    const visitors = await abacusGet(KEYS.visit);
    const stats = { visitors, simulations };
    publish(stats);
    return stats;
  } catch {
    return readCache() ?? emptyStats();
  }
}

export function formatStat(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}
