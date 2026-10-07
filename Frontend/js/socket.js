// const SOCKET_SERVER_URL =
//   window.location.port === '3000'
//     ? window.location.origin
//     : `${window.location.protocol}//${window.location.hostname}:3000`;

const IS_LOCAL =
    ["127.0.0.1", "localhost"].includes(
        window.location.hostname
    );

const SOCKET_SERVER_URL =
    IS_LOCAL && window.location.port !== "3000"
        ? "http://127.0.0.1:3000"
        : window.location.origin;

let socket = null;

let handlers = {
  onMessage: null,
  onConnectionChange: null
};

// Những conversation cần join lại sau khi reconnect
const desiredConversationRooms = new Set();

function notifyConnection(status, detail = '') {
  handlers.onConnectionChange?.({
    status,
    detail
  });
}


// ==========================================
// LOAD SOCKET.IO CLIENT
// ==========================================

function loadSocketIoClient() {
  if (window.io) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {

    const existing = document.querySelector(
      'script[data-secure-chat-socketio="1"]'
    );

    if (existing) {

      existing.addEventListener(
        'load',
        () => resolve(),
        {
          once: true
        }
      );

      existing.addEventListener(
        'error',
        () =>
          reject(
            new Error(
              'Không tải được Socket.IO client.'
            )
          ),
        {
          once: true
        }
      );

      return;
    }


    const script =
      document.createElement('script');

    script.src =
      `${SOCKET_SERVER_URL}/socket.io/socket.io.js`;

    script.async = true;

    script.dataset.secureChatSocketio = '1';


    script.addEventListener(
      'load',
      () => resolve(),
      {
        once: true
      }
    );


    script.addEventListener(
      'error',
      () =>
        reject(
          new Error(
            'Không tải được Socket.IO client.'
          )
        ),
      {
        once: true
      }
    );


    document.head.appendChild(script);
  });
}


// ==========================================
// EMIT + ACK
// ==========================================

function emitWithAck(
  event,
  payload,
  timeoutMs = 7000
) {

  return new Promise(
    (resolve, reject) => {

      if (!socket?.connected) {

        reject(
          new Error(
            'Socket chưa kết nối.'
          )
        );

        return;
      }


      socket
        .timeout(timeoutMs)
        .emit(
          event,
          payload,

          (error, response) => {

            if (error) {

              reject(
                new Error(
                  `${event} timeout.`
                )
              );

              return;
            }


            resolve(response);
          }
        );

    }
  );
}


// ==========================================
// JOIN LẠI ROOM SAU RECONNECT
// ==========================================

async function rejoinDesiredRooms() {

  for (
    const conversationId
    of desiredConversationRooms
  ) {

    try {

      const response =
        await emitWithAck(
          'conversation:join',
          conversationId
        );


      if (!response?.success) {

        console.warn(
          'Không join lại được conversation:',
          conversationId,
          response?.message
        );

      }

    } catch (error) {

      console.warn(
        'Lỗi join lại conversation:',
        conversationId,
        error.message
      );

    }
  }
}


// ==========================================
// CONNECT SOCKET
// ==========================================

export function connectChatSocket({
  onMessage,
  onConnectionChange
} = {}) {

  handlers = {

    onMessage:
      onMessage || null,

    onConnectionChange:
      onConnectionChange || null

  };


  notifyConnection(
    'connecting'
  );


  loadSocketIoClient()

    .then(() => {

      if (socket) {

        socket.removeAllListeners();

        socket.disconnect();
      }


      socket =
        window.io(
          SOCKET_SERVER_URL,
          {
            withCredentials: true,

            transports: [
              'websocket',
              'polling'
            ]
          }
        );


      // ==================================
      // CONNECTED
      // ==================================

      socket.on(
        'connect',

        async () => {

          console.log(
            '✅ Socket connected:',
            socket.id
          );


          notifyConnection(
            'connected'
          );


          await rejoinDesiredRooms();
        }
      );


      // ==================================
      // DISCONNECT
      // ==================================

      socket.on(
        'disconnect',

        reason => {

          console.log(
            'Socket disconnected:',
            reason
          );


          notifyConnection(
            'disconnected',

            reason ||
              'Mất kết nối Socket.IO'
          );

        }
      );


      // ==================================
      // CONNECT ERROR
      // ==================================

      socket.on(
        'connect_error',

        error => {

          console.error(
            'Socket error:',
            error
          );


          notifyConnection(
            'error',

            error?.message ||
              'Không kết nối được Socket.IO.'
          );

        }
      );


      // ==================================
      // NHẬN MESSAGE REALTIME
      // ==================================

      socket.on(
        'message:new',

        payload => {

          handlers.onMessage?.(
            payload
          );

        }
      );

    })

    .catch(error => {

      notifyConnection(
        'unavailable',
        error.message
      );

    });
}


// ==========================================
// DISCONNECT SOCKET
// ==========================================

export function disconnectChatSocket() {

  desiredConversationRooms.clear();


  if (!socket) {
    return;
  }


  socket.removeAllListeners();

  socket.disconnect();

  socket = null;


  notifyConnection(
    'disconnected'
  );
}


// ==========================================
// CHECK CONNECT
// ==========================================

export function isSocketConnected() {

  return Boolean(
    socket?.connected
  );

}


// ==========================================
// JOIN CONVERSATION
// ==========================================

export async function joinConversationSocket(
  conversationId
) {

  if (!conversationId) {

    throw new Error(
      'Thiếu conversationId.'
    );

  }


  desiredConversationRooms.add(
    conversationId
  );


  if (!socket?.connected) {

    throw new Error(
      'Socket chưa kết nối.'
    );

  }


  const response =
    await emitWithAck(
      'conversation:join',
      conversationId
    );


  if (!response?.success) {

    throw new Error(
      response?.message ||
        'Không thể tham gia cuộc trò chuyện.'
    );

  }


  return response;
}


// ==========================================
// LEAVE CONVERSATION
// ==========================================

export async function leaveConversationSocket(
  conversationId
) {

  if (!conversationId) {
    return;
  }


  desiredConversationRooms.delete(
    conversationId
  );


  if (!socket?.connected) {
    return;
  }


  const response =
    await emitWithAck(
      'conversation:leave',
      conversationId
    );


  if (!response?.success) {

    throw new Error(
      response?.message ||
        'Không thể rời cuộc trò chuyện.'
    );

  }
}


// ==========================================
// SEND ENCRYPTED MESSAGE
// ==========================================

export async function sendEncryptedSocketMessage({
  conversationId,
  clientMessageId,
  envelope
}) {

  if (!conversationId) {

    throw new Error(
      'Thiếu conversationId.'
    );

  }


  if (!clientMessageId) {

    throw new Error(
      'Thiếu clientMessageId.'
    );

  }


  if (!envelope?.algorithm) {

    throw new Error(
      'Gói mã hóa thiếu algorithm.'
    );

  }


  if (
    !envelope?.iv ||
    !envelope?.ciphertext
  ) {

    throw new Error(
      'Gói mã hóa thiếu IV/ciphertext.'
    );

  }


  // Nhớ room để reconnect join lại
  desiredConversationRooms.add(
    conversationId
  );


  if (!socket?.connected) {

    throw new Error(
      'Socket chưa kết nối.'
    );

  }


  // ======================================
  // JOIN ROOM TRƯỚC KHI GỬI
  // ======================================

  const joinResult =
    await emitWithAck(
      'conversation:join',
      conversationId
    );


  if (!joinResult?.success) {

    throw new Error(
      joinResult?.message ||
        'Không thể tham gia cuộc trò chuyện.'
    );

  }


  // ======================================
  // PAYLOAD CHO BACKEND ĐỨC
  // ======================================

  const payload = {

    conversationId,

    clientMessageId,

    algorithm:
      envelope.algorithm,

    keyId:
      envelope.keyId || null,

    iv:
      envelope.iv,

    ciphertext:
      envelope.ciphertext,


    // DES frontend dùng mac
    // backend Message dùng hmac
    hmac:
      envelope.hmac ||
      envelope.mac ||
      null,


    timestamp:
      envelope.timestamp ||
      Date.now()

  };


  // ======================================
  // SEND
  // ======================================

  const response =
    await emitWithAck(
      'message:send',
      payload
    );


  if (!response?.success) {

    throw new Error(
      response?.message ||
        'Máy chủ từ chối lưu tin nhắn.'
    );

  }


  const savedMessage =
    response.message || {};


  return {

    ok: true,

    messageId:
      savedMessage._id || '',

    createdAt:
      savedMessage.createdAt ||
      new Date().toISOString(),

    message:
      savedMessage

  };
}