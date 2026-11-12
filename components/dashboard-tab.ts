export const DASHBOARD_TAB_EVENT = "dashboard-tab";

export type DashboardTab = "diet" | "exercise";

/** `?tab=exercise` selects exercise. Anything else, including a missing param, is Diet. */
export function parseDashboardTab(value: string | string[] | undefined): DashboardTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "exercise" ? "exercise" : "diet";
}
