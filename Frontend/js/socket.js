let socket = null;
let handlers = {
  onMessage: null,
  onConnectionChange: null
};

function emitConnectionState(status, detail = '') {
  if (typeof handlers.onConnectionChange === 'function') {
    handlers.onConnectionChange({ status, detail });
  }
}

/**
 * Khởi tạo duy nhất một kết nối Socket.IO.
 * Theo kế hoạch, socket.js là nơi duy nhất đăng ký listener.
 */
export function connectChatSocket({
  onMessage,
  onConnectionChange
} = {}) {
  handlers.onMessage = onMessage ?? handlers.onMessage;
  handlers.onConnectionChange =
    onConnectionChange ?? handlers.onConnectionChange;

  if (socket) {
    return socket;
  }

  if (typeof window.io !== 'function') {
    emitConnectionState(
      'unavailable',
      'Không tìm thấy Socket.IO client.'
    );
    return null;
  }

  socket = window.io({
    withCredentials: true,
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    emitConnectionState('connected');
  });

  socket.on('disconnect', reason => {
    emitConnectionState('disconnected', reason || '');
  });

  socket.on('connect_error', error => {
    emitConnectionState(
      'error',
      error?.message || 'Không kết nối được máy chủ.'
    );
  });

  socket.on('message:new', payload => {
    if (typeof handlers.onMessage === 'function') {
      handlers.onMessage(payload);
    }
  });

  return socket;
}

export function isSocketConnected() {
  return Boolean(socket?.connected);
}

/**
 * Gửi message:send và chờ ack.
 * Ack được coi là lỗi nếu:
 * - Socket.IO timeout;
 * - ack.ok === false;
 * - ack.error có giá trị.
 */
export function sendEncryptedSocketMessage(payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Mất kết nối. Tin nhắn chưa được gửi.'));
      return;
    }

    socket.timeout(timeoutMs).emit(
      'message:send',
      payload,
      (timeoutError, ack) => {
        if (timeoutError) {
          reject(
            new Error(
              'Máy chủ chưa xác nhận lưu tin nhắn. Có thể thử gửi lại.'
            )
          );
          return;
        }

        if (ack?.ok === false || ack?.error) {
          reject(
            new Error(
              ack?.message ||
                ack?.error ||
                'Máy chủ từ chối tin nhắn.'
            )
          );
          return;
        }

        resolve(ack || { ok: true });
      }
    );
  });
}

export function disconnectChatSocket() {
  if (!socket) return;

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
