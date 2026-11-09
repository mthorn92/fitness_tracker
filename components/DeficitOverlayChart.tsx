import { formatNumber } from "@/lib/format";
import type { DeficitOverlayPoint } from "@/lib/types";

type DeficitOverlayChartProps = {
  points: DeficitOverlayPoint[];
};

export function DeficitOverlayChart({ points }: DeficitOverlayChartProps) {
  const width = 320;
  const height = 220;
  const pad = { top: 18, right: 44, bottom: 28, left: 36 };

  if (points.length === 0) {
    return (
      <div className="grid h-[220px] place-items-center text-sm font-semibold text-muted">
        Log Whoop burn and food to compare
      </div>
    );
  }

  const kgValues = points.flatMap((point) => {
    const values = [point.expectedKgLost];
    if (point.actualKgLost != null) values.push(point.actualKgLost);
    if (point.weighInKgLost != null) values.push(point.weighInKgLost);
    return values;
  });
  const deficitValues = points.map((point) => point.cumulativeDeficitKcal);

  const kgMinRaw = Math.min(0, ...kgValues);
  const kgMaxRaw = Math.max(0.1, ...kgValues);
  const kgPad = Math.max((kgMaxRaw - kgMinRaw) * 0.15, 0.15);
  const kgMin = kgMinRaw - kgPad;
  const kgMax = kgMaxRaw + kgPad;

  const defMinRaw = Math.min(0, ...deficitValues);
  const defMaxRaw = Math.max(100, ...deficitValues);
  const defPad = Math.max((defMaxRaw - defMinRaw) * 0.12, 80);
  const defMin = defMinRaw - defPad;
  const defMax = defMaxRaw + defPad;

  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const yKg = (value: number) => pad.top + ((kgMax - value) / (kgMax - kgMin || 1)) * innerHeight;
  const yDef = (value: number) => pad.top + ((defMax - value) / (defMax - defMin || 1)) * innerHeight;
  const xFor = (index: number) =>
    pad.left + (points.length <= 1 ? innerWidth * 0.5 : (index / (points.length - 1)) * innerWidth);

  const expectedPath = pathFor(points.map((point, index) => [xFor(index), yKg(point.expectedKgLost)]));
  const actualPath = pathFor(
    points
      .map((point, index) => (point.actualKgLost == null ? null : [xFor(index), yKg(point.actualKgLost)] as const))
      .filter((pair): pair is readonly [number, number] => pair != null),
  );
  const deficitPath = pathFor(points.map((point, index) => [xFor(index), yDef(point.cumulativeDeficitKcal)]));

  const zeroY = yKg(0);
  const labelIndexes = pickLabelIndexes(points.length);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Actual weight change versus expected kilograms from Whoop calorie deficit"
    >
      <line
        x1={pad.left}
        x2={width - pad.right}
        y1={zeroY}
        y2={zeroY}
        stroke="#e5e5ea"
        strokeWidth="1"
      />

      {/* Background: cumulative calorie deficit (secondary scale). */}
      {deficitPath ? (
        <path
          d={deficitPath}
          fill="none"
          stroke="#c7c7cc"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
        />
      ) : null}

      {/* Faint weigh-in markers on the kg scale. */}
      {points.map((point, index) =>
        point.weighInKgLost == null ? null : (
          <circle
            key={`${point.date}-weigh`}
            cx={xFor(index)}
            cy={yKg(point.weighInKgLost)}
            r={3}
            fill="#f0983a"
            opacity="0.28"
          />
        ),
      )}

      {expectedPath ? (
        <path
          d={expectedPath}
          fill="none"
          stroke="#6d6d72"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />
      ) : null}

      {actualPath ? (
        <path
          d={actualPath}
          fill="none"
          stroke="#f0983a"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {points.length === 1 ? (
        <>
          <circle cx={xFor(0)} cy={yKg(points[0].expectedKgLost)} r={4} fill="#6d6d72" />
          {points[0].actualKgLost != null ? (
            <circle cx={xFor(0)} cy={yKg(points[0].actualKgLost)} r={4.5} fill="#f0983a" />
          ) : null}
        </>
      ) : null}

      <text x={4} y={pad.top + 4} fontSize="10" fill="#8e8e93">
        kg
      </text>
      <text x={4} y={yKg(kgMaxRaw) + 3} fontSize="10" fill="#8e8e93">
        {formatNumber(kgMaxRaw, 1)}
      </text>
      <text x={4} y={zeroY + 3} fontSize="10" fill="#8e8e93">
        0
      </text>

      <text x={width - 2} y={pad.top + 4} fontSize="10" fill="#c7c7cc" textAnchor="end">
        kcal
      </text>
      <text x={width - 2} y={yDef(defMaxRaw) + 3} fontSize="10" fill="#c7c7cc" textAnchor="end">
        {formatNumber(Math.round(defMaxRaw))}
      </text>

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

function pathFor(pairs: Array<readonly [number, number] | [number, number]>): string {
  return pairs
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
}

function pickLabelIndexes(count: number): number[] {
  if (count <= 1) return [0];
  if (count === 2) return [0, 1];
  if (count <= 5) return Array.from({ length: count }, (_, index) => index);
  return [0, Math.floor((count - 1) / 2), count - 1];
}

function shortAxisLabel(label: string): string {
  const parts = label.replace(",", "").split(/\s+/);
  if (parts.length >= 3) return `${parts[1]} ${parts[2]}`;
  return label;
}
