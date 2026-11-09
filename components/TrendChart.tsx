import { formatNumber } from "@/lib/format";
import type { TrendPoint } from "@/lib/types";

type TrendChartProps = {
  points: TrendPoint[];
  ariaLabel: string;
  valueDigits?: number;
  /** Optional dashed reference line (e.g. goal weight or calorie target). */
  reference?: number | null;
  accent?: string;
};

export function TrendChart({
  points,
  ariaLabel,
  valueDigits = 0,
  reference = null,
  accent = "#f0983a",
}: TrendChartProps) {
  const width = 320;
  const height = 200;
  const pad = { top: 20, right: 40, bottom: 28, left: 8 };

  if (points.length === 0) {
    return (
      <div className="grid h-[200px] place-items-center text-sm font-semibold text-muted">
        No data yet
      </div>
    );
  }

  // Scale to the series so a far-away target (e.g. 2000 kcal vs ~500 logged)
  // does not crush the daily dots. Only fold the reference into the scale when
  // it sits near the data.
  const seriesValues = [
    ...points.map((point) => point.value),
    ...points.map((point) => point.avg7d),
  ];
  const seriesMin = Math.min(...seriesValues);
  const seriesMax = Math.max(...seriesValues);
  const seriesSpan = Math.max(seriesMax - seriesMin, valueDigits > 0 ? 1 : 50);
  // Keep goal/target in-frame when it is close to the logged series (weight goal
  // ~10kg away still counts; a 2000 kcal target vs ~500 logged does not).
  const referenceSlack = Math.max(seriesSpan * 3, valueDigits > 0 ? 15 : 800);
  const nearReference =
    reference != null &&
    reference >= seriesMin - referenceSlack &&
    reference <= seriesMax + referenceSlack;
  const minRaw = nearReference ? Math.min(seriesMin, reference) : seriesMin;
  const maxRaw = nearReference ? Math.max(seriesMax, reference) : seriesMax;
  const padY = Math.max((maxRaw - minRaw) * 0.18, valueDigits > 0 ? 0.5 : 30);
  const min = minRaw - padY;
  const max = maxRaw + padY;
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const yFor = (value: number) => pad.top + ((max - value) / (max - min || 1)) * innerHeight;
  const xFor = (index: number) =>
    pad.left + (points.length <= 1 ? innerWidth * 0.5 : (index / (points.length - 1)) * innerWidth);

  const avgLine = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(point.avg7d)}`)
    .join(" ");

  const labelIndexes = pickLabelIndexes(points.length);
  const showReference = nearReference;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
      {showReference && reference != null ? (
        <>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={yFor(reference)}
            y2={yFor(reference)}
            stroke="#cfcfd4"
            strokeDasharray="4 5"
          />
          <text x={width - pad.right + 4} y={yFor(reference) + 4} fontSize="11" fill="#8e8e93">
            {formatNumber(reference, valueDigits)}
          </text>
        </>
      ) : null}

      {avgLine ? (
        <path d={avgLine} fill="none" stroke={accent} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}

      {points.map((point, index) => (
        <circle
          key={`${point.date}-dot`}
          cx={xFor(index)}
          cy={yFor(point.value)}
          r={points.length === 1 ? 4.5 : 3.25}
          fill={accent}
          opacity={0.28}
        />
      ))}

      {points.length === 1 ? (
        <circle cx={xFor(0)} cy={yFor(points[0].avg7d)} r={5} fill={accent} />
      ) : null}

      {labelIndexes.map((index) => (
        <text
          key={`${points[index].date}-label`}
          x={xFor(index)}
          y={height - 6}
          textAnchor="middle"
          fontSize="11"
          fill="#8e8e93"
        >
          {shortAxisLabel(points[index].label)}
        </text>
      ))}
    </svg>
  );
}

function pickLabelIndexes(count: number): number[] {
  if (count <= 1) return [0];
  if (count === 2) return [0, 1];
  if (count <= 5) return Array.from({ length: count }, (_, index) => index);
  return [0, Math.floor((count - 1) / 2), count - 1];
}

function shortAxisLabel(label: string): string {
  // "Mon, 9 Nov" / "Mon 9 Nov" → keep day + month fragment when crowded.
  const parts = label.replace(",", "").split(/\s+/);
  if (parts.length >= 3) return `${parts[1]} ${parts[2]}`;
  return label;
}
