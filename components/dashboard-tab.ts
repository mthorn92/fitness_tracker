export const DASHBOARD_TAB_EVENT = "dashboard-tab";

export const DASHBOARD_TABS = ["diet", "exercise", "investing"] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export function isDashboardTab(value: string | null | undefined): value is DashboardTab {
  return value === "diet" || value === "exercise" || value === "investing";
}

/** `?tab=exercise` or `?tab=investing`. Anything else, including a missing param, is Diet. */
export function parseDashboardTab(value: string | string[] | undefined): DashboardTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return isDashboardTab(raw) ? raw : "diet";
}
