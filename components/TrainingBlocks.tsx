import type { TrainingGroup } from "@/lib/training-view";

export function TrainingBlocks({
  groups,
  completed,
}: {
  groups: TrainingGroup[];
  completed: boolean;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="train-groups">
      {groups.map((group, index) => (
        <div key={`${group.letter ?? "set"}-${index}`} className="train-block">
          {group.letter ? <p className="train-kicker">Superset {group.letter}</p> : null}
          <ul className="train-list">
            {group.rows.map((row) => (
              <li key={row.key}>
                <div className="train-name">{row.name}</div>
                <div className="train-dose">{completed ? `Plan ${row.prescription}` : row.prescription}</div>
                {row.logged ? <div className="train-log">{row.logged}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function formatRpe(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
