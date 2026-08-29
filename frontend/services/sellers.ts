import { apiRequest } from "@/lib/api";
import type {
  ActiveSellerListResponse,
  Seller,
  SellerInput,
  SellerListResponse,
  SellerSummary,
  SellerUpdateInput,
} from "@/types";

const SELLERS_ENDPOINT = "/api/sellers/";
const ACTIVE_SELLERS_ENDPOINT = "/api/sellers/active";

export async function getActiveSellers(
  signal?: AbortSignal,
): Promise<SellerSummary[]> {
  const response = await apiRequest<ActiveSellerListResponse>(
    ACTIVE_SELLERS_ENDPOINT,
    { signal },
  );

  return response.sellers;
}

export async function getSellers(signal?: AbortSignal): Promise<Seller[]> {
  const response = await apiRequest<SellerListResponse>(SELLERS_ENDPOINT, {
    signal,
  });

  return response.sellers;
}

export function createSeller(seller: SellerInput): Promise<Seller> {
  return apiRequest<Seller>(SELLERS_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(seller),
  });
}

export function updateSeller(
  sellerId: number,
  changes: SellerUpdateInput,
): Promise<Seller> {
  return apiRequest<Seller>(`${SELLERS_ENDPOINT}${sellerId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}
