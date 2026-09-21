let currentConversationId = null;

// Lấy các phần tử giao diện
const messagesContainer = document.getElementById('messages-container');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const algoSelect = document.getElementById('algo-select');
const secretKeyInput = document.getElementById('secret-key-input');
const keyIdInput = document.getElementById('key-id-input');

// Hàm hiển thị 1 tin nhắn lên màn hình (Dùng textContent để chống XSS)
function renderMessage(senderType, text) {
  // Xóa trạng thái trống nếu có
  const emptyState = messagesContainer.querySelector('.chat-empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const bubble = document.createElement('div');
  bubble.classList.add('chat-message-bubble', senderType);
  
  // BẮT BỘC: Dùng textContent bảo mật theo yêu cầu
  bubble.textContent = text; 
  
  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Xử lý sự kiện khi nhấn nút Gửi
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  const secretKey = secretKeyInput.value.trim();

  if (!text) return;

  // Kiểm tra bắt buộc phải nhập khóa trước khi gửi
  if (!secretKey) {
    alert('Vui lòng nhập Khóa bí mật trước khi gửi tin nhắn!');
    return;
  }

  // Tạm thời hiển thị bản tin nhắn lên màn hình người gửi
  renderMessage('sent', text);

  // Tạo ID tin nhắn phía client để chống trùng lặp
  const clientMessageId = 'msg_' + Date.now();

  // Gọi hàm gửi tin nhắn qua Socket (sẽ xử lý ở socket.js)
  if (typeof sendSocketMessage === 'function') {
    sendSocketMessage({
      conversationId: currentConversationId,
      clientMessageId: clientMessageId,
      plaintextTemp: text,
      algorithm: algoSelect.value,
      keyId: keyIdInput.value || 'default_key'
    });
  }

  messageInput.value = '';
});