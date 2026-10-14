// realtime.js - đẩy sự kiện tới trình duyệt bằng Server-Sent Events (SSE).
// Đặt cạnh server.js (ngang hàng thư mục controllers/).

// userId -> tập các kết nối đang mở (một người có thể mở nhiều tab)
const clients = new Map();

function addClient(userId, res) {
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(res);
}

function removeClient(userId, res) {
    const set = clients.get(userId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) clients.delete(userId);
}

// Gửi một sự kiện tới mọi tab đang mở của userId
function publish(userId, event, data) {
    const set = clients.get(String(userId));
    if (!set) return;

    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) {
        try {
            res.write(chunk);
        } catch (err) {
            set.delete(res);
        }
    }
}

// Handler cho GET /api/events (đặt sau authMiddleware)
function sseHandler(getUserId) {
    return (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        }

        res.status(200).set({
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no" // tắt bộ đệm của Nginx
        });
        res.flushHeaders();

        // Trình duyệt tự nối lại sau 2 giây nếu đứt
        res.write("retry: 2000\n\n");
        res.write(`event: ready\ndata: {}\n\n`);

        addClient(userId, res);

        // Nhịp tim để proxy không cắt kết nối rảnh
        const heartbeat = setInterval(() => {
            try {
                res.write(": ping\n\n");
            } catch (err) {
                clearInterval(heartbeat);
            }
        }, 20000);

        req.on("close", () => {
            clearInterval(heartbeat);
            removeClient(userId, res);
        });
    };
}

module.exports = { publish, sseHandler };
