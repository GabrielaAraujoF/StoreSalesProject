import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getBackendUrl } from "@/lib/backend-url";
import type { AccountResponse } from "@/types";

const backendUrl = getBackendUrl();

function loginUrl(nextPath: string, reason: string) {
  const params = new URLSearchParams({
    next: nextPath,
    reason,
  });

  return `/login?${params.toString()}`;
}

export async function requireAdmin(nextPath = "/admin") {
  const cookieHeader = (await cookies()).toString();

  if (!cookieHeader.includes("access_token_cookie=")) {
    redirect(loginUrl(nextPath, "session"));
  }

  let response: Response;

  try {
    response = await fetch(`${backendUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error(
      "Não foi possível validar a sessão. Confirme se o backend está em execução.",
    );
  }

  if (response.status === 401) {
    redirect(loginUrl(nextPath, "session"));
  }

  if (response.status === 403) {
    redirect(loginUrl(nextPath, "inactive"));
  }

  if (!response.ok) {
    throw new Error("Não foi possível validar a sessão administrativa.");
  }

  const { account } = (await response.json()) as AccountResponse;

  if (account.role !== "admin") {
    redirect(loginUrl(nextPath, "forbidden"));
  }

  return account;
}
