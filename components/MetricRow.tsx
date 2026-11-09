import { ProgressBar } from "@/components/ProgressBar";
import { formatNumber } from "@/lib/format";
import type { ProgressMetric } from "@/lib/types";

type MetricRowProps = {
  label: string;
  metric: ProgressMetric;
  unit: string;
  digits?: number;
};

export function MetricRow({ label, metric, unit, digits = 0 }: MetricRowProps) {
  const over = metric.current > metric.target;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-sm text-muted">
          <span className={over ? "text-warn" : "text-foreground"}>
            {formatNumber(metric.current, digits)}
          </span>
          <span> / {formatNumber(metric.target, digits)} {unit}</span>
        </p>
      </div>
      <ProgressBar percent={metric.percent} tone={over ? "warn" : "accent"} />
    </div>
  );
}
