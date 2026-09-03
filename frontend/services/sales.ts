import { apiRequest } from "@/lib/api";
import type {
  Sale,
  SaleFilterSeller,
  SaleFilterSellerListResponse,
  SaleFilters,
  SaleInput,
  SaleListResponse,
} from "@/types";

const SALES_ENDPOINT = "/api/sales/";
const SALE_FILTER_SELLERS_ENDPOINT = "/api/sales/filter-sellers";

export function getSales(
  filters: SaleFilters = {},
  signal?: AbortSignal,
): Promise<SaleListResponse> {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.perPage) params.set("per_page", String(filters.perPage));
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.seller?.trim()) params.set("seller", filters.seller.trim());
  if (filters.sellerId) params.set("seller_id", String(filters.sellerId));
  if (filters.paymentMethod) {
    params.set("payment_method", filters.paymentMethod);
  }

  const query = params.toString();
  const path = query ? `${SALES_ENDPOINT}?${query}` : SALES_ENDPOINT;

  return apiRequest<SaleListResponse>(path, { signal });
}

export async function getSaleFilterSellers(
  signal?: AbortSignal,
): Promise<SaleFilterSeller[]> {
  const response = await apiRequest<SaleFilterSellerListResponse>(
    SALE_FILTER_SELLERS_ENDPOINT,
    { signal },
  );

  return response.sellers;
}

export function createSale(sale: SaleInput): Promise<Sale> {
  return apiRequest<Sale>(SALES_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(sale),
  });
}
