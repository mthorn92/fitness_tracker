export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function slugId(prefix: string, value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${prefix}_${slug || "item"}`;
}
