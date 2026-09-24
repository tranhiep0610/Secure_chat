# API tài khoản - phần Công

## Quy ước chung

- Base URL: `/api`
- Session dùng cookie HttpOnly.
- Mã lỗi dùng chung: `400` dữ liệu sai, `401` chưa đăng nhập/sai thông tin đăng nhập, `409` trùng username, `429` thử đăng nhập quá nhiều, `500` lỗi server.
- Không response nào được chứa `passwordHash`.
- `senderId` trong chat phải lấy từ session phía server, không lấy từ body/socket payload do client tự khai.

## POST /api/auth/register

Request:

```json
{
  "username": "hiep",
  "displayName": "Hiệp",
  "password": "12345678"
}
```

Success `201`:

```json
{
  "message": "Đăng ký thành công",
  "user": {
    "id": "...",
    "username": "hiep",
    "displayName": "Hiệp",
    "createdAt": "..."
  }
}
```

## POST /api/auth/login

Request:

```json
{
  "username": "hiep",
  "password": "12345678"
}
```

Success `200`: tạo session cookie và trả user công khai.

## POST /api/auth/logout

Yêu cầu đã đăng nhập. Hủy session. Khi Socket.IO đã tích hợp, server phải ngắt socket cũ của user.

## GET /api/auth/me

- `200`: trả user hiện tại.
- `401`: chưa đăng nhập hoặc session không còn hợp lệ.

## GET /api/users?q=hai

Yêu cầu đăng nhập. Trả tối đa 50 user, bỏ chính tài khoản hiện tại, cho phép tìm theo `username`/`displayName`, không trả `passwordHash`.
