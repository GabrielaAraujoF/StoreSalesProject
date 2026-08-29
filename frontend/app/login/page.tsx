import type { Metadata } from "next";

import { LoginPage } from "@/components/auth/login-page";

export const metadata: Metadata = {
  title: "Login administrativo | StoreSales",
  description: "Entre na área administrativa da StoreSales.",
};

type LoginRouteProps = {
  searchParams: Promise<{
    next?: string | string[];
    reason?: string | string[];
  }>;
};

const REASON_MESSAGES: Record<string, string> = {
  session: "Sua sessão não existe ou expirou. Entre novamente.",
  inactive: "Esta conta está inativa.",
  forbidden: "Esta conta não possui permissão administrativa.",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeNextPath(value: string | undefined) {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/admin";
}

export default async function LoginRoute({ searchParams }: LoginRouteProps) {
  const params = await searchParams;
  const reason = firstValue(params.reason);

  return (
    <LoginPage
      nextPath={safeNextPath(firstValue(params.next))}
      initialMessage={reason ? REASON_MESSAGES[reason] : undefined}
    />
  );
}
