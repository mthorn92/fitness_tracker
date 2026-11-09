import { formatNumber } from "@/lib/format";
import type { WeightPoint } from "@/lib/types";

export function WeightChart({
  points,
  goalKg,
}: {
  points: WeightPoint[];
  goalKg: number;
}) {
  const width = 320;
  const height = 180;
  const pad = { top: 28, right: 36, bottom: 28, left: 8 };
  const values = [...points.map((point) => point.kg), goalKg];
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const yFor = (kg: number) => pad.top + ((max - kg) / (max - min)) * innerHeight;
  const xFor = (index: number, total: number) =>
    pad.left + (total <= 1 ? innerWidth * 0.72 : (index / (total - 1)) * innerWidth);

  const goalY = yFor(goalKg);
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index, points.length)} ${yFor(point.kg)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Weight over time">
      <line
        x1={pad.left}
        x2={width - pad.right}
        y1={goalY}
        y2={goalY}
        stroke="#cfcfd4"
        strokeDasharray="4 5"
      />
      <text x={width - pad.right + 4} y={goalY + 4} fontSize="11" fill="#8e8e93">
        {formatNumber(goalKg, 1)}
      </text>
      {line ? (
        <path d={line} fill="none" stroke="#6d6d72" strokeWidth="3" strokeLinecap="round" />
      ) : null}
      {points.map((point, index) => {
        const x = xFor(index, points.length);
        const y = yFor(point.kg);
        const isLast = index === points.length - 1;
        return (
          <g key={point.date}>
            <circle cx={x} cy={y} r={isLast ? 6 : 4} fill={isLast ? "#f0983a" : "#6d6d72"} />
            {isLast ? (
              <g>
                <rect x={x - 22} y={y - 28} width="44" height="18" rx="9" fill="#f0983a" />
                <text x={x} y={y - 15} textAnchor="middle" fontSize="11" fontWeight="800" fill="white">
                  {formatNumber(point.kg, 1)}
                </text>
              </g>
            ) : (
              <text x={x} y={y - 10} textAnchor="middle" fontSize="11" fontWeight="800" fill="#f0983a">
                {formatNumber(point.kg, 1)}
              </text>
            )}
          </g>
        );
      })}
      {points.map((point, index) => (
        <text
          key={`${point.date}-label`}
          x={xFor(index, points.length)}
          y={height - 6}
          textAnchor="middle"
          fontSize="11"
          fill="#8e8e93"
        >
          {point.label}
        </text>
      ))}
    </svg>
  );
}
