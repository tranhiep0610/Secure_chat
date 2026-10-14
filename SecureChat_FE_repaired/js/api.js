// SecureChat API client.
// Khi mở từ Live Server (5500/5501) thì gọi backend ở cổng 3000, cùng hostname
// với trang hiện tại (127.0.0.1 hoặc localhost) để cookie session luôn được gửi.
const API_BASE = (location.port === "3000" || location.port === "")
  ? ""
  : `http://${location.hostname}:3000`;

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  let body = options.body;

  if (body !== undefined && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      body,
      headers,
      credentials: "include",
      cache: "no-store"
    });
  } catch {
    const error = new Error("Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy ở cổng 3000 chưa.");
    error.status = 0;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (response.status !== 204) {
    try {
      data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      (typeof data === "object" && (data?.error || data?.message)) ||
      `Yêu cầu thất bại (${response.status}).`;

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data ?? {};
}

export const apiGet = path => api(path);
export const apiPost = (path, body = {}) => api(path, { method: "POST", body });
export const apiPatch = (path, body = {}) => api(path, { method: "PATCH", body });
export const apiDelete = path => api(path, { method: "DELETE" });