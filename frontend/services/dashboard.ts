import { apiRequest } from "@/lib/api";
import type { DashboardFilters, DashboardResponse } from "@/types";

const DASHBOARD_ENDPOINT = "/api/dashboard/";

export function getDashboard(
  filters: DashboardFilters,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  const params = new URLSearchParams({
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
  });

  if (filters.seller?.trim()) params.set("seller", filters.seller.trim());
  if (filters.sellerId) params.set("seller_id", String(filters.sellerId));

  return apiRequest<DashboardResponse>(
    `${DASHBOARD_ENDPOINT}?${params.toString()}`,
    { signal },
  );
}
