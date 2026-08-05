import { cn } from "@/lib/utils";

/** Construction hard-hat marker, tinted per trade */
export function Helmet({
  color,
  className,
  size = 32,
  title,
}: {
  color: string;
  className?: string;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 drop-shadow-md", className)}
      role="img"
      aria-label={title ?? "Helm konstruksi"}
    >
      {title ? <title>{title}</title> : null}
      <ellipse cx="16" cy="22.5" rx="13" ry="3.2" fill={color} opacity="0.95" />
      <path d="M4 22c0-7.2 5.4-13 12-13s12 5.8 12 13" fill={color} />
      <path
        d="M10 14c1.5-3.5 4-5.5 6-5.5 1.2 0 2.4.5 3.5 1.4"
        stroke="white"
        strokeOpacity="0.3"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <rect
        x="14.2"
        y="9"
        width="3.6"
        height="10"
        rx="1.2"
        fill="white"
        fillOpacity="0.2"
      />
      <rect
        x="13.5"
        y="8"
        width="5"
        height="3.2"
        rx="1"
        fill="white"
        fillOpacity="0.35"
      />
      <path
        d="M4 22c0-7.2 5.4-13 12-13s12 5.8 12 13"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1"
        fill="none"
      />
      <ellipse
        cx="16"
        cy="22.5"
        rx="13"
        ry="3.2"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

/**
 * Always-readable label: dark disc + white stroke so numbers stay clear
 * on light helmets (pelat kuning, cat putih) and dark ones alike.
 */
export function HelmetBadge({
  color,
  label,
  size = 36,
  ring,
}: {
  color: string;
  /** unused — label is always white on dark for contrast */
  fg?: string;
  label?: string | number;
  size?: number;
  ring?: string;
}) {
  const fontSize = Math.max(9, Math.round(size * 0.32));
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Helmet color={color} size={size} />
      {label !== undefined && label !== "" ? (
        <span
          className="absolute flex items-center justify-center rounded-full font-bold leading-none"
          style={{
            bottom: size * 0.06,
            minWidth: size * 0.42,
            height: size * 0.42,
            padding: "0 2px",
            fontSize,
            color: "#ffffff",
            backgroundColor: "rgba(0,0,0,0.72)",
            border: "1.5px solid rgba(255,255,255,0.9)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.55)",
          }}
        >
          {label}
        </span>
      ) : null}
      {ring ? (
        <span
          className="pointer-events-none absolute inset-[-3px] rounded-full"
          style={{ boxShadow: `0 0 0 2px ${ring}` }}
        />
      ) : null}
    </div>
  );
}
