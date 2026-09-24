// Khởi tạo kết nối Socket.IO tới máy chủ
const socket = io();

// Xử lý khi kết nối thành công
socket.on('connect', () => {
  console.log('Đã kết nối Socket.IO thành công! Socket ID:', socket.id);
});

// Lắng nghe sự kiện nhận tin nhắn mới từ phía máy chủ
socket.on('message:new', (data) => {
  console.log('Nhận tin nhắn mới từ Socket:', data);
  
  // Nếu đang mở đúng cuộc trò chuyện thì hiển thị tin nhắn lên giao diện
  if (data.conversationId === currentConversationId) {
    // Tạm thời hiển thị nội dung (sau này sẽ giải mã trước khi render)
    if (typeof renderMessage === 'function') {
      renderMessage('received', data.ciphertext || data.plaintextTemp);
    }
  }
});

// Hàm gửi tin nhắn qua Socket.IO (được gọi từ chat.js)
function sendSocketMessage(payload) {
  socket.emit('message:send', payload, (ack) => {
    if (ack && ack.status === 'ok') {
      console.log('Xác nhận từ Server: Tin nhắn đã được lưu, ID:', ack.messageId);
    } else {
      alert('Gửi tin nhắn thất bại hoặc không nhận được phản hồi từ server!');
    }
  });
}