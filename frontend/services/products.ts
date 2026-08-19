import { apiRequest } from "@/lib/api";
import type {
  Product,
  ProductInput,
  ProductListResponse,
} from "@/types";

const PRODUCTS_ENDPOINT = "/api/products/";

export async function getProducts(signal?: AbortSignal): Promise<Product[]> {
  const response = await apiRequest<ProductListResponse>(PRODUCTS_ENDPOINT, {
    signal,
  });

  return response.products;
}

export function createProduct(product: ProductInput): Promise<Product> {
  return apiRequest<Product>(PRODUCTS_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(product),
  });
}

export function updateProduct(
  productId: number,
  changes: Partial<ProductInput>,
): Promise<Product> {
  return apiRequest<Product>(`${PRODUCTS_ENDPOINT}${productId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export function deleteProduct(productId: number): Promise<void> {
  return apiRequest<void>(`${PRODUCTS_ENDPOINT}${productId}`, {
    method: "DELETE",
  });
}
