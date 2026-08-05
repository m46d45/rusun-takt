import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
  tone = "neutral",
}: {
  className?: string;
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "info";
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted border-border",
    ok: "bg-ok/15 text-ok border-ok/25",
    warn: "bg-warn/15 text-warn border-warn/25",
    danger: "bg-danger/15 text-danger border-danger/25",
    info: "bg-info/15 text-info border-info/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
