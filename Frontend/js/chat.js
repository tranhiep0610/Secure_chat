import {
  connectChatSocket,
  disconnectChatSocket,
  isSocketConnected,
  joinConversationSocket,
  sendEncryptedSocketMessage
} from './socket.js';

// =====================================================
// CONFIG
// =====================================================

const params = new URLSearchParams(window.location.search);
const DEMO_MODE = params.get('demo') === '1';

const API_BASE_URL =
  window.location.protocol === 'file:'
    ? 'http://localhost:3000'
    : window.location.port === '3000'
      ? window.location.origin
      : `${window.location.protocol}//${window.location.hostname}:3000`;

const $ = selector => document.querySelector(selector);

// =====================================================
// UI
// =====================================================

const ui = {

  btnDeleteKey:
  $('#btnDeleteKey'),
  meAvatar: $('#meAvatar'),
  meDisplayName: $('#meDisplayName'),
  connectionText: $('#connectionText'),
  connectionDot: $('#connectionDot'),
  btnLogout: $('#btnLogout'),

    navMessages: $('#navMessages'),
  navFriends: $('#navFriends'),
  navRequests: $('#navRequests'),
  navBlocked: $('#navBlocked'),

  btnProfile: $('#btnProfile'),

  featurePage: $('#featurePage'),
  featureTitle: $('#featureTitle'),
  featureDescription: $('#featureDescription'),
  featureToolbar: $('#featureToolbar'),
  featureSearch: $('#featureSearch'),
  featureContent: $('#featureContent'),

  userSearch: $('#userSearch'),
  userCount: $('#userCount'),
  userList: $('#userList'),

  peerAvatar: $('#peerAvatar'),
  peerName: $('#peerName'),
  peerStatus: $('#peerStatus'),

  algorithmSelect: $('#algorithmSelect'),
  btnOpenKey: $('#btnOpenKey'),
  btnPeerInfo:
  $('#btnPeerInfo'),

peerInfoModal:
  $('#peerInfoModal'),

btnClosePeerInfo:
  $('#btnClosePeerInfo'),

peerInfoAvatar:
  $('#peerInfoAvatar'),

peerInfoName:
  $('#peerInfoName'),

peerInfoUsername:
  $('#peerInfoUsername'),

peerInfoStatus:
  $('#peerInfoStatus'),

peerInfoEncryption:
  $('#peerInfoEncryption'),
  keyStatusText: $('#keyStatusText'),

  chatNotice: $('#chatNotice'),
  messagesPanel: $('#messagesPanel'),
  btnLoadMore: $('#btnLoadMore'),
  emptyState: $('#emptyState'),
  messageList: $('#messageList'),

  messageForm: $('#messageForm'),
messageInput: $('#messageInput'),

btnEmoji: $('#btnEmoji'),
emojiPicker: $('#emojiPicker'),

btnSend: $('#btnSend'),
  draftHint: $('#draftHint'),

  keyModal: $('#keyModal'),
  btnCloseKey: $('#btnCloseKey'),
  keyAlgorithm: $('#keyAlgorithm'),
  keyIdInput: $('#keyIdInput'),
  keySecretLabel: $('#keySecretLabel'),
  keySecretInput: $('#keySecretInput'),
  keyHelpText: $('#keyHelpText'),
  keyModalError: $('#keyModalError'),
  btnGenerateKey: $('#btnGenerateKey'),
  btnCopyKey: $('#btnCopyKey'),
  btnDeleteKey: $('#btnDeleteKey'),
  btnSaveKey: $('#btnSaveKey')
};

// =====================================================
// STATE
// =====================================================

const state = {
  me: null,

  // Tất cả tài khoản dùng cho tìm kiếm kết bạn
  users: [],

  // Chỉ những người đã kết bạn
  friends: [],

  conversations: [],

  activePeer: null,
  activeConversation: null,

  messages: [],

  historyCursor: null,
  hasMoreHistory: false,
  loadingHistory: false,

  runtimeKeys: new Map(),

  activeKeyByConversation: new Map(),

  pending: new Map(),

  demoMessagesByConversation:
    new Map()
};

// =====================================================
// PERSISTENT KEY STORAGE
// Mỗi tài khoản + conversation + algorithm = 1 key
// =====================================================

const KEY_STORAGE_PREFIX =
  'secureChatKey_v1';


function getStoredKeyName(
  algorithm
) {

  const userId =
    getId(
      state.me
    );

  const conversationId =
    getId(
      state.activeConversation
    );

  if (
    !userId ||
    !conversationId
  ) {
    return '';
  }


  return (
    `${KEY_STORAGE_PREFIX}:` +
    `${userId}:` +
    `${conversationId}:` +
    `${algorithm}`
  );
}


// =============================
// LƯU KEY XUỐNG LOCALSTORAGE
// =============================

function saveKeyToStorage(
  record
) {

  const storageName =
    getStoredKeyName(
      record.algorithm
    );


  if (!storageName) {
    return;
  }


  const data = {

    algorithm:
      record.algorithm,

    keyId:
      record.keyId,

    secretForShare:
      record.secretForShare,

    savedAt:
      Date.now()

  };


  localStorage.setItem(
    storageName,
    JSON.stringify(
      data
    )
  );


  console.log(
    '🔐 Đã lưu key:',
    record.keyId
  );
}


// =============================
// CHUYỂN KEY ĐÃ LƯU THÀNH
// CRYPTOKEY / DES RECORD
// =============================

async function buildKeyFromStoredData(
  stored
) {

  if (
    !stored ||
    !stored.algorithm ||
    !stored.keyId ||
    !stored.secretForShare
  ) {

    throw new Error(
      'Dữ liệu khóa đã lưu không hợp lệ.'
    );

  }


  // ===================================
  // AES-GCM
  // ===================================

  if (
    stored.algorithm ===
    'AES-GCM'
  ) {

    const rawBytes =
      bytesFromBase64(
        stored.secretForShare
      );


    if (
      ![
        16,
        24,
        32
      ].includes(
        rawBytes.length
      )
    ) {

      throw new Error(
        'Khóa AES đã lưu không hợp lệ.'
      );

    }


    const key =
      await crypto
        .subtle
        .importKey(

          'raw',

          rawBytes,

          {
            name:
              'AES-GCM'
          },

          true,

          [
            'encrypt',
            'decrypt'
          ]

        );


    return {

      algorithm:
        stored.algorithm,

      keyId:
        stored.keyId,

      key,

      secretForShare:
        stored.secretForShare

    };

  }



  // ===================================
  // DES-CBC
  // ===================================

  if (
    stored.algorithm ===
    'DES-CBC'
  ) {

    const parts =
      stored
        .secretForShare
        .split(':');


    if (
      parts.length !== 2
    ) {

      throw new Error(
        'Khóa DES đã lưu không hợp lệ.'
      );

    }


    const [
      desKeyHex,
      macKeyHex
    ] = parts;


    return {

      algorithm:
        stored.algorithm,

      keyId:
        stored.keyId,

      key: {

        type:
          'DES-CBC-HMAC-SHA256',

        desKeyHex:
          desKeyHex
            .toLowerCase(),

        macKeyHex:
          macKeyHex
            .toLowerCase()

      },

      secretForShare:
        stored.secretForShare

    };

  }


  throw new Error(
    'Thuật toán khóa đã lưu không hỗ trợ.'
  );
}



// =============================
// TỰ ĐỘNG LOAD KEY
// =============================

async function restoreKeyFromStorage(
  algorithm
) {

  const storageName =
    getStoredKeyName(
      algorithm
    );


  if (!storageName) {
    return null;
  }


  const raw =
    localStorage.getItem(
      storageName
    );


  if (!raw) {

    console.log(
      'Không có key đã lưu:',
      algorithm
    );

    return null;

  }


  try {

    const stored =
      JSON.parse(
        raw
      );


    const record =
      await buildKeyFromStoredData(
        stored
      );


    // Lưu lại vào RAM
    state.runtimeKeys.set(
      record.keyId,
      record
    );


    // Gắn key vào đúng conversation
    const lookupKey =
      conversationKey(
        record.algorithm
      );


    state
      .activeKeyByConversation
      .set(
        lookupKey,
        record.keyId
      );


    console.log(
      '✅ Đã tự nạp key:',
      record.keyId
    );


    return record;

  }

  catch (error) {

    console.error(
      'Load key lỗi:',
      error
    );


    return null;

  }

}

const DEMO_USERS = [
  { _id: 'demo_hai', username: 'hai', displayName: 'Hải' },
  { _id: 'demo_dat', username: 'dat', displayName: 'Thiên Đạt' },
  { _id: 'demo_duc', username: 'duc', displayName: 'Đức' },
  { _id: 'demo_cong', username: 'cong', displayName: 'Công' }
];

// =====================================================
// COMMON HELPERS
// =====================================================

function getId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || value.userId || '';
}

function displayName(user) {
  return (
    user?.displayName ||
    user?.username ||
    user?.name ||
    'Người dùng'
  );
}

function initials(user) {
  const value = displayName(user).trim();

  if (!value) {
    return '?';
  }

  return value
    .split(/\s+/)
    .slice(-2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function randomId(prefix) {
  if (crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  return `${prefix}_${Array.from(
    bytes,
    byte =>
      byte
        .toString(16)
        .padStart(2, '0')
  ).join('')}`;
}

function formatTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString(
    'vi-VN',
    {
      hour: '2-digit',
      minute: '2-digit'
    }
  );
}

function showNotice(
  message,
  type = 'info'
) {
  if (!ui.chatNotice) {
    return;
  }

  ui.chatNotice.hidden = false;

  ui.chatNotice.className =
    'chat-notice';

  if (type === 'error') {
    ui.chatNotice.classList.add(
      'is-error'
    );
  }

  if (type === 'success') {
    ui.chatNotice.classList.add(
      'is-success'
    );
  }

  ui.chatNotice.textContent =
    message;
}

function hideNotice() {
  if (!ui.chatNotice) {
    return;
  }

  ui.chatNotice.hidden = true;
  ui.chatNotice.textContent = '';
  ui.chatNotice.className =
    'chat-notice';
}

// =====================================================
// API
// =====================================================

async function apiRequest(
  path,
  options = {}
) {
  const response =
    await fetch(
      `${API_BASE_URL}${path}`,
      {
        credentials:
          'include',

        headers: {
          'Content-Type':
            'application/json',

          ...(options.headers || {})
        },

        ...options
      }
    );


  let body = null;


  try {
    body =
      await response.json();
  }

  catch {
    body = null;
  }


  // Chỉ /api/auth/me mới được quyền
  // xác định phiên đăng nhập đã hết.
  //
  // Các API khác 401 thì chỉ báo lỗi,
  // KHÔNG tự đá user ra trang login.
  if (
    response.status === 401
  ) {

    if (
      path ===
      '/api/auth/me'
    ) {

      window.location.href =
        './index.html';


      throw new Error(
        'Phiên đăng nhập đã hết.'
      );
    }


    throw new Error(
      body?.message ||
      'API từ chối quyền truy cập.'
    );
  }


  if (
    !response.ok
  ) {

    throw new Error(
      body?.message ||
      body?.error ||
      `Yêu cầu thất bại (${response.status}).`
    );
  }


  return body;
}

function unwrapList(
  body,
  possibleKeys = []
) {
  if (Array.isArray(body)) {
    return body;
  }

  for (
    const key
    of possibleKeys
  ) {
    if (
      Array.isArray(
        body?.[key]
      )
    ) {
      return body[key];
    }
  }

  return [];
}

// =====================================================
// CONVERSATION HELPERS
// =====================================================

function normalizeConversation(
  raw
) {
  return {
    ...raw,

    _id:
      raw?._id ||
      raw?.id ||
      raw?.conversationId,

    members:
      raw?.members ||
      raw?.memberIds ||
      raw?.participants ||
      []
  };
}

function findPeerInConversation(
  conversation
) {
  const myId =
    getId(state.me);

  const members =
    conversation?.members ||
    [];

  for (
    const member
    of members
  ) {
    if (
      getId(member) === myId
    ) {
      continue;
    }

    if (
      typeof member ===
      'object'
    ) {
      return member;
    }

    return (
      state.users.find(
        user =>
          getId(user) ===
          getId(member)
      ) ||
      null
    );
  }

  const peerId =
    conversation?.peerId ||
    conversation?.otherUserId ||
    conversation?.peer?._id;

  if (
    conversation?.peer &&
    typeof conversation.peer ===
      'object'
  ) {
    return conversation.peer;
  }

  if (peerId) {
    return (
      state.users.find(
        user =>
          getId(user) ===
          getId(peerId)
      ) ||
      null
    );
  }

  return null;
}

function getConversationForPeer(
  peerId
) {
  return state.conversations.find(
    conversation => {
      const peer =
        findPeerInConversation(
          conversation
        );

      return (
        getId(peer) ===
        peerId
      );
    }
  );
}

// =====================================================
// KEY STATE
// =====================================================

function conversationKey(
  algorithm
) {
  const conversationId =
    getId(
      state.activeConversation
    );

  if (!conversationId) {
    return '';
  }

  return (
    `${conversationId}|${algorithm}`
  );
}

function getActiveKeyRecord(
  algorithm
) {
  const lookupKey =
    conversationKey(
      algorithm
    );

  const keyId =
    state.activeKeyByConversation
      .get(lookupKey);

  if (!keyId) {
    return null;
  }

  return (
    state.runtimeKeys.get(
      keyId
    ) ||
    null
  );
}

function setActiveKeyRecord(
  record
) {

  const lookupKey =
    conversationKey(
      record.algorithm
    );


  if (!lookupKey) {

    throw new Error(
      'Hãy chọn hội thoại trước khi thiết lập khóa.'
    );

  }


  const oldKeyId =
    state
      .activeKeyByConversation
      .get(
        lookupKey
      );


  // =====================================
  // MỖI CONVERSATION CHỈ 1 KEY
  // =====================================

  if (
    oldKeyId &&
    oldKeyId !== record.keyId
  ) {

    throw new Error(
      'Hội thoại này đã có khóa. Không được thay bằng khóa khác.'
    );

  }


  // =====================================
  // LƯU RAM
  // =====================================

  state.runtimeKeys.set(
    record.keyId,
    record
  );


  state
    .activeKeyByConversation
    .set(
      lookupKey,
      record.keyId
    );


  // =====================================
  // LƯU LOCALSTORAGE
  // =====================================

  saveKeyToStorage(
    record
  );


  updateKeyStatus();

}

// =====================================================
// UI STATE
// =====================================================

function updateConnectionUI({
  status,
  detail = ''
}) {
  if (
    !ui.connectionDot ||
    !ui.connectionText
  ) {
    return;
  }

  ui.connectionDot.classList.remove(
    'is-online',
    'is-offline'
  );

  if (
    status === 'connected'
  ) {
    ui.connectionDot.classList.add(
      'is-online'
    );

    ui.connectionText.textContent =
      'Đang online';

    return;
  }

  ui.connectionDot.classList.add(
    'is-offline'
  );

  if (
    status === 'connecting'
  ) {
    ui.connectionText.textContent =
      'Đang kết nối...';

    return;
  }

  if (
    status === 'unavailable'
  ) {
    ui.connectionText.textContent =
      'Socket chưa sẵn sàng';

    if (detail) {
      showNotice(
        detail,
        'error'
      );
    }

    return;
  }

  if (
    status === 'error'
  ) {
    ui.connectionText.textContent =
      'Lỗi kết nối';

    if (detail) {
      showNotice(
        detail,
        'error'
      );
    }

    return;
  }

  ui.connectionText.textContent =
    'Đang offline';
}

function updateKeyStatus() {
  if (
    !ui.algorithmSelect ||
    !ui.keyStatusText ||
    !ui.btnOpenKey
  ) {
    return;
  }

  const algorithm =
    ui.algorithmSelect.value;

  const record =
    getActiveKeyRecord(
      algorithm
    );

  ui.btnOpenKey.disabled =
    !state.activeConversation;

  if (
    !state.activeConversation
  ) {
    ui.keyStatusText.textContent =
      'Chưa có khóa';

    return;
  }

  if (!record) {
    ui.keyStatusText.textContent =
      'Thiếu khóa';

    return;
  }

  ui.keyStatusText.textContent =
    record.keyId;
}

function updateComposerState() {

  const hasConversation =
    Boolean(
      state.activeConversation
    );

  if (ui.messageInput) {

    ui.messageInput.disabled =
      !hasConversation;

    ui.messageInput.placeholder =
      hasConversation
        ? 'Nhập tin nhắn...'
        : 'Chọn một người để nhắn tin...';
  }


  if (ui.btnSend) {

    ui.btnSend.disabled =
      !hasConversation;
  }


  if (ui.btnOpenKey) {

    ui.btnOpenKey.disabled =
      !hasConversation;
  }


  if (ui.btnPeerInfo) {

    ui.btnPeerInfo.disabled =
      !hasConversation;
  }

}

function renderMe() {
  if (
    ui.meDisplayName
  ) {
    ui.meDisplayName.textContent =
      displayName(
        state.me
      );
  }

  if (
    ui.meAvatar
  ) {
    ui.meAvatar.textContent =
      initials(
        state.me
      );
  }
}

function renderActivePeer() {
  if (
    !ui.peerAvatar ||
    !ui.peerName ||
    !ui.peerStatus
  ) {
    return;
  }

  if (
    !state.activePeer
  ) {
    ui.peerAvatar.textContent =
      '?';

    ui.peerName.textContent =
      'Chọn một người để bắt đầu chat';

    ui.peerStatus.textContent =
      'Chưa có hội thoại';

    return;
  }

  ui.peerAvatar.textContent =
    initials(
      state.activePeer
    );

  ui.peerName.textContent =
    displayName(
      state.activePeer
    );

  ui.peerStatus.textContent =
    state.activeConversation
      ? 'Hội thoại 1–1'
      : 'Đang tạo hội thoại...';
}

function setEmptyState(
  title,
  description
) {
  if (
    !ui.emptyState
  ) {
    return;
  }

  ui.emptyState.hidden =
    false;

  const titleNode =
    ui.emptyState
      .querySelector('h2');

  const descriptionNode =
    ui.emptyState
      .querySelector('p');

  if (titleNode) {
    titleNode.textContent =
      title;
  }

  if (descriptionNode) {
    descriptionNode.textContent =
      description;
  }
}

function hideEmptyState() {
  if (
    ui.emptyState
  ) {
    ui.emptyState.hidden =
      true;
  }
}

// =====================================================
// RENDER CHAT LIST
// CHỈ HIỆN NGƯỜI ĐÃ LÀ BẠN BÈ
// =====================================================

function renderUsers() {
  const query =
    ui.userSearch.value
      .trim()
      .toLowerCase();


  // =====================================
  // LẤY USER TỪ DANH SÁCH FRIEND
  // =====================================

  const friendUsers =
    state.friends
      .map(
        item =>
          item?.user
      )
      .filter(Boolean);


  // =====================================
  // SEARCH
  // =====================================

  const filtered =
    friendUsers.filter(
      user => {

        if (!query) {
          return true;
        }


        const text =
          `${displayName(user)} ${user.username || ''}`
            .toLowerCase();


        return text.includes(
          query
        );
      }
    );


  ui.userCount.textContent =
    String(
      filtered.length
    );


  ui.userList
    .replaceChildren();


  // =====================================
  // KHÔNG CÓ BẠN
  // =====================================

  if (
    !filtered.length
  ) {
    const empty =
      document.createElement(
        'div'
      );


    empty.className =
      'chat-list-state';


    if (query) {
      empty.textContent =
        'Không tìm thấy bạn bè.';
    }

    else {
      empty.textContent =
        'Chưa có bạn bè. Vào mục Bạn bè để kết bạn.';
    }


    ui.userList.appendChild(
      empty
    );


    return;
  }


  // =====================================
  // RENDER FRIEND
  // =====================================

  filtered.forEach(
    user => {

      const peerId =
        getId(user);


      const conversation =
        getConversationForPeer(
          peerId
        );


      // ===============================
      // BUTTON
      // ===============================

      const button =
        document.createElement(
          'button'
        );


      button.type =
        'button';


      button.className =
        'chat-user-item';


      button.setAttribute(
        'role',
        'listitem'
      );


      if (
        peerId ===
        getId(
          state.activePeer
        )
      ) {
        button.classList.add(
          'is-active'
        );
      }


      // ===============================
      // AVATAR
      // ===============================

      const avatar =
        document.createElement(
          'div'
        );


      avatar.className =
        'chat-avatar';


      avatar.textContent =
        initials(
          user
        );


      // ===============================
      // CONTENT
      // ===============================

      const content =
        document.createElement(
          'div'
        );


      content.className =
        'chat-user-item__content';


      const top =
        document.createElement(
          'div'
        );


      top.className =
        'chat-user-item__top';


      const name =
        document.createElement(
          'strong'
        );


      name.textContent =
        displayName(
          user
        );


      const time =
        document.createElement(
          'span'
        );


      time.className =
        'chat-user-item__time';


      if (
        conversation?.updatedAt ||
        conversation
          ?.lastMessage
          ?.createdAt
      ) {

        time.textContent =
          formatTime(
            conversation.updatedAt ||
            conversation
              .lastMessage
              .createdAt
          );
      }


      // ===============================
      // PREVIEW
      // ===============================

      const preview =
        document.createElement(
          'span'
        );


      preview.className =
        'chat-user-item__preview';


      if (
        conversation
          ?.lastMessage
      ) {
        preview.textContent =
          'Có tin nhắn đã mã hóa';
      }

      else {
        preview.textContent =
          `@${user.username || 'user'}`;
      }


      top.append(
        name,
        time
      );


      content.append(
        top,
        preview
      );


      button.append(
        avatar,
        content
      );


      // ===============================
      // CLICK CHAT
      // ===============================

      button.addEventListener(
        'click',
        () => {

          selectPeer(
            user
          )
            .catch(
              error => {

                showNotice(
                  error.message,
                  'error'
                );

              }
            );

        }
      );


      ui.userList.appendChild(
        button
      );

    }
  );
}

// =====================================================
// MESSAGE NORMALIZATION
// =====================================================

function extractEnvelopeFromFlatMessage(
  raw
) {

  if (
    !raw?.algorithm ||
    !raw?.ciphertext
  ) {

    return null;

  }


  return {

    algorithm:
      raw.algorithm,

    keyId:
      raw.keyId,

    iv:
      raw.iv,

    ciphertext:
      raw.ciphertext,


    // DES backend lưu tên hmac
    // Frontend des.js dùng mac
    mac:
      raw.mac ||
      raw.hmac ||
      null,

    hmac:
      raw.hmac ||
      raw.mac ||
      null,


    timestamp:
      raw.timestamp ||
      raw.cryptoTimestamp ||
      raw.createdAt

  };
}

function normalizeMessage(
  raw
) {
  const envelope =
    raw?.envelope ||
    raw?.encryptedPayload ||
    raw?.payload ||
    extractEnvelopeFromFlatMessage(
      raw
    );

  return {
    ...raw,

    _id:
      raw?._id ||
      raw?.id ||
      raw?.messageId ||
      '',

    conversationId:
      getId(
        raw?.conversationId
      ) ||
      getId(
        raw?.conversation
      ) ||
      getId(
        state.activeConversation
      ),

    senderId:
      getId(
        raw?.senderId
      ) ||
      getId(
        raw?.sender
      ) ||
      raw?.fromUserId ||
      '',

    clientMessageId:
      raw?.clientMessageId ||
      raw?.clientId ||
      '',

    createdAt:
      raw?.createdAt ||
      raw?.timestamp ||
      envelope?.timestamp ||
      Date.now(),

    envelope,

    localPlaintext:
      raw?.localPlaintext,

    localStatus:
      raw?.localStatus ||
      ''
  };
}

function messageIdentity(
  message
) {
  return (
    message
      .clientMessageId ||

    message._id ||

    `${
      message.senderId
    }|${
      message.createdAt
    }|${
      message.envelope
        ?.ciphertext ||
      ''
    }`
  );
}

function mergeMessages(
  existing,
  incoming
) {
  const map =
    new Map();

  [
    ...existing,
    ...incoming
  ].forEach(
    raw => {

      const normalized =
        normalizeMessage(
          raw
        );

      const key =
        messageIdentity(
          normalized
        );

      const previous =
        map.get(key);

      if (!previous) {
        map.set(
          key,
          normalized
        );

        return;
      }

      map.set(
        key,
        {
          ...previous,
          ...normalized,

          localPlaintext:
            normalized
              .localPlaintext ??
            previous
              .localPlaintext,

          localStatus:
            normalized
              .localStatus ||
            previous
              .localStatus
        }
      );

    }
  );

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      new Date(
        a.createdAt
      ) -
      new Date(
        b.createdAt
      )
  );
}

// =====================================================
// ENCODING HELPERS
// =====================================================

function base64FromBytes(
  bytes
) {
  let binary = '';

  for (
    const byte
    of bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      );
  }

  return btoa(
    binary
  );
}

function bytesFromBase64(
  value
) {
  const binary =
    atob(value);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i += 1
  ) {
    bytes[i] =
      binary.charCodeAt(
        i
      );
  }

  return bytes;
}

function hexToBytes(
  hex
) {
  if (
    !/^[0-9a-fA-F]*$/
      .test(hex) ||
    hex.length % 2 !== 0
  ) {
    throw new Error(
      'Chuỗi hex không hợp lệ.'
    );
  }

  const bytes =
    new Uint8Array(
      hex.length / 2
    );

  for (
    let i = 0;
    i < bytes.length;
    i += 1
  ) {
    bytes[i] =
      Number.parseInt(
        hex.slice(
          i * 2,
          i * 2 + 2
        ),
        16
      );
  }

  return bytes;
}

function bytesToHex(
  bytes
) {
  return Array.from(
    bytes,
    byte =>
      byte
        .toString(16)
        .padStart(
          2,
          '0'
        )
  ).join('');
}

function hexToBase64(
  hex
) {
  return base64FromBytes(
    hexToBytes(
      hex
    )
  );
}

function base64ToHex(
  value
) {
  return bytesToHex(
    bytesFromBase64(
      value
    )
  );
}

// =====================================================
// CRYPTO ENVELOPE
// =====================================================

function serializeEnvelopeForWire(
  envelope,
  keyRecord
) {
  if (
    envelope.algorithm ===
    'AES-GCM'
  ) {
    return {
      ...envelope,

      protocolVersion: 1,

      keyBits:
        keyRecord
          .key
          .algorithm
          .length,

      encoding:
        'base64',

      iv:
        base64FromBytes(
          new Uint8Array(
            envelope.iv
          )
        ),

      ciphertext:
        base64FromBytes(
          new Uint8Array(
            envelope.ciphertext
          )
        )
    };
  }

  if (
    envelope.algorithm ===
    'DES-CBC'
  ) {
    return {
      ...envelope,

      protocolVersion: 1,

      keyBits: 56,

      encoding:
        'base64',

      iv:
        hexToBase64(
          envelope.iv
        ),

      ciphertext:
        hexToBase64(
          envelope.ciphertext
        ),

      mac:
        hexToBase64(
          envelope.mac
        )
    };
  }

  throw new Error(
    'Thuật toán không được hỗ trợ.'
  );
}

function deserializeEnvelopeForCrypto(
  envelope
) {
  if (!envelope) {
    throw new Error(
      'Tin nhắn không có gói mã hóa.'
    );
  }

  if (
    envelope.encoding !==
    'base64'
  ) {
    return envelope;
  }

  if (
    envelope.algorithm ===
    'AES-GCM'
  ) {
    return {
      ...envelope,

      iv:
        Array.from(
          bytesFromBase64(
            envelope.iv
          )
        ),

      ciphertext:
        Array.from(
          bytesFromBase64(
            envelope.ciphertext
          )
        )
    };
  }

  if (
    envelope.algorithm ===
    'DES-CBC'
  ) {
    return {
      ...envelope,

      iv:
        base64ToHex(
          envelope.iv
        ),

      ciphertext:
        base64ToHex(
          envelope.ciphertext
        ),

      mac:
        base64ToHex(
          envelope.mac
        )
    };
  }

  return envelope;
}

// =====================================================
// MÃ HÓA PLAINTEXT
// =====================================================

async function encryptPlaintext(plaintext) {

  const algorithm =
    ui.algorithmSelect.value;

  const keyRecord =
    getActiveKeyRecord(
      algorithm
    );


  if (!keyRecord) {

    throw new Error(
      `Chưa có khóa ${algorithm} cho hội thoại này.`
    );

  }


  // ==========================================
  // AES-GCM
  // ==========================================

  if (
    algorithm ===
    'AES-GCM'
  ) {

    const {
      encryptMessage
    } =
      await import(
        './crypto/aes.js'
      );


    const envelopeJson =
      await encryptMessage(
        plaintext,
        keyRecord.key,
        keyRecord.keyId
      );


    // aes.js đã tạo đúng envelope:
    // {
    //   keyId,
    //   algorithm,
    //   iv: [...],
    //   ciphertext: [...],
    //   timestamp
    // }
    //
    // KHÔNG đổi sang Base64 nữa.

    return JSON.parse(
      envelopeJson
    );

  }


  // ==========================================
  // DES-CBC
  // ==========================================

  if (
    algorithm ===
    'DES-CBC'
  ) {

    const {
      encryptDESMessage
    } =
      await import(
        './crypto/des.js'
      );


    const envelopeJson =
      await encryptDESMessage(

        plaintext,

        keyRecord
          .key
          .desKeyHex,

        keyRecord
          .key
          .macKeyHex,

        keyRecord.keyId

      );


    // des.js đã trả:
    // iv = HEX
    // ciphertext = HEX
    // mac = HEX
    //
    // Giữ nguyên.

    return JSON.parse(
      envelopeJson
    );

  }


  throw new Error(
    'Thuật toán chưa được hỗ trợ.'
  );
}



// =====================================================
// GIẢI MÃ ENVELOPE
// =====================================================

async function decryptEnvelope(
  envelope
) {

  if (!envelope) {

    throw new Error(
      'Tin nhắn không có dữ liệu mã hóa.'
    );

  }


  const keyId =
    envelope.keyId;

  const algorithm =
    envelope.algorithm;


  if (
    !keyId ||
    !algorithm
  ) {

    throw new Error(
      'Gói mã hóa thiếu algorithm/keyId.'
    );

  }


  // ==========================================
  // TÌM KEY
  // ==========================================

  const keyRecord =
    state.runtimeKeys.get(
      keyId
    );


  if (!keyRecord) {

    throw new Error(
      `Thiếu khóa ${keyId}.`
    );

  }


  if (
    keyRecord.algorithm !==
    algorithm
  ) {

    throw new Error(
      'Khóa không đúng thuật toán.'
    );

  }


  // Copy envelope để không sửa object gốc
  const cryptoEnvelope = {
    ...envelope
  };


  // ==========================================
  // AES-GCM
  // ==========================================

  if (
    algorithm ===
    'AES-GCM'
  ) {

    const {
      decryptMessage
    } =
      await import(
        './crypto/aes.js'
      );


    // AES cần:
    // iv: Array
    // ciphertext: Array

    if (
      !Array.isArray(
        cryptoEnvelope.iv
      ) ||
      !Array.isArray(
        cryptoEnvelope.ciphertext
      )
    ) {

      throw new Error(
        'Envelope AES không hợp lệ.'
      );

    }


    return await decryptMessage(

      JSON.stringify(
        cryptoEnvelope
      ),

      keyRecord.key

    );

  }


  // ==========================================
  // DES-CBC
  // ==========================================

  if (
    algorithm ===
    'DES-CBC'
  ) {

    // Backend hiện dùng tên hmac
    // nhưng des.js dùng tên mac.

    if (
      !cryptoEnvelope.mac &&
      cryptoEnvelope.hmac
    ) {

      cryptoEnvelope.mac =
        cryptoEnvelope.hmac;

    }


    const {
      decryptDESMessage
    } =
      await import(
        './crypto/des.js'
      );


    return await decryptDESMessage(

      JSON.stringify(
        cryptoEnvelope
      ),

      keyRecord
        .key
        .desKeyHex,

      keyRecord
        .key
        .macKeyHex

    );

  }


  throw new Error(
    'Thuật toán tin nhắn không được hỗ trợ.'
  );
}

async function getMessagePlaintext(
  message
) {
  if (
    message.localPlaintext
  ) {
    return {
      text:
        message.localPlaintext,

      error: false
    };
  }

  try {
    const text =
      await decryptEnvelope(
        message.envelope
      );

    return {
      text,
      error: false
    };
  } catch (error) {
    return {
      text:
        `[Không thể giải mã: ${error.message}]`,

      error: true
    };
  }
}

// =====================================================
// MESSAGE RENDER
// =====================================================

// =====================================================
// RENDER MESSAGES
// =====================================================

// Dùng để tránh 2 lần render bất đồng bộ đè lên nhau.
// Ví dụ: vừa gửi tin -> socket trả về -> render lần nữa.
let messageRenderVersion = 0;

async function renderMessages({
  forceBottom = false
} = {}) {
  if (
    !ui.messageList ||
    !ui.messagesPanel
  ) {
    return;
  }

  // Mỗi lần render tăng version.
  const renderVersion =
    ++messageRenderVersion;

  const panel =
    ui.messagesPanel;

  // =====================================
  // LƯU VỊ TRÍ SCROLL HIỆN TẠI
  // =====================================

  const previousTop =
    panel.scrollTop;

  const previousHeight =
    panel.scrollHeight;

  const distanceFromBottom =
    previousHeight -
    previousTop -
    panel.clientHeight;

  // Nếu đang cách đáy dưới 120px
  // coi như user đang xem tin mới nhất.
  const wasNearBottom =
    distanceFromBottom < 120;


  // =====================================
  // CHƯA CHỌN HỘI THOẠI
  // =====================================

  if (
    !state.activeConversation
  ) {
    ui.messageList
      .replaceChildren();

    setEmptyState(
      'Chưa chọn cuộc trò chuyện',
      'Chọn một người ở bên trái để bắt đầu.'
    );

    return;
  }


  // =====================================
  // HỘI THOẠI CHƯA CÓ TIN
  // =====================================

  if (
    !state.messages.length
  ) {
    ui.messageList
      .replaceChildren();

    setEmptyState(
      `Bắt đầu chat với ${displayName(
        state.activePeer
      )}`,
      'Tin nhắn sẽ được mã hóa ở trình duyệt trước khi gửi.'
    );

    return;
  }


  hideEmptyState();


  // =====================================
  // GIẢI MÃ TOÀN BỘ TRƯỚC
  //
  // KHÔNG xóa messageList ở đây.
  // DOM cũ vẫn đứng nguyên nên không bị
  // co lên rồi nảy xuống.
  // =====================================

  const preparedMessages =
    await Promise.all(
      state.messages.map(
        async message => {
          const plaintext =
            await getMessagePlaintext(
              message
            );

          return {
            message,
            plaintext
          };
        }
      )
    );


  // Nếu trong lúc giải mã đã có
  // render mới hơn chạy thì bỏ render cũ.
  if (
    renderVersion !==
    messageRenderVersion
  ) {
    return;
  }


  // =====================================
  // TẠO TOÀN BỘ TIN NHẮN TRONG RAM
  // =====================================

  const fragment =
    document
      .createDocumentFragment();


  for (
    const item
    of preparedMessages
  ) {
    const message =
      item.message;

    const plaintext =
      item.plaintext;


    const own =
      message.senderId ===
      getId(state.me);


    // ===================================
    // ROW
    // ===================================

    const row =
      document.createElement(
        'div'
      );

    row.className =
      'chat-message-row';


    if (own) {
      row.classList.add(
        'is-own'
      );
    }


    // ===================================
    // BUBBLE
    // ===================================

    const bubble =
      document.createElement(
        'article'
      );

    bubble.className =
      'chat-message';


    // ===================================
    // NỘI DUNG
    // ===================================

    const text =
      document.createElement(
        'p'
      );

    text.className =
      'chat-message__text';


    text.textContent =
      plaintext.text;


    if (
      plaintext.error
    ) {
      text.classList.add(
        'is-error'
      );
    }


    // ===================================
    // META
    // ===================================

    const meta =
      document.createElement(
        'div'
      );

    meta.className =
      'chat-message__meta';


    // Thuật toán
    const algorithm =
      document.createElement(
        'span'
      );

    algorithm.className =
      'chat-message__algorithm';


    algorithm.textContent =
      message
        .envelope
        ?.algorithm ||
      'LOCAL';


    // Thời gian
    const time =
      document.createElement(
        'span'
      );

    time.textContent =
      formatTime(
        message.createdAt
      );


    meta.append(
      algorithm,
      time
    );


    // ===================================
    // TRẠNG THÁI TIN NHẮN
    // ===================================

    if (
      own &&
      message.localStatus
    ) {
      const status =
        document.createElement(
          'span'
        );

      status.className =
        'chat-message__status';


      if (
        message.localStatus ===
        'sending'
      ) {
        status.textContent =
          'Đang gửi...';
      }

      else if (
        message.localStatus ===
        'saved'
      ) {
        status.textContent =
          'Đã lưu';
      }

      else if (
        message.localStatus ===
        'error'
      ) {
        status.textContent =
          'Gửi lỗi';

        status.classList.add(
          'is-error'
        );
      }


      meta.appendChild(
        status
      );
    }


    bubble.append(
      text,
      meta
    );


    // ===================================
    // NÚT THỬ GỬI LẠI
    // ===================================

    if (
      own &&
      message.localStatus ===
        'error' &&
      message.clientMessageId
    ) {
      const retry =
        document.createElement(
          'button'
        );

      retry.type =
        'button';

      retry.className =
        'chat-retry-btn';

      retry.textContent =
        'Thử gửi lại';


      retry.addEventListener(
        'click',
        () => {
          retryMessage(
            message.clientMessageId
          )
            .catch(
              error => {
                showNotice(
                  error.message,
                  'error'
                );
              }
            );
        }
      );


      bubble.appendChild(
        retry
      );
    }


    row.appendChild(
      bubble
    );


    // Chưa đưa trực tiếp lên màn hình.
    fragment.appendChild(
      row
    );
  }


  // =====================================
  // KIỂM TRA LẦN CUỐI
  // =====================================

  if (
    renderVersion !==
    messageRenderVersion
  ) {
    return;
  }


  // =====================================
  // THAY DOM CHỈ ĐÚNG 1 LẦN
  // =====================================

  ui.messageList
    .replaceChildren(
      fragment
    );


  // =====================================
  // XỬ LÝ SCROLL
  // =====================================

  requestAnimationFrame(
    () => {
      // Nếu có render mới hơn rồi
      // thì render cũ không được scroll.
      if (
        renderVersion !==
        messageRenderVersion
      ) {
        return;
      }


      // Khi mở hội thoại hoặc vừa gửi tin
      // thì xuống cuối.
      if (
        forceBottom ||
        wasNearBottom
      ) {
        panel.scrollTop =
          panel.scrollHeight;

        return;
      }


      // Nếu user đang xem tin phía trên
      // thì giữ nguyên vị trí.
      panel.scrollTop =
        previousTop;
    }
  );
}


// =====================================================
// LOAD DATA
// =====================================================

async function loadCurrentUser() {
  if (DEMO_MODE) {
    state.me = {
      _id: 'demo_hiep',
      username: 'hiep',
      displayName: 'Hiệp'
    };

    return;
  }


  const body =
    await apiRequest(
      '/api/auth/me'
    );


  state.me =
    body?.user ||
    body;
}


async function loadUsers() {
  if (DEMO_MODE) {
    state.users =
      DEMO_USERS;

    return;
  }


  const body =
    await apiRequest(
      '/api/users'
    );


  state.users =
    unwrapList(
      body,
      [
        'users',
        'data'
      ]
    );
}

// =====================================================
// LOAD FRIENDS
// =====================================================

async function loadFriends() {
  if (DEMO_MODE) {
    state.friends =
      DEMO_USERS.map(
        user => ({
          friendshipId:
            `demo_friend_${getId(user)}`,

          user
        })
      );

    return;
  }


  const body =
    await apiRequest(
      '/api/friends'
    );


  state.friends =
    Array.isArray(
      body?.friends
    )
      ? body.friends
      : [];
}


async function loadConversations() {
  if (DEMO_MODE) {
    state.conversations =
      [];

    return;
  }


  const body =
    await apiRequest(
      '/api/messages/conversations'
    );


  state.conversations =
    unwrapList(
      body,
      [
        'conversations',
        'data'
      ]
    )
      .map(
        normalizeConversation
      );
}


// =====================================================
// TẠO / LẤY HỘI THOẠI
// =====================================================

async function ensureConversation(
  peer
) {
  const peerId =
    getId(peer);


  let conversation =
    getConversationForPeer(
      peerId
    );


  if (conversation) {
    return conversation;
  }


  // =====================================
  // DEMO
  // =====================================

  if (DEMO_MODE) {
    conversation =
      normalizeConversation(
        {
          _id:
            `demo_conv_${peerId}`,

          members: [
            state.me,
            peer
          ],

          createdAt:
            new Date()
              .toISOString()
        }
      );


    state.conversations.push(
      conversation
    );


    return conversation;
  }


  // =====================================
  // REAL API
  // =====================================

  const body =
    await apiRequest(
      '/api/messages/conversation',
      {
        method: 'POST',

        body:
          JSON.stringify(
            {
              targetUserId:
                peerId
            }
          )
      }
    );


  conversation =
    normalizeConversation(
      body?.conversation ||
      body
    );


  state.conversations.push(
    conversation
  );


  return conversation;
}


// =====================================================
// CHỌN NGƯỜI CHAT
// =====================================================

async function selectPeer(
  peer
) {
  hideNotice();


  state.activePeer =
    peer;


  state.activeConversation =
    null;


  state.messages =
    [];


  renderUsers();

  renderActivePeer();

  updateComposerState();

  updateKeyStatus();


  setEmptyState(
    'Đang mở hội thoại...',
    'Vui lòng chờ.'
  );


  // =====================================
  // LẤY / TẠO HỘI THOẠI
  // =====================================

  const conversation =
    await ensureConversation(
      peer
    );


  state.activeConversation =
    conversation;


  // =====================================
  // TỰ LOAD KEY CỦA CONVERSATION
  // =====================================
  //
  // Load cả AES và DES.
  // Tin lịch sử dùng thuật toán nào
  // vẫn có thể tìm đúng key.
  // =====================================

  await restoreKeyFromStorage(
    'AES-GCM'
  );


  await restoreKeyFromStorage(
    'DES-CBC'
  );


  renderUsers();

  renderActivePeer();

  updateComposerState();

  updateKeyStatus();


  // =====================================
  // JOIN SOCKET ROOM
  // =====================================

  if (
    !DEMO_MODE &&
    isSocketConnected()
  ) {
    try {
      await joinConversationSocket(
        getId(
          conversation
        )
      );
    }

    catch (error) {
      console.warn(
        'Join conversation socket:',
        error.message
      );
    }
  }


  // =====================================
  // LOAD HISTORY
  // =====================================

  await loadHistory();
}


// =====================================================
// LOAD HISTORY
// =====================================================

async function loadHistory() {
  if (
    !state.activeConversation
  ) {
    return;
  }


  let messages = [];


  // =====================================
  // DEMO MODE
  // =====================================

  if (DEMO_MODE) {
    const conversationId =
      getId(
        state.activeConversation
      );


    messages =
      state
        .demoMessagesByConversation
        .get(
          conversationId
        ) ||
      [];
  }


  // =====================================
  // REAL BACKEND
  // =====================================

  else {
    const conversationId =
      getId(
        state.activeConversation
      );


    const body =
      await apiRequest(
        `/api/messages/${encodeURIComponent(
          conversationId
        )}`
      );


    messages =
      unwrapList(
        body,
        [
          'messages',
          'data'
        ]
      );
  }


  // =====================================
  // MERGE
  // =====================================

  state.messages =
    mergeMessages(
      [],
      messages
    );


  // Hiện tại backend chưa dùng
  // pagination history ở đây.
  if (
    ui.btnLoadMore
  ) {
    ui.btnLoadMore.hidden =
      true;
  }


  // Khi mới mở hội thoại:
  // xuống cuối ngay.
  await renderMessages({
    forceBottom: true
  });
}

// =====================================================
// SEND MESSAGE
// =====================================================

function buildOutgoingMessage(
  plaintext,
  envelope,
  clientMessageId
) {
  return normalizeMessage(
    {
      conversationId:
        getId(
          state.activeConversation
        ),

      senderId:
        getId(
          state.me
        ),

      clientMessageId,

      createdAt:
        new Date()
          .toISOString(),

      envelope,

      localPlaintext:
        plaintext,

      localStatus:
        'sending'
    }
  );
}

function updateLocalMessageStatus(
  clientMessageId,
  localStatus,
  patch = {}
) {
  state.messages =
    state.messages.map(
      message => {

        if (
          message.clientMessageId !==
          clientMessageId
        ) {
          return message;
        }

        return {
          ...message,
          ...patch,
          localStatus
        };
      }
    );
}

async function sendPayloadToServer(
  pendingRecord
) {
  if (DEMO_MODE) {
    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          300
        )
    );

    const stored =
      normalizeMessage(
        {
          ...pendingRecord.message,

          _id:
            randomId(
              'demo_msg'
            ),

          localStatus:
            'saved',

          createdAt:
            new Date()
              .toISOString()
        }
      );

    const conversationId =
      stored.conversationId;

    const old =
      state
        .demoMessagesByConversation
        .get(
          conversationId
        ) ||
      [];

    state
      .demoMessagesByConversation
      .set(
        conversationId,

        mergeMessages(
          old,
          [
            stored
          ]
        )
      );

    return {
      ok: true,

      messageId:
        stored._id,

      createdAt:
        stored.createdAt,

      message:
        stored
    };
  }

  return (
    sendEncryptedSocketMessage(
      {
        conversationId:
          pendingRecord
            .message
            .conversationId,

        clientMessageId:
          pendingRecord
            .message
            .clientMessageId,

        envelope:
          pendingRecord
            .message
            .envelope
      }
    )
  );
}

async function sendNewMessage(
  plaintext
) {
  const envelope =
    await encryptPlaintext(
      plaintext
    );

  const clientMessageId =
    randomId(
      'msg'
    );

  const message =
    buildOutgoingMessage(
      plaintext,
      envelope,
      clientMessageId
    );

  const pendingRecord = {
    message,
    plaintext
  };

  state.pending.set(
    clientMessageId,
    pendingRecord
  );

  state.messages =
    mergeMessages(
      state.messages,
      [
        message
      ]
    );

  await renderMessages();

  try {
    const ack =
      await sendPayloadToServer(
        pendingRecord
      );

    updateLocalMessageStatus(
      clientMessageId,
      'saved',
      {
        _id:
          ack?.messageId ||
          message._id,

        createdAt:
          ack?.createdAt ||
          message.createdAt
      }
    );

    state.pending.delete(
      clientMessageId
    );

    ui.messageInput.value =
      '';

    resizeComposer();

    await renderMessages();

    showNotice(
      'Tin nhắn đã được máy chủ xác nhận lưu.',
      'success'
    );

    window.setTimeout(
      () => {

        if (
          ui.chatNotice
            ?.textContent ===
          'Tin nhắn đã được máy chủ xác nhận lưu.'
        ) {
          hideNotice();
        }

      },
      1500
    );

  } catch (error) {

    updateLocalMessageStatus(
      clientMessageId,
      'error'
    );

    await renderMessages();

    throw error;
  }
}

async function retryMessage(
  clientMessageId
) {
  const pendingRecord =
    state.pending.get(
      clientMessageId
    );

  if (!pendingRecord) {
    throw new Error(
      'Không còn dữ liệu gửi lại cho tin nhắn này.'
    );
  }

  updateLocalMessageStatus(
    clientMessageId,
    'sending'
  );

  await renderMessages();

  try {
    const ack =
      await sendPayloadToServer(
        pendingRecord
      );

    updateLocalMessageStatus(
      clientMessageId,
      'saved',
      {
        _id:
          ack?.messageId ||
          pendingRecord
            .message
            ._id,

        createdAt:
          ack?.createdAt ||
          pendingRecord
            .message
            .createdAt
      }
    );

    state.pending.delete(
      clientMessageId
    );

    await renderMessages();

    showNotice(
      'Gửi lại thành công.',
      'success'
    );

  } catch (error) {

    updateLocalMessageStatus(
      clientMessageId,
      'error'
    );

    await renderMessages();

    throw error;
  }
}

async function handleIncomingMessage(
  raw
) {
  const incoming =
    normalizeMessage(
      raw?.message ||
      raw
    );

  if (
    incoming
      .conversationId !==
    getId(
      state.activeConversation
    )
  ) {
    await loadConversations()
      .catch(
        () => {}
      );

    renderUsers();

    return;
  }

  state.messages =
    mergeMessages(
      state.messages,
      [
        incoming
      ]
    );

  if (
    incoming
      .clientMessageId &&
    incoming.senderId ===
      getId(
        state.me
      )
  ) {
    state.pending.delete(
      incoming
        .clientMessageId
    );
  }

  await renderMessages();
}

// =====================================================
// KEY MODAL
// =====================================================

async function generateKeyForModal() {
  const algorithm =
    ui.algorithmSelect.value;

  // Nếu hội thoại này đã có khóa
  // thì dùng lại, không sinh khóa mới
  const existing =
    getActiveKeyRecord(
      algorithm
    );

  if (existing) {
    ui.keyIdInput.value =
      existing.keyId;

    ui.keySecretInput.value =
      existing.secretForShare || '';

    ui.keyModalError.textContent =
      'Hội thoại này đã có khóa. Đang dùng lại khóa hiện tại.';

    return;
  }

  const keyId =
    randomId(
      algorithm ===
      'AES-GCM'
        ? 'key_aes'
        : 'key_des'
    );

  ui.keyModalError.textContent =
    '';

  // =========================
  // AES-GCM
  // =========================
  if (
    algorithm ===
    'AES-GCM'
  ) {
    const key =
      await crypto
        .subtle
        .generateKey(
          {
            name:
              'AES-GCM',

            length:
              256
          },

          true,

          [
            'encrypt',
            'decrypt'
          ]
        );

    const raw =
      new Uint8Array(
        await crypto
          .subtle
          .exportKey(
            'raw',
            key
          )
      );

    ui.keyIdInput.value =
      keyId;

    ui.keySecretInput.value =
      base64FromBytes(
        raw
      );

    return;
  }

  // =========================
  // DES
  // =========================

  const desKeyBytes =
    new Uint8Array(
      8
    );

  const macKeyBytes =
    new Uint8Array(
      32
    );

  crypto.getRandomValues(
    desKeyBytes
  );

  crypto.getRandomValues(
    macKeyBytes
  );

  ui.keyIdInput.value =
    keyId;

  ui.keySecretInput.value =
    `${
      bytesToHex(
        desKeyBytes
      )
    }:${
      bytesToHex(
        macKeyBytes
      )
    }`;
}

async function importKeyFromModal() {
  const algorithm =
    ui.algorithmSelect.value;

  const keyId =
    ui.keyIdInput
      .value
      .trim();

  const secret =
    ui.keySecretInput
      .value
      .trim();

  if (!keyId) {
    throw new Error(
      'Hãy nhập Key ID.'
    );
  }

  if (!secret) {
    throw new Error(
      'Hãy nhập khóa.'
    );
  }

  if (
    algorithm ===
    'AES-GCM'
  ) {
    const rawBytes =
      bytesFromBase64(
        secret
      );

    if (
      ![
        16,
        24,
        32
      ].includes(
        rawBytes.length
      )
    ) {
      throw new Error(
        'Khóa AES phải có 16, 24 hoặc 32 byte sau khi giải mã Base64.'
      );
    }

    const key =
      await crypto
        .subtle
        .importKey(
          'raw',

          rawBytes,

          {
            name:
              'AES-GCM'
          },

          true,

          [
            'encrypt',
            'decrypt'
          ]
        );

    return {
      algorithm,
      keyId,
      key,

      secretForShare:
        secret
    };
  }

  const parts =
    secret.split(':');

  if (
    parts.length !== 2
  ) {
    throw new Error(
      'Khóa DES demo phải theo dạng desKeyHex:macKeyHex.'
    );
  }

  const [
    desKeyHex,
    macKeyHex
  ] = parts;

  if (
    !/^[0-9a-fA-F]{16}$/
      .test(
        desKeyHex
      )
  ) {
    throw new Error(
      'DES key cần đúng 16 ký tự hex (8 byte).'
    );
  }

  if (
    !/^[0-9a-fA-F]{64}$/
      .test(
        macKeyHex
      )
  ) {
    throw new Error(
      'HMAC key cần đúng 64 ký tự hex (32 byte).'
    );
  }

  return {
    algorithm,
    keyId,

    key: {
      type:
        'DES-CBC-HMAC-SHA256',

      desKeyHex:
        desKeyHex
          .toLowerCase(),

      macKeyHex:
        macKeyHex
          .toLowerCase()
    },

    secretForShare:
      secret
  };
}

function openKeyModal() {
  if (
    !state.activeConversation
  ) {
    return;
  }

  const algorithm =
    ui.algorithmSelect.value;

  const active =
    getActiveKeyRecord(
      algorithm
    );

  ui.keyAlgorithm.value =
    algorithm;

  ui.keyIdInput.value =
    active?.keyId ||
    '';

  ui.keySecretInput.value =
    active
      ?.secretForShare ||
    '';

  ui.keyModalError.textContent =
    active
      ? 'Hội thoại này đã có khóa. Chỉ cần sao chép/chia sẻ khóa hiện tại.'
      : '';

  // Nếu đã có khóa rồi thì
  // không cho sửa nhầm
  ui.keyIdInput.readOnly =
    Boolean(active);

  ui.keySecretInput.readOnly =
    Boolean(active);

  ui.btnGenerateKey.disabled =
    Boolean(active);

  ui.btnSaveKey.disabled =
    Boolean(active);

  if (
    algorithm ===
    'AES-GCM'
  ) {
    ui.keySecretLabel.textContent =
      'Khóa AES chia sẻ (Base64)';

    ui.keyHelpText.textContent =
      'Hai tài khoản phải dùng cùng Key ID và cùng khóa AES để giải mã được tin nhắn.';
  } else {
    ui.keySecretLabel.textContent =
      'DES key + HMAC key';

    ui.keyHelpText.textContent =
      'Định dạng: 16 ký tự hex DES : 64 ký tự hex HMAC. DES chỉ dùng để học tập/so sánh.';
  }

  ui.keyModal.hidden =
    false;

  ui.keyIdInput.focus();
}

function deleteCurrentKey() {

    if (!state.activeConversation) {
        ui.keyModalError.textContent =
            'Chưa chọn cuộc trò chuyện.';
        return;
    }

    const algorithm =
        ui.algorithmSelect.value;

    const lookupKey =
        conversationKey(algorithm);

    const keyId =
        state.activeKeyByConversation.get(
            lookupKey
        );


    if (!keyId) {
        ui.keyModalError.textContent =
            'Cuộc trò chuyện này chưa có khóa.';
        return;
    }


    const ok = confirm(
        'Xóa khóa hiện tại?\n\n' +
        'Tin nhắn cũ dùng khóa này có thể không giải mã được.'
    );

    if (!ok) return;


    // Xóa khóa khỏi bộ nhớ
    state.activeKeyByConversation.delete(
        lookupKey
    );

    state.runtimeKeys.delete(
        keyId
    );


    // Nếu bản hiện tại có lưu localStorage
    // thì xóa luôn các key liên quan nếu có
    try {

        const conversationId =
            getId(
                state.activeConversation
            );

        const possibleKeys = [
            `securechat:key:${conversationId}:${algorithm}`,
            `secure-chat:key:${conversationId}:${algorithm}`,
            `chat:key:${conversationId}:${algorithm}`,
            `key:${conversationId}:${algorithm}`
        ];

        for (
            const storageKey of possibleKeys
        ) {
            localStorage.removeItem(
                storageKey
            );
        }

    } catch (error) {

        console.warn(
            'Không xóa được localStorage:',
            error
        );
    }


    // Xóa dữ liệu đang hiện trên modal
    ui.keyIdInput.value = '';
    ui.keySecretInput.value = '';

    ui.keyModalError.textContent =
        'Đã xóa khóa. Bây giờ có thể tạo hoặc nhập khóa mới.';


    // Cập nhật trạng thái ngoài thanh chat
    updateKeyStatus();


    console.log(
        '🗑️ Đã xóa key:',
        keyId
    );
}

function closeKeyModal() {
  ui.keyModal.hidden =
    true;
}

// =====================================================
// COMPOSER / AUTH
// =====================================================

function resizeComposer() {
  if (
    !ui.messageInput
  ) {
    return;
  }

  ui.messageInput.style.height =
    'auto';

  ui.messageInput.style.height =
    `${
      Math.min(
        ui.messageInput
          .scrollHeight,
        140
      )
    }px`;
}

async function logout() {
  try {
    if (!DEMO_MODE) {
      await apiRequest(
        '/api/auth/logout',
        {
          method:
            'POST',

          body:
            JSON.stringify(
              {}
            )
        }
      );
    }
  } catch (error) {
    console.warn(
      'Logout API:',
      error.message
    );
  } finally {
    disconnectChatSocket();

    state.runtimeKeys
      .clear();

    state
      .activeKeyByConversation
      .clear();

    window.location.href =
      './index.html';
  }
}

// =====================================================
// EVENTS
// =====================================================
function deleteCurrentConversationKey() {

  const algorithm =
    ui.algorithmSelect.value;

  const record =
    getActiveKeyRecord(
      algorithm
    );

  if (!record) {
    ui.keyModalError.textContent =
      'Hội thoại này chưa có khóa.';
    return;
  }

  const lookupKey =
    conversationKey(
      algorithm
    );

  // Xóa khỏi RAM
  state.runtimeKeys.delete(
    record.keyId
  );

  state
    .activeKeyByConversation
    .delete(
      lookupKey
    );

  // Xóa khỏi localStorage
  const storageName =
    getStoredKeyName(
      algorithm
    );

  if (storageName) {
    localStorage.removeItem(
      storageName
    );
  }

  // Reset giao diện
  ui.keyIdInput.value = '';
  ui.keySecretInput.value = '';

  ui.keyIdInput.readOnly = false;
  ui.keySecretInput.readOnly = false;

  ui.btnGenerateKey.disabled = false;
  ui.btnSaveKey.disabled = false;

  ui.keyModalError.textContent =
    'Đã xóa khóa. Bây giờ có thể tạo khóa mới.';

  updateKeyStatus();

  renderMessages()
    .catch(error => {
      console.error(error);
    });
}

function openPeerInfo() {

  if (!state.activePeer) {
    return;
  }

  ui.peerInfoAvatar.textContent =
    initials(
      state.activePeer
    );

  ui.peerInfoName.textContent =
    displayName(
      state.activePeer
    );

  ui.peerInfoUsername.textContent =
    `@${
      state.activePeer.username ||
      'user'
    }`;

  ui.peerInfoStatus.textContent =
    'Đang hoạt động';

  ui.peerInfoEncryption.textContent =
    ui.algorithmSelect.value;

  ui.peerInfoModal.hidden =
    false;
}


function closePeerInfo() {

  ui.peerInfoModal.hidden =
    true;
}

// =====================================================
// CHUYỂN TRANG MENU TRÁI
// =====================================================

function setRailActive(
  button
) {
  [
    ui.navMessages,
    ui.navFriends,
    ui.navRequests,
    ui.navBlocked
  ]
    .filter(Boolean)
    .forEach(
      item => {
        item.classList.toggle(
          'active',
          item === button
        );
      }
    );
}


function openChatPage() {
  const app =
    document.querySelector(
      '.app-shell'
    );

  app?.classList.remove(
    'feature-mode'
  );


  if (
    ui.featurePage
  ) {
    ui.featurePage.hidden =
      true;
  }


  setRailActive(
    ui.navMessages
  );
}


// =====================================================
// TRANG BẠN BÈ - LOAD DỮ LIỆU THẬT TỪ API
// =====================================================

// =====================================================
// FRIEND PAGE
// =====================================================

async function openFriendsPage() {
  const toolbar =
  document.querySelector(
    '.feature-toolbar'
  );

if (toolbar) {
  toolbar.style.display =
    '';
}

  const app =
    document.querySelector(
      '.app-shell'
    );

  app?.classList.add(
    'feature-mode'
  );

  ui.featurePage.hidden =
    false;

  ui.featureTitle.textContent =
    'Danh sách bạn bè';

  ui.featureDescription.textContent =
    'Tìm người dùng, gửi lời mời và quản lý bạn bè';

  setRailActive(
    ui.navFriends
  );


  // Nếu chưa có danh sách user thì tải lại
  if (
    !Array.isArray(
      state.users
    ) ||
    !state.users.length
  ) {
    try {
      await loadUsers();
    } catch (error) {
      console.error(
        'Load users:',
        error
      );
    }
  }


  // Xóa nội dung search cũ
  ui.featureSearch.value =
    '';


  // Render lần đầu
  await renderFriendSearchPage();


  // Khi gõ tìm kiếm
  ui.featureSearch.oninput =
    async () => {
      await renderFriendSearchPage();
    };
}


// =====================================================
// RENDER TRANG BẠN BÈ + TÌM USER
// =====================================================

async function renderFriendSearchPage() {
  const query =
    ui.featureSearch.value
      .trim()
      .toLowerCase();


  ui.featureContent.innerHTML = `
    <div class="feature-loading">
        Đang tải...
    </div>
  `;


  try {

    // =====================================
    // DANH SÁCH BẠN BÈ HIỆN TẠI
    // =====================================

    const friendBody =
      await apiRequest(
        '/api/friends'
      );


    const friends =
      Array.isArray(
        friendBody?.friends
      )
        ? friendBody.friends
        : [];


    // =====================================
    // NẾU CHƯA NHẬP SEARCH
    // -> HIỆN DANH SÁCH BẠN
    // =====================================

    if (!query) {
      renderFriendList(
        friends
      );

      return;
    }


    // =====================================
    // SEARCH TẤT CẢ USER
    // =====================================

    const myId =
      getId(
        state.me
      );


    const matchedUsers =
      state.users.filter(
        user => {

          const userId =
            getId(user);


          // Không hiện chính mình
          if (
            userId ===
            myId
          ) {
            return false;
          }


          const text =
            `${displayName(user)} ${user.username || ''}`
              .toLowerCase();


          return text.includes(
            query
          );
        }
      );


    // =====================================
    // KHÔNG TÌM THẤY
    // =====================================

    if (
      !matchedUsers.length
    ) {
      ui.featureContent.innerHTML = `
        <div class="feature-empty">

            <div class="feature-empty-icon">
                🔎
            </div>

            <h2>
                Không tìm thấy người dùng
            </h2>

            <p>
                Không có tài khoản nào khớp với
                "${escapeHtml(query)}".
            </p>

        </div>
      `;

      return;
    }


    // =====================================
    // RENDER KẾT QUẢ SEARCH
    // =====================================

    ui.featureContent
      .replaceChildren();


    const list =
      document.createElement(
        'div'
      );


    list.className =
      'feature-user-list';


    for (
      const user
      of matchedUsers
    ) {

      const row =
        document.createElement(
          'div'
        );


      row.className =
        'feature-user';


      // AVATAR
      const avatar =
        document.createElement(
          'div'
        );


      avatar.className =
        'feature-user-avatar';


      avatar.textContent =
        initials(
          user
        );


      // INFO
      const info =
        document.createElement(
          'div'
        );


      info.className =
        'feature-user-info';


      const name =
        document.createElement(
          'strong'
        );


      name.textContent =
        displayName(
          user
        );


      const username =
        document.createElement(
          'span'
        );


      username.textContent =
        `@${user.username || 'user'}`;


      info.append(
        name,
        username
      );


      // ACTION
      const action =
        document.createElement(
          'div'
        );


      action.className =
        'feature-user-actions';


      const userId =
        getId(
          user
        );


      // =================================
      // KIỂM TRA TRẠNG THÁI KẾT BẠN
      // =================================

      let relation = {
        status: 'none',
        direction: null,
        friendshipId: null
      };


      try {

        relation =
          await apiRequest(
            `/api/friends/status/${encodeURIComponent(
              userId
            )}`
          );

      }

      catch (error) {

        console.warn(
          'Friend status:',
          error.message
        );

      }


      // =================================
      // ĐÃ LÀ BẠN
      // =================================

      if (
        relation.status ===
        'accepted'
      ) {

        const badge =
          document.createElement(
            'span'
          );


        badge.className =
          'friend-status is-friend';


        badge.textContent =
          '✓ Bạn bè';


        const chatButton =
          document.createElement(
            'button'
          );


        chatButton.type =
          'button';


        chatButton.className =
          'feature-chat-btn';


        chatButton.textContent =
          'Nhắn tin';


        chatButton.onclick =
          async () => {

            openChatPage();

            await selectPeer(
              user
            );

          };


        action.append(
          badge,
          chatButton
        );

      }


      // =================================
      // MÌNH ĐÃ GỬI LỜI MỜI
      // =================================

      else if (
        relation.status ===
          'pending' &&
        relation.direction ===
          'outgoing'
      ) {

        const badge =
          document.createElement(
            'span'
          );


        badge.className =
          'friend-status pending';


        badge.textContent =
          'Đã gửi lời mời';


        const cancelButton =
          document.createElement(
            'button'
          );


        cancelButton.type =
          'button';


        cancelButton.className =
          'friend-cancel-btn';


        cancelButton.textContent =
          'Hủy';


        cancelButton.onclick =
          async () => {

            try {

              cancelButton.disabled =
                true;


              await apiRequest(
                `/api/friends/${encodeURIComponent(
                  relation.friendshipId
                )}/cancel`,
                {
                  method:
                    'DELETE'
                }
              );


              await renderFriendSearchPage();

            }

            catch (error) {

              alert(
                error.message
              );


              cancelButton.disabled =
                false;

            }

          };


        action.append(
          badge,
          cancelButton
        );

      }


      // =================================
      // NGƯỜI KIA ĐÃ GỬI CHO MÌNH
      // =================================

      else if (
        relation.status ===
          'pending' &&
        relation.direction ===
          'incoming'
      ) {

        const badge =
          document.createElement(
            'span'
          );


        badge.className =
          'friend-status incoming';


        badge.textContent =
          'Đang chờ bạn xác nhận';


        action.appendChild(
          badge
        );

      }


      // =================================
      // CHƯA CÓ QUAN HỆ
      // =================================

      else {

        const addButton =
          document.createElement(
            'button'
          );


        addButton.type =
          'button';


        addButton.className =
          'friend-add-btn';


        addButton.textContent =
          '+ Kết bạn';


        addButton.onclick =
          async () => {

            try {

              addButton.disabled =
                true;


              addButton.textContent =
                'Đang gửi...';


              await apiRequest(
                '/api/friends/request',
                {
                  method:
                    'POST',

                  body:
                    JSON.stringify(
                      {
                        targetUserId:
                          userId
                      }
                    )
                }
              );


              addButton.textContent =
                'Đã gửi';


              await renderFriendSearchPage();

            }

            catch (error) {

              alert(
                error.message
              );


              addButton.disabled =
                false;


              addButton.textContent =
                '+ Kết bạn';

            }

          };


        action.appendChild(
          addButton
        );

      }


      row.append(
        avatar,
        info,
        action
      );


      list.appendChild(
        row
      );

    }


    ui.featureContent
      .appendChild(
        list
      );

  }

  catch (error) {

    console.error(
      'Friend page:',
      error
    );


    ui.featureContent.innerHTML = `
      <div class="feature-empty">

          <div class="feature-empty-icon">
              ⚠
          </div>

          <h2>
              Không tải được dữ liệu
          </h2>

          <p>
              ${escapeHtml(
                error.message
              )}
          </p>

      </div>
    `;

  }
}


// =====================================================
// RENDER DANH SÁCH BẠN BÈ
// =====================================================

function renderFriendList(
  friends
) {
  ui.featureContent
    .replaceChildren();


  if (
    !friends.length
  ) {
    ui.featureContent.innerHTML = `
      <div class="feature-empty">

        <div class="feature-empty-icon">
          👥
        </div>

        <h2>
          Chưa có bạn bè
        </h2>

        <p>
          Nhập tên người dùng vào ô tìm kiếm
          phía trên để gửi lời mời kết bạn.
        </p>

      </div>
    `;

    return;
  }


  const list =
    document.createElement(
      'div'
    );


  list.className =
    'feature-user-list';


  for (
    const item
    of friends
  ) {
    const user =
      item.user;


    if (!user) {
      continue;
    }


    const row =
      document.createElement(
        'div'
      );


    row.className =
      'feature-user';


    const avatar =
      document.createElement(
        'div'
      );


    avatar.className =
      'feature-user-avatar';


    avatar.textContent =
      initials(
        user
      );


    const info =
      document.createElement(
        'div'
      );


    info.className =
      'feature-user-info';


    const name =
      document.createElement(
        'strong'
      );


    name.textContent =
      displayName(
        user
      );


    const username =
      document.createElement(
        'span'
      );


    username.textContent =
      `@${user.username || 'user'}`;


    info.append(
      name,
      username
    );


    const actions =
      document.createElement(
        'div'
      );


    actions.className =
      'feature-user-actions';


    // ==============================
    // NHẮN TIN
    // ==============================

    const chatButton =
      document.createElement(
        'button'
      );


    chatButton.type =
      'button';


    chatButton.className =
      'feature-chat-btn';


    chatButton.textContent =
      'Nhắn tin';


    chatButton.onclick =
      async () => {
        openChatPage();

        await selectPeer(
          user
        );
      };


    // ==============================
    // HỦY KẾT BẠN
    // ==============================

    const removeButton =
      document.createElement(
        'button'
      );


    removeButton.type =
      'button';


    removeButton.className =
      'feature-remove-btn';


    removeButton.textContent =
      'Hủy kết bạn';


    removeButton.onclick =
      async () => {
        const ok =
          confirm(
            `Hủy kết bạn với ${displayName(
              user
            )}?`
          );


        if (!ok) {
          return;
        }


        try {
          removeButton.disabled =
            true;


          await apiRequest(
            `/api/friends/${encodeURIComponent(
              item.friendshipId
            )}`,
            {
              method:
                'DELETE'
            }
          );


          await loadFriends();

          renderUsers();

          await openFriendsPage();
        }

        catch (error) {
          alert(
            error.message
          );


          removeButton.disabled =
            false;
        }
      };


    // ==============================
    // CHẶN
    // ==============================

    const blockButton =
      document.createElement(
        'button'
      );


    blockButton.type =
      'button';


    blockButton.className =
      'feature-block-btn';


    blockButton.textContent =
      'Chặn';


    blockButton.onclick =
      async () => {
        const ok =
          confirm(
            `Chặn ${displayName(
              user
            )}? Hai tài khoản sẽ bị hủy kết bạn.`
          );


        if (!ok) {
          return;
        }


        try {
          blockButton.disabled =
            true;


          await apiRequest(
            '/api/blocks',
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  targetUserId:
                    getId(user)
                })
            }
          );


          await loadFriends();

          renderUsers();

          await openFriendsPage();
        }

        catch (error) {
          alert(
            error.message
          );


          blockButton.disabled =
            false;
        }
      };


    actions.append(
      chatButton,
      removeButton,
      blockButton
    );


    row.append(
      avatar,
      info,
      actions
    );


    list.appendChild(
      row
    );
  }


  ui.featureContent
    .appendChild(
      list
    );
}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(
  value
) {
  return String(
    value ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );
}


// =====================================================
// TRANG LỜI MỜI KẾT BẠN
// =====================================================

async function openRequestsPage() {
  const app =
    document.querySelector(
      '.app-shell'
    );

  app?.classList.add(
    'feature-mode'
  );


  ui.featurePage.hidden =
    false;


  ui.featureTitle.textContent =
    'Lời mời kết bạn';


  ui.featureDescription.textContent =
    'Xem lời mời nhận được và lời mời đã gửi';


  setRailActive(
    ui.navRequests
  );


  // Không cần ô search ở trang này
  const toolbar =
    document.querySelector(
      '.feature-toolbar'
    );

  if (toolbar) {
    toolbar.style.display =
      'none';
  }


  // Loading
  ui.featureContent.innerHTML = `
    <div class="feature-empty">

      <div class="feature-empty-icon">
        ⏳
      </div>

      <h2>
        Đang tải lời mời...
      </h2>

    </div>
  `;


  try {

    // =====================================
    // LOAD 2 LOẠI LỜI MỜI
    // =====================================

    const [
      incomingBody,
      outgoingBody
    ] =
      await Promise.all([
        apiRequest(
          '/api/friends/requests/incoming'
        ),

        apiRequest(
          '/api/friends/requests/outgoing'
        )
      ]);


    const incoming =
      Array.isArray(
        incomingBody?.requests
      )
        ? incomingBody.requests
        : [];


    const outgoing =
      Array.isArray(
        outgoingBody?.requests
      )
        ? outgoingBody.requests
        : [];


    ui.featureContent
      .replaceChildren();


    const wrapper =
      document.createElement(
        'div'
      );


    wrapper.className =
      'request-page';


    // =====================================
    // LỜI MỜI NHẬN ĐƯỢC
    // =====================================

    const incomingSection =
      document.createElement(
        'section'
      );


    incomingSection.className =
      'request-section';


    const incomingTitle =
      document.createElement(
        'h2'
      );


    incomingTitle.textContent =
      `Lời mời nhận được (${incoming.length})`;


    incomingSection.appendChild(
      incomingTitle
    );


    if (!incoming.length) {

      const empty =
        document.createElement(
          'div'
        );


      empty.className =
        'request-empty';


      empty.textContent =
        'Chưa có lời mời kết bạn mới.';


      incomingSection.appendChild(
        empty
      );

    }

    else {

      for (
        const request
        of incoming
      ) {

        const user =
          request.sender;


        const card =
          document.createElement(
            'div'
          );


        card.className =
          'request-card';


        // AVATAR
        const avatar =
          document.createElement(
            'div'
          );


        avatar.className =
          'feature-user-avatar';


        avatar.textContent =
          initials(
            user
          );


        // INFO
        const info =
          document.createElement(
            'div'
          );


        info.className =
          'request-info';


        const name =
          document.createElement(
            'strong'
          );


        name.textContent =
          displayName(
            user
          );


        const username =
          document.createElement(
            'span'
          );


        username.textContent =
          `@${user?.username || 'user'}`;


        info.append(
          name,
          username
        );


        // ACTIONS
        const actions =
          document.createElement(
            'div'
          );


        actions.className =
          'request-actions';


        // CHẤP NHẬN
        const acceptButton =
          document.createElement(
            'button'
          );


        acceptButton.type =
          'button';


        acceptButton.className =
          'request-accept';


        acceptButton.textContent =
          'Chấp nhận';


        acceptButton.onclick =
          async () => {

            try {

              acceptButton.disabled =
                true;


              acceptButton.textContent =
                'Đang xử lý...';


              await apiRequest(
                `/api/friends/${encodeURIComponent(
                  request.friendshipId
                )}/accept`,
                {
                  method:
                    'POST'
                }
              );


              await openRequestsPage();

            }

            catch (error) {

              alert(
                error.message
              );


              acceptButton.disabled =
                false;


              acceptButton.textContent =
                'Chấp nhận';

            }

          };


        // TỪ CHỐI
        const rejectButton =
          document.createElement(
            'button'
          );


        rejectButton.type =
          'button';


        rejectButton.className =
          'request-reject';


        rejectButton.textContent =
          'Từ chối';


        rejectButton.onclick =
          async () => {

            try {

              rejectButton.disabled =
                true;


              await apiRequest(
                `/api/friends/${encodeURIComponent(
                  request.friendshipId
                )}/reject`,
                {
                  method:
                    'POST'
                }
              );


              await openRequestsPage();

            }

            catch (error) {

              alert(
                error.message
              );


              rejectButton.disabled =
                false;

            }

          };


        actions.append(
          acceptButton,
          rejectButton
        );


        card.append(
          avatar,
          info,
          actions
        );


        incomingSection.appendChild(
          card
        );

      }

    }


    // =====================================
    // LỜI MỜI ĐÃ GỬI
    // =====================================

    const outgoingSection =
      document.createElement(
        'section'
      );


    outgoingSection.className =
      'request-section';


    const outgoingTitle =
      document.createElement(
        'h2'
      );


    outgoingTitle.textContent =
      `Đã gửi (${outgoing.length})`;


    outgoingSection.appendChild(
      outgoingTitle
    );


    if (!outgoing.length) {

      const empty =
        document.createElement(
          'div'
        );


      empty.className =
        'request-empty';


      empty.textContent =
        'Bạn chưa gửi lời mời nào.';


      outgoingSection.appendChild(
        empty
      );

    }

    else {

      for (
        const request
        of outgoing
      ) {

        const user =
          request.receiver;


        const card =
          document.createElement(
            'div'
          );


        card.className =
          'request-card';


        const avatar =
          document.createElement(
            'div'
          );


        avatar.className =
          'feature-user-avatar';


        avatar.textContent =
          initials(
            user
          );


        const info =
          document.createElement(
            'div'
          );


        info.className =
          'request-info';


        const name =
          document.createElement(
            'strong'
          );


        name.textContent =
          displayName(
            user
          );


        const username =
          document.createElement(
            'span'
          );


        username.textContent =
          `@${user?.username || 'user'}`;


        info.append(
          name,
          username
        );


        const actions =
          document.createElement(
            'div'
          );


        actions.className =
          'request-actions';


        const waiting =
          document.createElement(
            'span'
          );


        waiting.className =
          'friend-status pending';


        waiting.textContent =
          'Đang chờ';


        const cancelButton =
          document.createElement(
            'button'
          );


        cancelButton.type =
          'button';


        cancelButton.className =
          'request-reject';


        cancelButton.textContent =
          'Hủy lời mời';


        cancelButton.onclick =
          async () => {

            try {

              cancelButton.disabled =
                true;


              await apiRequest(
                `/api/friends/${encodeURIComponent(
                  request.friendshipId
                )}/cancel`,
                {
                  method:
                    'DELETE'
                }
              );


              await openRequestsPage();

            }

            catch (error) {

              alert(
                error.message
              );


              cancelButton.disabled =
                false;

            }

          };


        actions.append(
          waiting,
          cancelButton
        );


        card.append(
          avatar,
          info,
          actions
        );


        outgoingSection.appendChild(
          card
        );

      }

    }


    wrapper.append(
      incomingSection,
      outgoingSection
    );


    ui.featureContent
      .appendChild(
        wrapper
      );

  }

  catch (error) {

    console.error(
      'Load requests:',
      error
    );


    ui.featureContent.innerHTML = `
      <div class="feature-empty">

        <div class="feature-empty-icon">
          ⚠
        </div>

        <h2>
          Không tải được lời mời
        </h2>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>

      </div>
    `;

  }
}

async function openBlockedPage() {
  const app =
    document.querySelector(
      '.app-shell'
    );


  app?.classList.add(
    'feature-mode'
  );


  ui.featurePage.hidden =
    false;


  ui.featureTitle.textContent =
    'Danh sách đã chặn';


  ui.featureDescription.textContent =
    'Quản lý những tài khoản bạn không muốn tương tác';


  setRailActive(
    ui.navBlocked
  );


  const toolbar =
    document.querySelector(
      '.feature-toolbar'
    );


  if (toolbar) {
    toolbar.style.display =
      'none';
  }


  ui.featureContent.innerHTML = `
    <div class="feature-empty">

      <div class="feature-empty-icon">
        ⏳
      </div>

      <h2>
        Đang tải...
      </h2>

    </div>
  `;


  try {
    const body =
      await apiRequest(
        '/api/blocks'
      );


    const blocks =
      Array.isArray(
        body?.blocks
      )
        ? body.blocks
        : [];


    ui.featureContent
      .replaceChildren();


    if (!blocks.length) {
      ui.featureContent.innerHTML = `
        <div class="feature-empty">

          <div class="feature-empty-icon">
            ⊘
          </div>

          <h2>
            Chưa chặn ai
          </h2>

          <p>
            Tài khoản bị chặn sẽ xuất hiện ở đây.
          </p>

        </div>
      `;

      return;
    }


    const list =
      document.createElement(
        'div'
      );


    list.className =
      'feature-user-list';


    for (
      const item
      of blocks
    ) {
      const user =
        item.user;


      if (!user) {
        continue;
      }


      const row =
        document.createElement(
          'div'
        );


      row.className =
        'feature-user';


      const avatar =
        document.createElement(
          'div'
        );


      avatar.className =
        'feature-user-avatar';


      avatar.textContent =
        initials(
          user
        );


      const info =
        document.createElement(
          'div'
        );


      info.className =
        'feature-user-info';


      const name =
        document.createElement(
          'strong'
        );


      name.textContent =
        displayName(
          user
        );


      const username =
        document.createElement(
          'span'
        );


      username.textContent =
        `@${user.username || 'user'}`;


      info.append(
        name,
        username
      );


      const unblock =
        document.createElement(
          'button'
        );


      unblock.type =
        'button';


      unblock.className =
        'feature-chat-btn';


      unblock.textContent =
        'Bỏ chặn';


      unblock.onclick =
        async () => {
          try {
            unblock.disabled =
              true;


            await apiRequest(
              `/api/blocks/${encodeURIComponent(
                getId(user)
              )}`,
              {
                method:
                  'DELETE'
              }
            );


            await openBlockedPage();
          }

          catch (error) {
            alert(
              error.message
            );


            unblock.disabled =
              false;
          }
        };


      row.append(
        avatar,
        info,
        unblock
      );


      list.appendChild(
        row
      );
    }


    ui.featureContent
      .appendChild(
        list
      );
  }

  catch (error) {
    ui.featureContent.innerHTML = `
      <div class="feature-empty">

        <div class="feature-empty-icon">
          ⚠
        </div>

        <h2>
          Không tải được danh sách chặn
        </h2>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>

      </div>
    `;
  }
}

async function openProfilePage() {
  const app =
    document.querySelector(
      '.app-shell'
    );

  app?.classList.add(
    'feature-mode'
  );


  if (!ui.featurePage) {
    return;
  }


  ui.featurePage.hidden =
    false;


  ui.featureTitle.textContent =
    'Hồ sơ cá nhân';


  ui.featureDescription.textContent =
    'Quản lý thông tin tài khoản của bạn';


  setRailActive(
    null
  );


  const toolbar =
    document.querySelector(
      '.feature-toolbar'
    );


  if (toolbar) {
    toolbar.style.display =
      'none';
  }


  ui.featureContent.innerHTML = `
    <div class="feature-empty">

      <div class="feature-empty-icon">
        ⏳
      </div>

      <h2>
        Đang tải hồ sơ...
      </h2>

    </div>
  `;


  try {

    // Dùng auth/me vì route này của m
    // đang hoạt động và nhận session chuẩn.
    const body =
      await apiRequest(
        '/api/auth/me'
      );


    const user =
      body?.user;


    if (!user) {
      throw new Error(
        'Không lấy được thông tin tài khoản.'
      );
    }


    state.me =
      user;


    ui.featureContent.innerHTML = `
      <div class="profile-page">

        <div class="profile-card">

          <div class="profile-big-avatar">
            ${escapeHtml(
              initials(user)
            )}
          </div>

          <div class="profile-main-info">

            <h2>
              ${escapeHtml(
                displayName(user)
              )}
            </h2>

            <p>
              @${escapeHtml(
                user.username || ''
              )}
            </p>

          </div>

        </div>


        <div class="profile-info-card">

          <h2>
            Thông tin cá nhân
          </h2>


          <div class="profile-row">

            <label>
              Tên đăng nhập
            </label>

            <div class="profile-value">
              @${escapeHtml(
                user.username || ''
              )}
            </div>

          </div>


          <div class="profile-row">

            <label>
              Tên hiển thị
            </label>

            <input
              id="profileDisplayName"
              class="profile-input"
              maxlength="50"
              value="${escapeHtml(
                user.displayName ||
                user.username ||
                ''
              )}"
            >

          </div>


          <button
            id="saveProfileButton"
            class="profile-save-btn"
            type="button"
          >
            Lưu thay đổi
          </button>


          <p
            id="profileMessage"
            class="profile-message"
          ></p>

        </div>

      </div>
    `;


    const input =
      document.getElementById(
        'profileDisplayName'
      );


    const saveButton =
      document.getElementById(
        'saveProfileButton'
      );


    const message =
      document.getElementById(
        'profileMessage'
      );


    saveButton.onclick =
      async () => {

        const displayName =
          input.value.trim();


        if (!displayName) {
          message.textContent =
            'Tên hiển thị không được để trống.';

          return;
        }


        try {

          saveButton.disabled =
            true;


          saveButton.textContent =
            'Đang lưu...';


          const result =
            await apiRequest(
              '/api/profile',
              {
                method:
                  'PATCH',

                body:
                  JSON.stringify({
                    displayName
                  })
              }
            );


          state.me = {
            ...state.me,
            ...result.user
          };


          renderMe();


          message.textContent =
            'Đã cập nhật hồ sơ.';


          saveButton.textContent =
            'Đã lưu';

        }

        catch (error) {

          console.error(
            'Save profile:',
            error
          );


          message.textContent =
            error.message;


          saveButton.textContent =
            'Lưu thay đổi';

        }

        finally {

          saveButton.disabled =
            false;

        }

      };

  }

  catch (error) {

    console.error(
      'Open profile:',
      error
    );


    ui.featureContent.innerHTML = `
      <div class="feature-empty">

        <div class="feature-empty-icon">
          ⚠
        </div>

        <h2>
          Không tải được hồ sơ
        </h2>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>

      </div>
    `;

  }
}

function applySavedTheme() {
  const saved =
    localStorage.getItem(
      'secure-chat-theme'
    );


  if (
    saved ===
    'light'
  ) {
    document.body
      .classList
      .add(
        'light-theme'
      );
  }

  else {
    document.body
      .classList
      .remove(
        'light-theme'
      );
  }
}


function toggleTheme() {
  document.body
    .classList
    .toggle(
      'light-theme'
    );


  const light =
    document.body
      .classList
      .contains(
        'light-theme'
      );


  localStorage.setItem(
    'secure-chat-theme',
    light
      ? 'light'
      : 'dark'
  );
}

// =====================================================
// NEW CHAT MODAL
// =====================================================

function getNewChatElements() {
  return {
    modal:
      document.getElementById(
        'newChatModal'
      ),

    backdrop:
      document.getElementById(
        'newChatBackdrop'
      ),

    closeButton:
      document.getElementById(
        'btnCloseNewChat'
      ),

    cancelButton:
      document.getElementById(
        'btnCancelNewChat'
      ),

    search:
      document.getElementById(
        'newChatSearch'
      ),

    content:
      document.getElementById(
        'newChatContent'
      )
  };
}


// =====================================================
// ĐÓNG MODAL
// =====================================================

function closeNewChatModal() {
  const {
    modal,
    search
  } =
    getNewChatElements();


  if (!modal) {
    return;
  }


  modal.hidden =
    true;


  document.body
    .classList
    .remove(
      'modal-open'
    );


  if (search) {
    search.value =
      '';
  }
}


// =====================================================
// RENDER DANH SÁCH BẠN BÈ
// =====================================================

function renderNewChatFriends(
  query = ''
) {
  const {
    content
  } =
    getNewChatElements();


  if (!content) {
    return;
  }


  const keyword =
    String(
      query || ''
    )
      .trim()
      .toLowerCase();


  const friends =
    Array.isArray(
      state.friends
    )
      ? state.friends
      : [];


  const users =
    friends
      .map(
        item =>
          item?.user
      )
      .filter(Boolean);


  const filtered =
    users.filter(
      user => {

        if (!keyword) {
          return true;
        }


        const text =
          `${
            displayName(
              user
            )
          } ${
            user.username ||
            ''
          }`
            .toLowerCase();


        return text.includes(
          keyword
        );
      }
    );


  content
    .replaceChildren();


  // ===================================
  // KHÔNG CÓ BẠN
  // ===================================

  if (!users.length) {

    content.innerHTML = `
      <div class="new-chat-empty">

        <div class="new-chat-empty-icon">
          👥
        </div>

        <strong>
          Chưa có bạn bè
        </strong>

        <span>
          Hãy kết bạn trước khi bắt đầu cuộc trò chuyện.
        </span>

      </div>
    `;

    return;
  }


  // ===================================
  // SEARCH KHÔNG CÓ KẾT QUẢ
  // ===================================

  if (!filtered.length) {

    content.innerHTML = `
      <div class="new-chat-empty">

        <div class="new-chat-empty-icon">
          🔍
        </div>

        <strong>
          Không tìm thấy
        </strong>

        <span>
          Không có bạn bè nào khớp với "${escapeHtml(
            query
          )}".
        </span>

      </div>
    `;

    return;
  }


  // ===================================
  // RENDER USER
  // ===================================

  for (
    const user
    of filtered
  ) {

    const row =
      document.createElement(
        'div'
      );


    row.className =
      'new-chat-user';


    row.setAttribute(
      'role',
      'button'
    );


    row.tabIndex =
      0;


    // AVATAR

    const avatar =
      document.createElement(
        'div'
      );


    avatar.className =
      'new-chat-user-avatar';


    avatar.textContent =
      initials(
        user
      );


    // INFO

    const info =
      document.createElement(
        'div'
      );


    info.className =
      'new-chat-user-info';


    const name =
      document.createElement(
        'strong'
      );


    name.textContent =
      displayName(
        user
      );


    const username =
      document.createElement(
        'span'
      );


    username.textContent =
      `@${
        user.username ||
        'user'
      }`;


    info.append(
      name,
      username
    );


    row.append(
      avatar,
      info
    );


    // ===================================
    // MỞ CHAT
    // ===================================

    const openThisChat =
      async () => {

        try {

          closeNewChatModal();


          openChatPage();


          await selectPeer(
            user
          );

        }

        catch (error) {

          console.error(
            'Open new chat:',
            error
          );


          showNotice(
            error.message,
            'error'
          );

        }

      };


    row.addEventListener(
      'click',
      openThisChat
    );


    row.addEventListener(
      'keydown',
      event => {

        if (
          event.key ===
            'Enter' ||
          event.key ===
            ' '
        ) {

          event.preventDefault();


          openThisChat();

        }

      }
    );


    content.appendChild(
      row
    );
  }
}


// =====================================================
// MỞ MODAL
// =====================================================

async function openNewChatModal() {
  const {
    modal,
    search
  } =
    getNewChatElements();


  if (!modal) {
    return;
  }


  try {

    // Refresh danh sách bạn bè trước
    await loadFriends();


    modal.hidden =
      false;


    document.body
      .classList
      .add(
        'modal-open'
      );


    renderNewChatFriends();


    setTimeout(
      () => {
        search?.focus();
      },
      50
    );

  }

  catch (error) {

    console.error(
      'Load friends for new chat:',
      error
    );


    showNotice(
      error.message,
      'error'
    );

  }
}

function bindEvents() {

  // ============================================================
// EMOJI
// ============================================================

ui.btnEmoji?.addEventListener(
    'click',
    event => {

        event.stopPropagation();

        ui.emojiPicker.hidden =
            !ui.emojiPicker.hidden;
    }
);


// Bấm emoji -> thêm vào ô chat
ui.emojiPicker?.addEventListener(
    'click',
    event => {

        const button =
            event.target.closest(
                '[data-emoji]'
            );

        if (!button) return;


        const emoji =
            button.dataset.emoji;


        const start =
            ui.messageInput.selectionStart ??
            ui.messageInput.value.length;

        const end =
            ui.messageInput.selectionEnd ??
            start;


        const before =
            ui.messageInput.value.slice(
                0,
                start
            );

        const after =
            ui.messageInput.value.slice(
                end
            );


        ui.messageInput.value =
            before +
            emoji +
            after;


        const newPosition =
            start +
            emoji.length;


        ui.messageInput.focus();


        ui.messageInput.setSelectionRange(
            newPosition,
            newPosition
        );


        ui.emojiPicker.hidden =
            true;


        // kích hoạt resize textarea
        ui.messageInput.dispatchEvent(
            new Event(
                'input',
                {
                    bubbles: true
                }
            )
        );
    }
);


// Click ra ngoài thì đóng bảng emoji
document.addEventListener(
    'click',
    event => {

        if (
            !ui.emojiPicker ||
            ui.emojiPicker.hidden
        ) {
            return;
        }


        if (
            event.target.closest(
                '.emoji-wrap'
            )
        ) {
            return;
        }


        ui.emojiPicker.hidden =
            true;
    }
);


  const btnNewChat =
  document.getElementById(
    'btnNewChat'
  );


const {
  modal:
    newChatModal,

  backdrop:
    newChatBackdrop,

  closeButton:
    btnCloseNewChat,

  cancelButton:
    btnCancelNewChat,

  search:
    newChatSearch
} =
  getNewChatElements();


btnNewChat
  ?.addEventListener(
    'click',
    openNewChatModal
  );


btnCloseNewChat
  ?.addEventListener(
    'click',
    closeNewChatModal
  );


btnCancelNewChat
  ?.addEventListener(
    'click',
    closeNewChatModal
  );


newChatBackdrop
  ?.addEventListener(
    'click',
    closeNewChatModal
  );


newChatSearch
  ?.addEventListener(
    'input',
    event => {

      renderNewChatFriends(
        event.target.value
      );

    }
  );


document
  .addEventListener(
    'keydown',
    event => {

      if (
        event.key ===
          'Escape' &&
        newChatModal &&
        !newChatModal.hidden
      ) {

        closeNewChatModal();

      }

    }
  );

  ui.btnProfile
  ?.addEventListener(
    'click',
    openProfilePage
  );

  ui.navRequests
  ?.addEventListener(
    'click',
    openRequestsPage
  );

  ui.keyAlgorithm
  ?.addEventListener(
    'change',
    () => {

      ui.algorithmSelect.value =
        ui.keyAlgorithm.value;

      updateKeyStatus();

      openKeyModal();

      renderMessages()
        .catch(
          error =>
            console.error(
              error
            )
        );
    }
  );  

  ui.btnPeerInfo
  ?.addEventListener(
    'click',
    openPeerInfo
  );


ui.btnClosePeerInfo
  ?.addEventListener(
    'click',
    closePeerInfo
  );


ui.peerInfoModal
  ?.addEventListener(
    'click',
    event => {

      if (
        event.target.matches(
          '[data-close-peer-info]'
        )
      ) {

        closePeerInfo();

      }

    }
  );

    ui.navMessages
  ?.addEventListener(
    'click',
    openChatPage
  );


ui.navFriends
  ?.addEventListener(
    'click',
    openFriendsPage
  );  

  ui.navBlocked?.addEventListener(
    'click',
    () => {
      ui.navBlocked
  ?.addEventListener(
    'click',
    openBlockedPage
  );
    }
  );

  ui.btnProfile?.addEventListener(
    'click',
    () => {
      console.log('Bấm Hồ sơ');
    }
  );

  ui.userSearch
    ?.addEventListener(
      'input',
      renderUsers
    );

  ui.algorithmSelect
  ?.addEventListener(
    'change',
    async () => {

      const algorithm =
        ui.algorithmSelect.value;


      // thử lấy key đã lưu
      await restoreKeyFromStorage(
        algorithm
      );


      updateKeyStatus();


      renderMessages()
        .catch(
          error => {

            console.error(
              error
            );

          }
        );

    }
  );

  ui.btnOpenKey
    ?.addEventListener(
      'click',
      openKeyModal
    );

  ui.btnCloseKey
    ?.addEventListener(
      'click',
      closeKeyModal
    );

  ui.keyModal
    ?.addEventListener(
      'click',
      event => {

        if (
          event.target.matches(
            '[data-close-key-modal]'
          )
        ) {
          closeKeyModal();
        }

      }
    );

  ui.btnGenerateKey
    ?.addEventListener(
      'click',
      () => {

        generateKeyForModal()
          .catch(
            error => {

              ui.keyModalError
                .textContent =
                error.message;

            }
          );

      }
    );

    ui.btnDeleteKey
  ?.addEventListener(
    'click',
    () => {

      const ok =
        confirm(
          'Bạn có chắc muốn xóa khóa của cuộc trò chuyện này? Tin nhắn cũ sẽ không giải mã được nếu mất khóa này.'
        );

      if (!ok) {
        return;
      }

      deleteCurrentConversationKey();
    }
  );

  ui.btnCopyKey
  ?.addEventListener(
    'click',
    async () => {

      const keyId =
        ui.keyIdInput
          .value
          .trim();

      const secret =
        ui.keySecretInput
          .value
          .trim();

      if (
        !keyId ||
        !secret
      ) {

        ui.keyModalError.textContent =
          'Chưa có đầy đủ Key ID và khóa.';

        ui.keyModalError.className =
          'chat-form-error is-error';

        return;
      }

      try {

        await navigator
          .clipboard
          .writeText(
            secret
          );

        ui.keyModalError.textContent =
          'Đã sao chép khóa AES.';

        ui.keyModalError.className =
          'chat-form-error is-success';

      } catch {

        ui.keySecretInput
          .select();

        document
          .execCommand(
            'copy'
          );

        ui.keyModalError.textContent =
          'Đã sao chép khóa AES.';

        ui.keyModalError.className =
          'chat-form-error is-success';
      }

    }
  );

  function deleteCurrentKey() {

    if (!state.activeConversation) {
        ui.keyModalError.textContent =
            'Chưa chọn cuộc trò chuyện.';
        return;
    }

    const algorithm =
        ui.algorithmSelect.value;

    const lookupKey =
        conversationKey(algorithm);

    const keyId =
        state.activeKeyByConversation.get(
            lookupKey
        );


    if (!keyId) {
        ui.keyModalError.textContent =
            'Cuộc trò chuyện này chưa có khóa.';
        return;
    }


    const ok = confirm(
        'Xóa khóa hiện tại?\n\n' +
        'Tin nhắn cũ dùng khóa này có thể không giải mã được.'
    );

    if (!ok) return;


    // Xóa khóa khỏi bộ nhớ
    state.activeKeyByConversation.delete(
        lookupKey
    );

    state.runtimeKeys.delete(
        keyId
    );


    // Nếu bản hiện tại có lưu localStorage
    // thì xóa luôn các key liên quan nếu có
    try {

        const conversationId =
            getId(
                state.activeConversation
            );

        const possibleKeys = [
            `securechat:key:${conversationId}:${algorithm}`,
            `secure-chat:key:${conversationId}:${algorithm}`,
            `chat:key:${conversationId}:${algorithm}`,
            `key:${conversationId}:${algorithm}`
        ];

        for (
            const storageKey of possibleKeys
        ) {
            localStorage.removeItem(
                storageKey
            );
        }

    } catch (error) {

        console.warn(
            'Không xóa được localStorage:',
            error
        );
    }


    // Xóa dữ liệu đang hiện trên modal
    ui.keyIdInput.value = '';
    ui.keySecretInput.value = '';

    ui.keyModalError.textContent =
        'Đã xóa khóa. Bây giờ có thể tạo hoặc nhập khóa mới.';


    // Cập nhật trạng thái ngoài thanh chat
    updateKeyStatus();


    console.log(
        '🗑️ Đã xóa key:',
        keyId
    );
}

  ui.btnSaveKey
    ?.addEventListener(
      'click',
      () => {

        importKeyFromModal()

          .then(
            record => {

              setActiveKeyRecord(
                record
              );

              closeKeyModal();

              showNotice(
                `Đã nạp khóa ${record.keyId} vào bộ nhớ tạm.`,
                'success'
              );

              return renderMessages();
            }
          )

          .catch(
            error => {

              ui.keyModalError
                .textContent =
                error.message;

            }
          );

      }
    );

  ui.messageInput
    ?.addEventListener(
      'input',
      resizeComposer
    );

  ui.messageInput
    ?.addEventListener(
      'keydown',
      event => {

        if (
          event.key ===
            'Enter' &&
          !event.shiftKey
        ) {
          event.preventDefault();

          ui.messageForm
            .requestSubmit();
        }

      }
    );

  ui.messageForm
    ?.addEventListener(
      'submit',
      event => {

        event.preventDefault();

        const plaintext =
          ui.messageInput
            .value
            .trim();

        if (!plaintext) {
          showNotice(
            'Tin nhắn không được để trống.',
            'error'
          );

          return;
        }

        if (
          !state.activeConversation
        ) {
          showNotice(
            'Hãy chọn một người trước khi gửi.',
            'error'
          );

          return;
        }

        if (
          !DEMO_MODE &&
          !isSocketConnected()
        ) {
          showNotice(
            'Socket đang mất kết nối. Bản nháp vẫn được giữ.',
            'error'
          );

          return;
        }

        ui.btnSend.disabled =
          true;

        sendNewMessage(
          plaintext
        )

          .catch(
            error => {

              console.error(
                error
              );

              showNotice(
                `${error.message} Bản nháp vẫn được giữ lại.`,
                'error'
              );

            }
          )

          .finally(
            () => {

              ui.btnSend.disabled =
                false;

              ui.messageInput
                .focus();

            }
          );

      }
    );

  ui.btnLoadMore
    ?.addEventListener(
      'click',
      () => {

        loadHistory()
          .catch(
            error => {

              showNotice(
                error.message,
                'error'
              );

            }
          );

      }
    );

  ui.btnLogout
    ?.addEventListener(
      'click',
      logout
    );
}

// =====================================================
// NEW CHAT - GLOBAL EVENTS
// =====================================================

document.addEventListener(
  'click',
  event => {

    const newChatButton =
      event.target.closest(
        '#btnNewChat'
      );


    if (newChatButton) {

      event.preventDefault();

      event.stopPropagation();

      openNewChatModal();

      return;
    }


    if (
      event.target.closest(
        '#btnCloseNewChat'
      ) ||
      event.target.closest(
        '#btnCancelNewChat'
      ) ||
      event.target.id ===
        'newChatBackdrop'
    ) {

      closeNewChatModal();

    }

  }
);

// =====================================================
// BOOTSTRAP
// =====================================================

async function bootstrap() {
   applySavedTheme();
  bindEvents();

  if (DEMO_MODE) {
    showNotice(
      'Đang chạy chế độ demo dữ liệu giả (?demo=1).',
      'info'
    );
  }

  await loadCurrentUser();

  renderMe();

  await Promise.all([
  loadUsers(),
  loadFriends(),
  loadConversations()
]);

  renderUsers();
  renderActivePeer();

  if (!DEMO_MODE) {
    connectChatSocket(
      {
        onMessage:
          payload => {

            handleIncomingMessage(
              payload
            ).catch(
              error => {

                console.error(
                  error
                );

                showNotice(
                  error.message,
                  'error'
                );

              }
            );

          },

        onConnectionChange:
          connection => {

            updateConnectionUI(
              connection
            );

            if (
              connection.status ===
                'connected' &&
              state.activeConversation
            ) {
              joinConversationSocket(
                getId(
                  state.activeConversation
                )
              )

                .then(
                  () =>
                    loadHistory()
                )

                .catch(
                  error => {

                    console.error(
                      error
                    );

                    showNotice(
                      error.message,
                      'error'
                    );

                  }
                );
            }

          }
      }
    );
  } else {
    updateConnectionUI(
      {
        status:
          'connected'
      }
    );
  }

  updateComposerState();
  updateKeyStatus();

  if (
    ui.btnLoadMore
  ) {
    ui.btnLoadMore.hidden =
      true;
  }
}

bootstrap()
  .catch(
    error => {

      console.error(
        error
      );

      showNotice(
        `Không khởi tạo được trang chat: ${error.message}`,
        'error'
      );

    }
  );