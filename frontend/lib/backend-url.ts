const LOCAL_BACKEND_URL = "http://localhost:5000";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeBackendUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "BACKEND_URL deve ser uma URL absoluta, como https://app.up.railway.app.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BACKEND_URL deve usar o protocolo HTTP ou HTTPS.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "BACKEND_URL não deve conter credenciais, query string ou fragmento.",
    );
  }

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && url.protocol !== "https:") {
    throw new Error("BACKEND_URL deve usar HTTPS em produção.");
  }

  if (isProduction && LOCAL_HOSTNAMES.has(url.hostname)) {
    throw new Error("BACKEND_URL não pode apontar para localhost em produção.");
  }

  return url.toString().replace(/\/+$/, "");
}

export function getBackendUrl(): string {
  const configuredUrl = process.env.BACKEND_URL?.trim();

  if (configuredUrl) {
    return normalizeBackendUrl(configuredUrl);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BACKEND_URL é obrigatória em produção. Configure a URL pública HTTPS do backend Railway.",
    );
  }

  return LOCAL_BACKEND_URL;
}
