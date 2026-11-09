const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asString(value: unknown, max = 240): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

export function asDate(value: unknown): string | null {
  const text = asString(value, 10);
  return text && DATE.test(text) ? text : null;
}

export function asTime(value: unknown): string | null {
  const text = asString(value, 8);
  if (!text) return null;
  const hm = text.slice(0, 5);
  return TIME.test(hm) ? hm : null;
}

export function asId(value: unknown): string | null {
  const text = asString(value, 80);
  return text && /^[a-zA-Z0-9._-]+$/.test(text) ? text : null;
}

export function asArray(value: unknown, max = 40): unknown[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > max) return null;
  return value;
}

export function parseIdList(value: unknown, max = 40): string[] | null {
  if (value == null) return [];
  const items = asArray(value, max);
  if (!items) return null;
  const ids: string[] = [];
  for (const item of items) {
    const id = asId(item);
    if (!id) return null;
    ids.push(id);
  }
  return ids;
}
