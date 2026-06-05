export function projectApiPath(key: string) {
  return `/api/projects/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const headers =
    init?.body instanceof FormData
      ? init?.headers
      : {
          "Content-Type": "application/json",
          ...init?.headers,
        };
  const response = await fetch(url, {
    ...init,
    headers,
  });
  const raw = await response.text();
  const data = parseApiResponseBody(raw, response.ok, response.status);
  if (!response.ok) {
    const errorData = isRecord(data) ? data : { error: data || raw };
    throw new ApiError(
      cleanErrorMessage(errorData.error) || "Request failed.",
      response.status,
      errorData,
    );
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function parseApiResponseBody(raw: string, ok: boolean, status: number) {
  if (!raw.trim()) {
    if (ok) {
      return null;
    }
    return { error: `Request failed with status ${status} and an empty response.` };
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const message = ok ? "Request returned invalid JSON." : raw;
    throw new ApiError(message, status, { error: message });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanErrorMessage(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
