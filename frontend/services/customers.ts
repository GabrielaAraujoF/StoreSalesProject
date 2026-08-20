import { apiRequest } from "@/lib/api";
import type {
  Customer,
  CustomerInput,
  CustomerListResponse,
} from "@/types";

const CUSTOMERS_ENDPOINT = "/api/customers/";

export async function getCustomers(signal?: AbortSignal): Promise<Customer[]> {
  const response = await apiRequest<CustomerListResponse>(CUSTOMERS_ENDPOINT, {
    signal,
  });

  return response.customers;
}

export function createCustomer(customer: CustomerInput): Promise<Customer> {
  return apiRequest<Customer>(CUSTOMERS_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(customer),
  });
}

export function updateCustomer(
  customerId: number,
  customer: CustomerInput,
): Promise<Customer> {
  return apiRequest<Customer>(`${CUSTOMERS_ENDPOINT}${customerId}`, {
    method: "PUT",
    body: JSON.stringify(customer),
  });
}

export function deleteCustomer(customerId: number): Promise<void> {
  return apiRequest<void>(`${CUSTOMERS_ENDPOINT}${customerId}`, {
    method: "DELETE",
  });
}
