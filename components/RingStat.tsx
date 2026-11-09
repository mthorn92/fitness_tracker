type RingStatProps = {
  value: number;
  max: number;
  label: string;
  display: string;
  tone?: "accent" | "warn" | "low" | "go";
};

const STROKE = {
  accent: "stroke-accent",
  warn: "stroke-warn",
  low: "stroke-low",
  go: "stroke-go",
};

export function RingStat({
  value,
  max,
  label,
  display,
  tone = "accent",
}: RingStatProps) {
  const size = 118;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const offset = circumference * (1 - percent);

  return (
    <div className="relative grid place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-foreground/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={STROKE[tone]}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-black leading-none tracking-tight">{display}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
