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
  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(data.error || "Request failed.", response.status, data);
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
