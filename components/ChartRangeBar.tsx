import { CHART_RANGES, type ChartRangeId } from "@/lib/chart-range";

export function ChartRangeBar({
  range,
  onChange,
}: {
  range: ChartRangeId;
  onChange: (range: ChartRangeId) => void;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    const index = CHART_RANGES.findIndex((item) => item.id === range);
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % CHART_RANGES.length
        : event.key === "ArrowLeft"
          ? (index - 1 + CHART_RANGES.length) % CHART_RANGES.length
          : event.key === "Home"
            ? 0
            : CHART_RANGES.length - 1;
    const next = CHART_RANGES[nextIndex]?.id;
    if (!next) return;
    onChange(next);
    document.getElementById(`range-${next}`)?.focus();
  }

  return (
    <div className="range-bar" role="radiogroup" aria-label="Chart range" data-range={range} onKeyDown={onKeyDown}>
      {CHART_RANGES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          id={`range-${item.id}`}
          aria-checked={range === item.id}
          aria-label={item.name}
          tabIndex={range === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
