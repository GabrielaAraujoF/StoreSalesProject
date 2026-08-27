import { apiRequest } from "@/lib/api";
import type { Seller, SellerListResponse } from "@/types";

const SELLERS_ENDPOINT = "/api/sellers/";

export async function getSellers(signal?: AbortSignal): Promise<Seller[]> {
  const response = await apiRequest<SellerListResponse>(SELLERS_ENDPOINT, {
    signal,
  });

  return response.sellers;
}

export async function getSellerByNumber(
  sellerNumber: number,
  signal?: AbortSignal,
): Promise<Seller | null> {
  const sellers = await getSellers(signal);
  return (
    sellers.find((seller) => seller.seller_number === sellerNumber) ?? null
  );
}
