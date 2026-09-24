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
  btnSaveKey: $('#btnSaveKey')
};

// =====================================================
// STATE
// =====================================================

const state = {
  me: null,
  users: [],
  conversations: [],
  activePeer: null,
  activeConversation: null,
  messages: [],

  runtimeKeys: new Map(),
  activeKeyByConversation: new Map(),
  pending: new Map(),

  demoMessagesByConversation: new Map()
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
        credentials: 'include',

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
  } catch {
    body = null;
  }

  if (
    response.status === 401
  ) {
    window.location.href =
      './index.html';

    throw new Error(
      'Phiên đăng nhập đã hết.'
    );
  }

  if (!response.ok) {
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

function renderUsers() {
  if (
    !ui.userList ||
    !ui.userCount ||
    !ui.userSearch
  ) {
    return;
  }

  const query =
    ui.userSearch
      .value
      .trim()
      .toLowerCase();

  const filtered =
    state.users.filter(
      user => {

        if (
          getId(user) ===
          getId(state.me)
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const text =
          `${
            displayName(user)
          } ${
            user.username ||
            ''
          }`
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

  if (
    !filtered.length
  ) {
    const empty =
      document.createElement(
        'div'
      );

    empty.className =
      'chat-list-state';

    empty.textContent =
      query
        ? 'Không tìm thấy người dùng.'
        : 'Chưa có người dùng khác.';

    ui.userList.appendChild(
      empty
    );

    return;
  }

  filtered.forEach(
    user => {

      const peerId =
        getId(user);

      const conversation =
        getConversationForPeer(
          peerId
        );

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

      const avatar =
        document.createElement(
          'div'
        );

      avatar.className =
        'chat-avatar';

      avatar.textContent =
        initials(user);

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
        displayName(user);

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
            conversation
              .updatedAt ||
            conversation
              .lastMessage
              .createdAt
          );
      }

      const preview =
        document.createElement(
          'span'
        );

      preview.className =
        'chat-user-item__preview';

      preview.textContent =
        conversation
          ?.lastMessage
          ? 'Có tin nhắn đã mã hóa'
          : `@${
              user.username ||
              'user'
            }`;

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

      button.addEventListener(
        'click',
        () => {

          selectPeer(
            user
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

async function renderMessages() {
  if (
    !ui.messageList ||
    !ui.messagesPanel
  ) {
    return;
  }

  ui.messageList
    .replaceChildren();

  if (
    !state.activeConversation
  ) {
    setEmptyState(
      'Chưa chọn cuộc trò chuyện',
      'Chọn một người ở bên trái để bắt đầu.'
    );

    return;
  }

  if (
    !state.messages.length
  ) {
    setEmptyState(
      `Bắt đầu chat với ${displayName(
        state.activePeer
      )}`,
      'Tin nhắn sẽ được mã hóa ở trình duyệt trước khi gửi.'
    );

    return;
  }

  hideEmptyState();

  for (
    const message
    of state.messages
  ) {
    const own =
      message.senderId ===
      getId(state.me);

    const plaintext =
      await getMessagePlaintext(
        message
      );

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

    const bubble =
      document.createElement(
        'article'
      );

    bubble.className =
      'chat-message';

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

    const meta =
      document.createElement(
        'div'
      );

    meta.className =
      'chat-message__meta';

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
      } else if (
        message.localStatus ===
        'saved'
      ) {
        status.textContent =
          'Đã lưu';
      } else if (
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
            message
              .clientMessageId
          ).catch(
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

    ui.messageList
      .appendChild(
        row
      );
  }

  ui.messagesPanel.scrollTop =
    ui.messagesPanel.scrollHeight;
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

  const conversation =
    await ensureConversation(
      peer
    );

  state.activeConversation =
  conversation;


// =====================================
// TỰ LOAD KEY CỦA CONVERSATION
// =====================================

// Load cả AES và DES để tin lịch sử
// dùng thuật toán nào cũng giải mã được.

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
    } catch (error) {
      console.warn(
        'Join conversation socket:',
        error.message
      );
    }
  }

  await loadHistory();
}

async function loadHistory() {
  if (
    !state.activeConversation
  ) {
    return;
  }

  let messages = [];

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
  } else {
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

  state.messages =
    mergeMessages(
      [],
      messages
    );

  if (
    ui.btnLoadMore
  ) {
    ui.btnLoadMore.hidden =
      true;
  }

  await renderMessages();
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

function bindEvents() {

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
// BOOTSTRAP
// =====================================================

async function bootstrap() {
  bindEvents();

  if (DEMO_MODE) {
    showNotice(
      'Đang chạy chế độ demo dữ liệu giả (?demo=1).',
      'info'
    );
  }

  await loadCurrentUser();

  renderMe();

  await Promise.all(
    [
      loadUsers(),
      loadConversations()
    ]
  );

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