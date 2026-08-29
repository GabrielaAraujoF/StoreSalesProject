type ApiErrorBody = {
  error?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!path.startsWith("/api/")) {
    throw new Error("O caminho da API deve começar com /api/.");
  }

  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const method = (options.method ?? "GET").toUpperCase();
  const csrfToken = getCookie("csrf_access_token");

  if (
    !SAFE_METHODS.has(method) &&
    csrfToken &&
    !headers.has("X-CSRF-TOKEN")
  ) {
    headers.set("X-CSRF-TOKEN", csrfToken);
  }

  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;

    if (
      response.status === 401 &&
      path !== "/api/auth/login" &&
      typeof window !== "undefined"
    ) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      window.location.assign(
        `/login?next=${encodeURIComponent(nextPath)}&reason=session`,
      );
    }

    throw new ApiError(
      body?.error ?? "Não foi possível concluir a solicitação.",
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
