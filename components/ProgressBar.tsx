type ProgressBarProps = {
  percent: number;
  tone?: "accent" | "warn" | "low" | "muted" | "go";
};

const TONE_CLASS = {
  accent: "bg-accent",
  warn: "bg-warn",
  low: "bg-low",
  muted: "bg-foreground/30",
  go: "bg-go",
};

export function ProgressBar({ percent, tone = "accent" }: ProgressBarProps) {
  const width = Math.max(0, Math.min(100, percent));

  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line">
      <div
        className={`h-full rounded-full ${TONE_CLASS[tone]}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
