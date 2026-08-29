import { apiRequest } from "@/lib/api";
import type { Account, AccountResponse, AuthResponse } from "@/types";

const AUTH_ENDPOINT = "/api/auth";

export type LoginInput = {
  email: string;
  password: string;
};

export function login(credentials: LoginInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>(`${AUTH_ENDPOINT}/login`, {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function getCurrentAccount(
  signal?: AbortSignal,
): Promise<Account> {
  const response = await apiRequest<AccountResponse>(`${AUTH_ENDPOINT}/me`, {
    signal,
  });

  return response.account;
}

export function logout(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`${AUTH_ENDPOINT}/logout`, {
    method: "POST",
  });
}
