import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic IDR format (no Intl / locale hydration quirks) */
export function formatRp(n: number): string {
  const abs = Math.abs(Math.round(n));
  const withDots = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}Rp ${withDots}`;
}

export function formatNumber(n: number): string {
  const abs = Math.abs(Math.round(n));
  const withDots = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? `-${withDots}` : withDots;
}
