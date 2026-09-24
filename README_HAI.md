# Phần Hải — Secure Chat

Bộ file này bám theo mục 18 trong tài liệu kế hoạch:

- `Frontend/chat.html`
- `Frontend/css/chat.css`
- `Frontend/js/chat.js`
- `Frontend/js/socket.js`

## Chức năng đã làm

### HA01 — UI chat
- Danh sách người dùng
- Tìm kiếm người dùng
- Chọn hội thoại 1–1
- Vùng tin nhắn
- Ô nhập + gửi bằng Enter
- Bộ chọn AES-GCM / DES-CBC
- Trạng thái thiếu khóa
- Modal nhập / tạo khóa demo

### HA02 — API + Socket
Theo hợp đồng trong kế hoạch:
- `GET /api/auth/me`
- `GET /api/users`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id/messages`
- Socket `message:send`
- Socket `message:new`

`socket.js` là nơi duy nhất đăng ký listener Socket.IO.

### HA03 — Crypto integration
- Mã hóa trước khi `message:send`
- Giải mã sau khi nhận / tải lịch sử
- AES/DES được chọn theo `envelope.algorithm`
- Dùng `keyId` để tìm đúng khóa
- Không gửi nếu thiếu khóa
- Tin giải mã lỗi không được hiển thị thành plaintext hợp lệ
- Dữ liệu nhị phân được chuyển sang Base64 trước khi gửi server

Lưu ý: `chat.js` không tự viết lõi AES/DES. Nó chỉ gọi:
- `./crypto/aes.js`
- `./crypto/des.js`

### HA04 — trạng thái lỗi / retry
- `Đang gửi...`
- `Đã lưu`
- `Gửi lỗi`
- Nút `Thử gửi lại`
- Retry giữ nguyên `clientMessageId`
- Bản nháp chỉ bị xóa sau khi server ack thành công
- Khi socket reconnect, lịch sử được tải lại bằng HTTP
- Render nội dung bằng `textContent`

## Chế độ demo UI

Nếu Backend chưa xong, vẫn có thể xem giao diện bằng cách phục vụ `Frontend`
qua local server và mở:

```text
/chat.html?demo=1
```

Demo mode dùng dữ liệu người dùng giả để kiểm tra giao diện.

## Cách ghép vào repo

Chép đè:

```text
Frontend/chat.html
Frontend/css/chat.css
Frontend/js/chat.js
Frontend/js/socket.js
```

Sau đó chạy bằng Backend/Express cùng origin. Không mở `chat.html` trực tiếp bằng
`file://` cho bản tích hợp.

## API/Socket mà Backend cần trả đúng

### POST /api/conversations

Request:

```json
{
  "peerId": "USER_ID"
}
```

Response có thể là:

```json
{
  "conversation": {
    "_id": "CONVERSATION_ID",
    "members": []
  }
}
```

### GET /api/conversations/:id/messages

Khuyến nghị:

```json
{
  "messages": [],
  "nextCursor": null
}
```

### Socket message:send

Client gửi:

```json
{
  "conversationId": "CONVERSATION_ID",
  "clientMessageId": "msg_UUID",
  "envelope": {
    "protocolVersion": 1,
    "algorithm": "AES-GCM",
    "keyBits": 256,
    "keyId": "key_aes_...",
    "encoding": "base64",
    "iv": "...",
    "ciphertext": "...",
    "timestamp": 0
  }
}
```

DES thêm `mac`.

Server ack:

```json
{
  "ok": true,
  "messageId": "MESSAGE_ID",
  "createdAt": "2026-09-23T10:00:00.000Z"
}
```

Server chuyển `message:new` sau khi đã lưu DB.

## Test nhanh phần Hải

1. Đăng nhập A và B ở hai trình duyệt.
2. A chọn B.
3. Hai bên chọn cùng thuật toán.
4. Nhập cùng `keyId` và khóa.
5. A gửi tiếng Việt + emoji.
6. B nhận không reload.
7. Mở Network: payload chat không được có plaintext hoặc key.
8. Ngắt mạng A, thử gửi: giao diện báo lỗi và giữ bản nháp.
9. Kết nối lại và retry: dùng cùng `clientMessageId`.
10. Refresh: lịch sử bản mã vẫn tải được; cần nhập lại khóa để đọc.
11. Dùng khóa sai: giao diện phải hiện lỗi giải mã.
