export const DASHBOARD_TAB_EVENT = "dashboard-tab";

export const DASHBOARD_TABS = ["diet", "exercise"] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

/** Old Investing links (`?tab=investing`) and a saved Investing choice open Diet. */
export const RETIRED_DASHBOARD_TAB = "investing";

export function isDashboardTab(value: string | null | undefined): value is DashboardTab {
  return value === "diet" || value === "exercise";
}

/**
 * The URL wins. A retired Investing link is Diet, even when another tab was saved.
 * A missing or unknown param uses the saved tab, then the fallback.
 */
export function resolveDashboardTab(
  urlValue: string | null | undefined,
  stored: string | null | undefined,
  fallback: DashboardTab,
): DashboardTab {
  if (urlValue === RETIRED_DASHBOARD_TAB) return "diet";
  if (isDashboardTab(urlValue)) return urlValue;
  if (isDashboardTab(stored)) return stored;
  return fallback;
}

/** `?tab=exercise` selects Exercise. `?tab=investing` and anything else is Diet. */
export function parseDashboardTab(value: string | string[] | undefined): DashboardTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return resolveDashboardTab(raw, null, "diet");
}
