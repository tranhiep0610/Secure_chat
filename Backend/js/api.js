// SecureChat API client. When opened from Live Server (5500/5501), call the backend on port 3000.
const API_BASE = (location.port === "3000" || location.port === "")
  ? ""
  : "http://127.0.0.1:3000";

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  let body = options.body;
  if (body !== undefined && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options, body, headers, credentials: "include", cache: "no-store"
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Yêu cầu thất bại (${response.status}).`);
    error.status = response.status; error.data = data; throw error;
  }
  return data;
}
export const apiGet = path => api(path);
export const apiPost = (path, body = {}) => api(path, { method: "POST", body });
export const apiPatch = (path, body = {}) => api(path, { method: "PATCH", body });
export const apiDelete = path => api(path, { method: "DELETE" });
