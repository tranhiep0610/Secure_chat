// js/realtime-client.js - phía trình duyệt, nhận tin tức thì từ /api/events.
//
// Cách dùng trong app.js:
//   import { connectRealtime } from "./realtime-client.js";
//   const rt = connectRealtime(API_BASE, {
//       onMessage: ({ conversationId, message }) => { ... },
//       onRead:    ({ conversationId }) => { ... },
//       onOpen:    () => stopPolling(),
//       onFallback: () => startPolling()
//   });

export function connectRealtime(apiBase, handlers = {}) {
    if (typeof EventSource === "undefined") {
        handlers.onFallback?.();
        return { close() {} };
    }

    const source = new EventSource(`${apiBase}/api/events`, { withCredentials: true });

    const parse = fn => event => {
        try {
            fn?.(JSON.parse(event.data));
        } catch (err) {
            console.warn("Sự kiện realtime lỗi:", err);
        }
    };

    source.addEventListener("ready", () => handlers.onOpen?.());
    source.addEventListener("message", parse(handlers.onMessage));
    source.addEventListener("read", parse(handlers.onRead));

    // Đứt kết nối: bật polling dự phòng, trình duyệt sẽ tự nối lại
    source.onerror = () => handlers.onFallback?.();

    return { close: () => source.close() };
}
