import { apiRequest } from "@/lib/api";
import type { Sale, SaleInput, SaleListResponse } from "@/types";

const SALES_ENDPOINT = "/api/sales/";

export async function getSales(signal?: AbortSignal): Promise<Sale[]> {
  const response = await apiRequest<SaleListResponse>(SALES_ENDPOINT, {
    signal,
  });

  return response.sales;
}

export function createSale(sale: SaleInput): Promise<Sale> {
  return apiRequest<Sale>(SALES_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(sale),
  });
}
