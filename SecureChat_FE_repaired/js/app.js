import { api, apiGet, apiPost, apiPatch, apiDelete } from './api.js';
import { encryptAESMessage, decryptAESMessage, aesSelfTest } from './crypto/aes.js';
import { encryptDESMessage, decryptDESMessage, desSelfTest } from './crypto/des.js';
import {
  DEMO_PASSPHRASE,
  getConversationPassphrase,
  setConversationPassphrase,
  clearConversationPassphrase,
  clearAllPassphrases
} from './crypto/key-manager.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));

const initials = name =>
  String(name || '?').trim().split(/\s+/).slice(-2)
    .map(x => x[0] || '').join('').toUpperCase() || '?';

const colors = ['', 'avatar-purple', 'avatar-teal', 'avatar-peach', 'avatar-sky'];

const avatarClass = name =>
  colors[(String(name || '').charCodeAt(0) || 0) % colors.length];

const AVATAR_ASSETS = {
  'Alice Nguyễn': 'alice',
  'Bob Trần': 'bob',
  'Nguyễn Thảo': 'thao',
  'Trần Tuấn': 'tuan',
  'Như Quỳnh': 'quynh',
  'Đạt Dev': 'dat',
  'Minh Khoa': 'khoa',
  'Phương Trinh': 'phuong'
};

const DEMO_PREVIEWS = {
  thao: 'Bạn: Cảm ơn nhiều!',
  tuan: 'Được rồi, cảm ơn!',
  quynh: 'Okiiii',
  dat: 'Code xong chưa anh?',
  khoa: 'Tối đi chơi không?',
  phuong: 'Cảm ơn nhé!',
  bob: 'Thử phần DES + HMAC nhé!'
};

function avatarHTML(name, size = 'avatar-md', online = false) {
  const asset = AVATAR_ASSETS[name];
  const classes = `avatar ${size} ${avatarClass(name)}${asset ? ' avatar-photo' : ''}`;
  const face = asset
    ? `<img src="./assets/avatars/${asset}.png" alt="" loading="lazy">`
    : esc(initials(name));

  return `<span class="${classes}">${face}${online ? '<i class="online-dot"></i>' : ''}</span>`;
}

function setAvatarElement(element, name, size = 'avatar-lg', online = false) {
  if (!element) return;

  const asset = AVATAR_ASSETS[name];
  element.className = `avatar ${size} ${avatarClass(name)}${asset ? ' avatar-photo' : ''}`;

  element.innerHTML = `${
    asset
      ? `<img src="./assets/avatars/${asset}.png" alt="" loading="lazy">`
      : esc(initials(name))
  }${online ? '<i class="online-dot"></i>' : ''}`;
}

const timeLabel = value => {
  if (!value) return '';

  const d = new Date(value);
  const today = new Date();

  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const dateLabel = value => {
  const d = new Date(value);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);

  return d.toDateString() === today.toDateString()
    ? 'Hôm nay'
    : d.toDateString() === yesterday.toDateString()
      ? 'Hôm qua'
      : d.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
};

const fmtBytes = n =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;

const ICONS = {
  messages: '<rect x="3" y="4" width="18" height="14" rx="4"/><path d="m8 18-2 3 6-3"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M16 11h6"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
 
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 3.1-.2-.1a1.7 1.7 0 0 0-1.8 0 1.7 1.7 0 0 0-.9 1.5V22h-3.6v-.5a1.7 1.7 0 0 0-.9-1.5 1.7 1.7 0 0 0-1.8 0l-.2.1-1.8-3.1.1-.1a1.7 1.7 0 0 0 0-1.8 1.7 1.7 0 0 0-1.5-.9H5v-3.6h.5a1.7 1.7 0 0 0 1.5-.9 1.7 1.7 0 0 0 0-1.8l-.1-.2 1.8-3.1.2.1a1.7 1.7 0 0 0 1.8 0 1.7 1.7 0 0 0 .9-1.5V3h3.6v.5a1.7 1.7 0 0 0 .9 1.5 1.7 1.7 0 0 0 1.8 0l.2-.1 1.8 3.1-.1.2a1.7 1.7 0 0 0 0 1.8 1.7 1.7 0 0 0 1.5.9h.5v3.6h-.5a1.7 1.7 0 0 0-1.5.9Z"/>',

  logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.2 9.9a16 16 0 0 0 6 6l1.7-1.7a2 2 0 0 1 1.7-.6l2.8.4a2 2 0 0 1 1.6 1.9Z"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  'more-vertical': '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'shield-check': '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  'lock-keyhole': '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/>',
  key: '<circle cx="8" cy="15" r="5"/><path d="m12 12 8-8 2 2-2 2 2 2-3 3-2-2-3 3"/>',
  'key-round': '<circle cx="8" cy="15" r="5"/><path d="m12 12 8-8 2 2-2 2 2 2-3 3-2-2-3 3"/>',
  paperclip: '<path d="m21.4 11.1-8.5 8.5a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5L10.8 17.5a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  x: '<path d="m18 6-12 12M6 6l12 12"/>',
  'user-round': '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  'phone-off': '<path d="m3 3 18 18M10.6 10.6a16 16 0 0 0 2.8 2.8M8.5 5.2a16 16 0 0 0-4.3-.9 2 2 0 0 0-2.1 2v3a2 2 0 0 0 .7 1.5l4.4 3.8M15 16.2l3.1 2.7a2 2 0 0 0 1.5.5 2 2 0 0 0 1.8-2v-2a2 2 0 0 0-1.7-2l-2.5-.4"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6"/>',
  flag: '<path d="M4 22V4M4 4c6-4 10 4 16 0v12c-6 4-10-4-16 0"/>',
  'user-x': '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6M16 16l5 5m0-5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  xcircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6m0-6 6 6"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  'arrow-left': '<path d="M19 12H5m7 7-7-7 7-7"/>'
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS['shield-check']}</svg>`;
}

$$('[data-icon]').forEach(node => {
  node.innerHTML = icon(node.dataset.icon);
});

const state = {
  user: null,
  conversations: [],
  friends: [],
  incoming: [],
  outgoing: [],
  blocks: [],
  notifications: [],
  selected: null,
  messages: [],
  decrypted: new Map(),
  view: 'chats',
  listTab: 'all',
  railCollapsed: false,
  profileOpen: false,
  eventSource: null,
  currentCall: null,
  searchQuery: '',
  demo: false
};
const normalizeText = s =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

// API friend records may identify the other user through different fields.
const friendUserId = friend =>
  friend?.id || friend?.userId || friend?.user?.id || friend?.user?._id || friend?._id || '';

const seenRequests = new Set(
  (() => {
    try { return JSON.parse(localStorage.getItem('securechat.seenRequests') || '[]'); }
    catch { return []; }
  })()
);

function saveSeenRequests() {
  try { localStorage.setItem('securechat.seenRequests', JSON.stringify([...seenRequests])); } catch {}
}

function buildNotifications() {
  return (state.incoming || []).map(f => ({
    id: f.friendshipId,
    type: 'friend:request',
    isRead: seenRequests.has(f.friendshipId),
    createdAt: f.createdAt,
    data: { displayName: f.displayName, friendshipId: f.friendshipId }
  }));
}

function markNotificationsRead() {
  (state.incoming || []).forEach(f => seenRequests.add(f.friendshipId));
  saveSeenRequests();
  state.notifications = buildNotifications();
  updateBadges();
}

let friendPollTimer = null;

async function pollFriends() {
  if (!state.user || state.demo) return;

  try {
    const data = await apiGet('/api/friends');
    const prevIncoming = new Set(state.incoming.map(f => f.friendshipId));

    state.friends = Array.isArray(data?.friends) ? data.friends : [];
    state.incoming = Array.isArray(data?.incoming) ? data.incoming : [];
    state.outgoing = Array.isArray(data?.outgoing) ? data.outgoing : [];
    state.notifications = buildNotifications();

    for (const f of state.incoming) {
      if (!prevIncoming.has(f.friendshipId)) {
        toast(`${f.displayName} đã gửi lời mời kết bạn.`, 'success', 'Lời mời kết bạn');
      }
    }

    updateBadges();
    if (state.view === 'friends') renderFriendsView();
  } catch {}
}

const authPanels = ['Login', 'Register', 'Verify', 'Forgot', 'Reset'];

function toast(message, type = 'success', title = 'SecureChat') {
  const region = $('#toastRegion');
  if (!region) return;

  region.setAttribute('popover', 'manual');

  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.innerHTML = `<span>${type === 'error' ? '!' : '✓'}</span><div><span class="toast-title">${esc(title)}</span><small>${esc(message)}</small></div>`;
  region.append(node);

  try { region.showPopover(); } catch {}

  setTimeout(() => {
    node.remove();
    if (!region.children.length) {
      try { region.hidePopover(); } catch {}
    }
  }, 4200);
}

function showAuthPanel(name) {
  for (const panel of authPanels) {
    const node = $(`#auth${panel}Panel`);
    if (node) node.hidden = panel.toLowerCase() !== name;
  }
}

function setAuthView() {
  disconnectEvents();
  state.user = null;
  $('#appView').hidden = true;
  $('#authView').hidden = false;
  showAuthPanel('login');
}

function setAppView(user, isDemo = false) {
  state.user = user;
  state.demo = Boolean(isDemo || user.id?.startsWith('demo-'));
  $('#authView').hidden = true;
  $('#appView').hidden = false;
  $('#appView').classList.toggle('rail-expanded', !state.railCollapsed);
  setAvatarElement($('#railAvatar'), user.displayName, 'avatar-xl', true);
  $('#railUserName').textContent = user.displayName;
  $('#appView').classList.toggle('profile-open', window.innerWidth > 1020);
  state.profileOpen = window.innerWidth > 1020;
  loadAppData().then(() => connectEvents()).catch(err => toast(err.message, 'error'));
}

function normalizeConversationForUI(raw, fallbackPeerId = '') {
  if (!raw || typeof raw !== 'object') return null;

  const rawId = raw.id || raw._id;
  const participants = Array.isArray(raw.participants) ? raw.participants : [];
  const currentId = String(state.user?.id || state.user?._id || '');
  let peer = raw.peer || null;

  if (!peer) {
    peer = participants.find(p => {
      const pid = String(p?.id || p?._id || p || '');
      return pid && pid !== currentId;
    }) || null;
  }

  const peerId = String(peer?.id || peer?._id || peer || fallbackPeerId || '');
  if (!peer || !peerId || !rawId) return null;

  const friend = state.friends.find(f => {
    const fid = String(f?.userId || f?.user?.id || f?.user?._id || f?.id || f?._id || '');
    return fid === peerId;
  });

  return {
    ...raw,
    id: String(rawId),
    peer: {
      ...(typeof peer === 'object' ? peer : {}),
      id: peerId,
      username: peer?.username || friend?.username || friend?.user?.username || '',
      displayName: peer?.displayName || friend?.displayName || friend?.user?.displayName || peer?.username || friend?.username || 'Người dùng'
    },
    lastMessage: raw.lastMessage || null,
    unreadCount: Number(raw.unreadCount) || 0
  };
}

async function loadAppData() {
  const [conversationData, friendData, notificationData, blockData] =
    await Promise.all([
      apiGet('/api/messages/conversations'),
      apiGet('/api/friends'),
      Promise.resolve({ notifications: [] }),
      apiGet('/api/blocks')
    ]);

  state.conversations = Array.isArray(conversationData?.conversations)
    ? conversationData.conversations
        .map(c => normalizeConversationForUI(c))
        .filter(Boolean)
    : [];
  state.friends = Array.isArray(friendData?.friends) ? friendData.friends : [];
  state.incoming = Array.isArray(friendData?.incoming) ? friendData.incoming : [];
  state.outgoing = Array.isArray(friendData?.outgoing) ? friendData.outgoing : [];
  state.notifications = Array.isArray(notificationData?.notifications)
    ? notificationData.notifications
    : [];
  state.blocks = Array.isArray(blockData?.blocks) ? blockData.blocks : [];

  renderCurrentView();
  updateBadges();

  if (!state.selected && state.conversations.length > 0) {
    await selectConversation(state.conversations[0]);
    return;
  }

  if (state.selected) {
    const updated = state.conversations.find(c => c.id === state.selected.id);
    if (updated) {
      state.selected = updated;
      await loadMessages();
    } else {
      // Keep the active conversation visible if the list endpoint has not caught up yet.
      state.conversations = [state.selected, ...state.conversations];
      renderCurrentView();
      renderChatHeader();
    }
  }
}

/* ============================================================
   NHẬN TIN TỨC THÌ: polling 2,5 giây (đường chính) + SSE (đường nhanh)
   ============================================================ */
// Y hệt cách api.js chọn địa chỉ backend
const API_BASE = (location.port === '3000' || location.port === '')
  ? ''
  : `http://${location.hostname}:3000`;

const POLL_INTERVAL_MS = 2500;
let pollTimer = null;
let polling = false;
let realtime = null;
let conversationsLoaded = false;

// Hội thoại + tin cuối cùng mà khung chat đã tải, để biết khi nào có tin mới cần tải lại
let loadedLast = { convId: null, msgId: null };

const conversationSignature = list =>
  list.map(c => `${c.id}:${c.lastMessage?.id || ''}:${c.unreadCount}`).join('|');

// Hiện popup khi số tin chưa đọc tăng mà bạn chưa đang xem hội thoại đó
function notifyNewMessages(prevList, nextList) {
  if (!conversationsLoaded) return;
  const prev = new Map(prevList.map(c => [c.id, c.unreadCount || 0]));

  for (const c of nextList) {
    const viewing = state.selected?.id === c.id && !document.hidden;
    if ((c.unreadCount || 0) > (prev.get(c.id) || 0) && !viewing) {
      toast(`${c.peer.displayName || c.peer.username} đã gửi tin nhắn mới.`, 'success', 'Tin nhắn mới');
    }
  }
}

// Bản nhẹ của loadAppData: chỉ tải danh sách hội thoại
async function refreshConversationsOnly() {
  const data = await apiGet('/api/messages/conversations');
  const list = (Array.isArray(data?.conversations) ? data.conversations : [])
    .map(c => normalizeConversationForUI(c))
    .filter(Boolean);

  if (state.selected && !list.some(c => c.id === state.selected.id)) {
    list.unshift(state.selected);
  }

  const before = conversationSignature(state.conversations);
  notifyNewMessages(state.conversations, list);
  state.conversations = list;

  if (state.selected) {
    const updated = list.find(c => c.id === state.selected.id);
    if (updated) state.selected = updated;
  }

  // Chỉ vẽ lại khi có thay đổi, tránh nháy giao diện
  if (conversationSignature(list) !== before) {
    if (state.view === 'chats') renderConversations();
    updateBadges();
  }
}

async function pollData() {
  if (!state.user || state.demo || polling) return;
  polling = true;

  try {
    await refreshConversationsOnly();

    // Có tin mới trong hội thoại đang mở thì tải lại ngay.
    // Tab đang ẩn thì chờ đến khi quay lại, để tin không bị đánh dấu "đã đọc" khi chưa ai xem.
    if (state.selected && !document.hidden) {
      const nowLast = state.selected.lastMessage?.id || null;
      if (loadedLast.convId !== state.selected.id || loadedLast.msgId !== nowLast) {
        await loadMessages();
      }
    }
  } catch (error) {
    if (error.status === 401) {
      toast('Phiên đăng nhập đã hết hạn.', 'error');
      setAuthView();
    }
  } finally {
    polling = false;
  }
}

async function handleRealtimeMessage({ conversationId }) {
  console.log('[realtime] có tin mới', conversationId);
  try {
    await refreshConversationsOnly();
    if (state.selected?.id === String(conversationId) && !document.hidden) {
      await loadMessages();
    }
  } catch (error) {
    if (error.status === 401) setAuthView();
  }
}

// Người kia đã đọc tin của mình: đổi ✓ thành ✓✓ ngay
function handleRealtimeRead({ conversationId, readAt }) {
  if (state.selected?.id !== String(conversationId)) return;

  let changed = false;
  for (const m of state.messages) {
    if (m.senderId === state.user.id && !m.readAt) {
      m.readAt = readAt || new Date().toISOString();
      changed = true;
    }
  }
  if (changed) renderMessages();
}

// SSE chỉ làm tin đến nhanh hơn. Nếu nạp lỗi thì polling vẫn lo việc nhận tin.
async function startRealtime() {
  if (state.demo || realtime) return;

  try {
    const { connectRealtime } = await import('./realtime-client.js');
    if (realtime || !state.user) return;

    realtime = connectRealtime(API_BASE, {
      onOpen() { console.log('[realtime] SSE đã kết nối'); },
      onFallback() { console.warn('[realtime] SSE lỗi, vẫn nhận tin bằng polling'); },
      onMessage: handleRealtimeMessage,
      onRead: handleRealtimeRead
    });
  } catch (error) {
    console.warn('[realtime] không nạp được js/realtime-client.js, chỉ dùng polling:', error);
  }
}

function connectEvents() {
  disconnectEvents();
  conversationsLoaded = true;
  friendPollTimer = setInterval(pollFriends, 8000);
  pollTimer = setInterval(pollData, POLL_INTERVAL_MS);
  startRealtime();
}

function disconnectEvents() {
  clearInterval(friendPollTimer);
  clearInterval(pollTimer);
  friendPollTimer = null;
  pollTimer = null;
  realtime?.close();
  realtime = null;
  conversationsLoaded = false;
  loadedLast = { convId: null, msgId: null };
}

function updateBadges() {
  const conversations = Array.isArray(state.conversations) ? state.conversations : [];
  const incoming = Array.isArray(state.incoming) ? state.incoming : [];
  const notifications = Array.isArray(state.notifications) ? state.notifications : [];

  const unread = conversations.reduce(
    (total, conversation) => total + (Number(conversation?.unreadCount) || 0),
    0
  );

  setBadge('#unreadBadge', unread);
  setBadge('#requestBadge', incoming.length);
  setBadge('#notificationBadge', notifications.filter(n => !n?.isRead).length);
}

function setBadge(selector, count) {
  const el = $(selector);
  if (!el) return;

  el.hidden = !count;
  el.textContent = count > 99 ? '99+' : String(count);
}

function renderCurrentView() {
  if (state.view === 'chats') renderConversations();
  else if (state.view === 'friends') renderFriendsView();
  else if (state.view === 'blocked') renderBlocksView();
}

function renderConversations() {
  const content = $('#listContent');
  const search = $('#conversationSearch');
  if (!content || !search) return;

  const query = search.value.trim().toLowerCase();
  // Bỏ qua dữ liệu cuộc trò chuyện không có peer để tránh lỗi
  // "Cannot read properties of undefined (reading 'displayName')".
  let rows = state.conversations.filter(c =>
    c?.peer &&
    `${c.peer.displayName ?? ''} ${c.peer.username ?? ''}`.toLowerCase().includes(query)
  );

  if (state.listTab === 'unread') rows = rows.filter(c => c.unreadCount > 0);
  if (state.listTab === 'friends') {
    rows = rows.filter(c =>
      c?.peer?.id &&
      state.friends.some(f => f?.id && f.id === c.peer.id)
    );
  }

  $('#listTitle').textContent = 'Trò chuyện';
  $('#listTabs').hidden = false;
  $('#listTabs').querySelectorAll('button').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === state.listTab);
  });

  if (!rows.length) {
    content.innerHTML = `<div class="empty-list">
      <div class="welcome-illustration" style="margin:0 auto 15px;width:54px;height:54px">${icon('messages')}</div>
      <b>${query ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện'}</b>
      <p>${query ? 'Thử từ khóa khác.' : 'Thêm bạn bè để bắt đầu nhắn tin an toàn.'}</p>
      <button class="btn btn-outline" data-action="open-add-friend">Thêm bạn</button>
    </div>`;
    return;
  }

  content.innerHTML = rows.filter(c => c?.id && c?.peer?.id).map(c => `<button class="conversation-item ${state.selected?.id === c.id ? 'active' : ''}" data-conversation-id="${esc(c.id)}">
    ${avatarHTML(c.peer.displayName || c.peer.username || '?', 'avatar-md', String(c.peer.id).startsWith('demo-'))}
    <span class="conversation-copy">
      <span class="conversation-top">
        <span class="conversation-name">${esc(c.peer.displayName || c.peer.username || '?')}</span>
        <span class="conversation-time">${esc(timeLabel(c.lastMessage?.createdAt || c.createdAt))}</span>
      </span>
      <span class="conversation-preview">${
        state.demo && DEMO_PREVIEWS[c.peer.username]
          ? esc(DEMO_PREVIEWS[c.peer.username])
          : c.lastMessage
            ? `${c.lastMessage.senderId === state.user.id ? 'Bạn: ' : ''}${esc(c.lastMessage.algorithm === 'AES-GCM' ? '🔒 Tin nhắn AES-GCM' : '🔒 Tin nhắn DES + HMAC')}`
            : 'Bắt đầu cuộc trò chuyện an toàn'
      }</span>
    </span>
    ${c.unreadCount ? `<span class="unread-count">${c.unreadCount}</span>` : ''}
  </button>`).join('');
}

function renderFriendsView() {
  const content = $('#listContent');
  $('#listTitle').textContent = 'Bạn bè';
  $('#listTabs').hidden = true;

  let html = '';

  if (state.incoming.length) {
    html += `<div class="eyebrow" style="padding:10px 4px">LỜI MỜI ĐANG CHỜ (${state.incoming.length})</div>`;
    html += state.incoming.map(f => `
      <div class="person-card">
        ${avatarHTML(f.displayName, 'avatar-md', false)}
        <div class="person-copy"><b>${esc(f.displayName)}</b><small>@${esc(f.username)}</small></div>
        <button class="icon-button" data-action="accept-friend" data-id="${esc(f.friendshipId)}" title="Chấp nhận">${icon('check')}</button>
        <button class="icon-button" data-action="reject-friend" data-id="${esc(f.friendshipId)}" title="Từ chối">${icon('x')}</button>
      </div>`).join('');
  }

  html += `<div class="eyebrow" style="padding:16px 4px 10px">DANH SÁCH BẠN BÈ (${state.friends.length})</div>`;
  const usableFriends = state.friends.filter(f => friendUserId(f));
  html += usableFriends.length
    ? usableFriends.map(f => {
      const peerId = friendUserId(f);
      const displayName = f.displayName || f.user?.displayName || f.username || f.user?.username || '?';
      const username = f.username || f.user?.username || '';
      return `
      <button class="conversation-item" data-peer-id="${esc(peerId)}">
        ${avatarHTML(displayName, 'avatar-md', false)}
        <span class="conversation-copy">
          <span class="conversation-top"><span class="conversation-name">${esc(displayName)}</span></span>
          <span class="conversation-preview">@${esc(username)}</span>
        </span>
      </button>`;
    }).join('')
    : '<div class="empty-list">Chưa có bạn bè có mã tài khoản hợp lệ. Hãy tải lại dữ liệu hoặc kiểm tra API /api/friends.</div>';

  content.innerHTML = html;
}

function renderBlocksView() {
  const content = $('#listContent');
  $('#listTitle').textContent = 'Người bị chặn';
  $('#listTabs').hidden = true;

  content.innerHTML = state.blocks.length
    ? state.blocks.map(b => `
      <div class="block-row">
        ${avatarHTML(b.user.displayName, 'avatar-md', false)}
        <div><b>${esc(b.user.displayName)}</b><small>@${esc(b.user.username)}</small></div>
        <button class="btn btn-outline" data-action="unblock-user" data-id="${esc(b.user.id)}">Bỏ chặn</button>
      </div>`).join('')
    : '<div class="empty-list">Danh sách chặn đang trống.</div>';
}

function renderChatHeader() {
  const c = state.selected;

  const peer = c?.peer;
  $('#chatPeerName').textContent = peer?.displayName || 'Chọn một cuộc trò chuyện';
  setAvatarElement($('#chatPeerAvatar'), peer?.displayName || '?', 'avatar-lg', Boolean(peer));

  $('#chatPeerStatus').innerHTML = peer
    ? `<span class="status-dot"></span> ${String(peer.id || '').startsWith('demo-') ? 'Đang online' : 'Đã kết nối'}`
    : '<span class="status-dot"></span> Sẵn sàng kết nối';

  $('#messageInput').disabled = !c;
  $('#messageInput').placeholder = c
    ? 'Nhập tin nhắn… (Enter để gửi)'
    : 'Chọn một cuộc trò chuyện để gửi tin nhắn';

  $('#sendButton')?.toggleAttribute('disabled', !c);

  const submitButton = $('#messageForm button[type="submit"]');
  if (submitButton) submitButton.disabled = !c;

  $('#algorithmSelect').disabled = !c;

  $('#encryptionStatus').textContent = c
    ? 'Tin nhắn được mã hóa trên trình duyệt trước khi gửi.'
    : 'Chọn cuộc trò chuyện để bắt đầu mã hóa.';

  const key = c ? getConversationPassphrase(c.id) : '';
  $('#keyStatus').textContent = key ? 'Khóa hội thoại đã sẵn sàng' : 'Chưa đặt khóa';

  renderProfile();
}

function renderProfile() {
  const pane = $('#profileContent');
  const c = state.selected;

  if (!c) {
    pane.innerHTML = `<div class="profile-empty">${icon('user-round')}<p>Chọn một cuộc trò chuyện để xem hồ sơ.</p></div>`;
    return;
  }

  const peer = c.peer;
  const friend = state.friends.some(f => f.id === peer.id);

  pane.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar-wrap">${avatarHTML(peer.displayName, '', false)}<i class="online-dot"></i></div>
      <h2>${esc(peer.displayName)}</h2>
      <div class="profile-username">@${esc(peer.username)}</div>
    </div>
    <div class="profile-actions">
      <button class="btn btn-primary" data-action="profile-message">${icon('messages')} Nhắn tin</button>
      <button class="btn btn-outline" data-action="unfriend" ${!friend ? 'disabled' : ''}>${icon('user-x')} Hủy kết bạn</button>
    </div>
    <section class="profile-section">
      <h3>Thông tin cá nhân</h3>
      <div class="info-card">
        <div class="info-row"><span class="info-icon">${icon('user-round')}</span><span class="info-label">Username</span><span class="info-value">@${esc(peer.username)}</span></div>
        <div class="info-row"><span class="info-icon">${icon('mail')}</span><span class="info-label">Email</span><span class="info-value">${esc(peer.email || 'Ẩn')}</span></div>
        <div class="info-row"><span class="info-icon">${icon('calendar')}</span><span class="info-label">Tham gia</span><span class="info-value">${esc(peer.createdAt ? new Date(peer.createdAt).toLocaleDateString('vi-VN') : '—')}</span></div>
        <div class="info-row"><span class="info-icon">${icon('file-text')}</span><span class="info-label">Giới thiệu</span><span class="info-value">${esc(peer.bio || 'Chưa cập nhật')}</span></div>
      </div>
    </section>
    <section class="profile-section">
      <h3>Hành động khác</h3>
      <div class="action-list">
        <button class="action-row" data-action="view-avatar">${icon('image')} Xem ảnh đại diện</button>
        <button class="action-row danger" data-action="block-user" data-id="${esc(peer.id)}">${icon('ban')} Chặn tin nhắn</button>
        <button class="action-row warning" data-action="report-user" data-id="${esc(peer.id)}">${icon('flag')} Báo cáo người dùng</button>
        <button class="action-row danger" data-action="delete-conversation">${icon('trash')} Xóa cuộc trò chuyện</button>
      </div>
    </section>`;
}

function renderMessages() {
  const root = $('#messages');

  if (!state.selected) {
    root.innerHTML = `
      <div class="welcome-state">
        <div class="welcome-illustration">${icon('shield-check')}</div>
        <h2>Cuộc trò chuyện riêng tư</h2>
        <p>Chọn một người bạn ở danh sách bên trái để bắt đầu. Nội dung tin nhắn được mã hóa ngay trên trình duyệt.</p>
        <button class="btn btn-primary" data-action="open-add-friend">Tìm bạn để trò chuyện</button>
      </div>`;
    return;
  }

  if (!state.messages.length) {
    root.innerHTML = `
      <div class="welcome-state">
        <div class="welcome-illustration">${icon('lock-keyhole')}</div>
        <h2>Chào ${esc(state.user.displayName)}!</h2>
        <p>Đây là cuộc trò chuyện mã hóa đầu-cuối theo khóa bạn chọn. Hãy thiết lập khóa rồi gửi tin nhắn đầu tiên.</p>
        <button class="btn btn-primary" data-action="manage-key">${icon('key-round')} Thiết lập khóa hội thoại</button>
      </div>`;
    return;
  }

  const query = $('#messageSearchInput').value.trim().toLowerCase();
  let lastDate = '';

  const visible = state.messages.filter(m =>
    !query || (state.decrypted.get(m.id) || '').toLowerCase().includes(query)
  );

  let html = '';

  for (const m of visible) {
    const date = dateLabel(m.createdAt);

    if (date !== lastDate) {
      html += `<div class="date-chip">${esc(date)}</div>`;
      lastDate = date;
    }

    const mine = m.senderId === state.user.id;
    const plaintext = state.decrypted.get(m.id);
    let content = '';

    if (plaintext === undefined) {
      content = '<div class="message-bubble">🔒 Đang giải mã…</div>';
    } else if (plaintext.startsWith('!NO_KEY!')) {
      content = `
        <div class="message-bubble">
          🔒 Tin nhắn đã mã hóa<br>
          <small>Thiết lập khóa hội thoại để đọc.</small><br>
          <button class="text-button" data-action="manage-key">Nhập khóa</button>
        </div>`;
    } else if (plaintext.startsWith('!DECRYPT_ERROR!')) {
      content = `
        <div class="message-bubble">
          🔒 Không giải mã được<br>
          <small>Kiểm tra khóa hội thoại hoặc thuật toán.</small>
        </div>`;
    } else {
      let payload;

      try {
        payload = JSON.parse(plaintext);
      } catch {
        // Tin nhắn văn bản thuần đã giải mã thành công.
      }

      if (payload?.type === 'file' && payload.data) {
        content = `
          <div class="message-bubble">
            <div class="file-bubble">
              <span class="file-icon">${icon('file-text')}</span>
              <span class="file-copy">
                <b>${esc(payload.name)}</b>
                <small>${esc(payload.mime || 'Tệp')} · ${esc(fmtBytes(payload.size || 0))}</small>
                <a href="data:${esc(payload.mime || 'application/octet-stream')};base64,${payload.data}" download="${esc(payload.name)}">Tải tệp xuống</a>
              </span>
            </div>
          </div>`;
      } else {
        const text = payload?.type === 'text' ? payload.text : plaintext;
        content = `<div class="message-bubble">${esc(text)}</div>`;
      }
    }

    html += `
      <article class="message-row ${mine ? 'mine' : ''}" data-message-id="${esc(m.id)}">
        ${content}
        <div class="message-meta">
          <span>${esc(timeLabel(m.createdAt))}</span>
          <span class="message-algorithm">${icon('lock-keyhole')}${m.algorithm === 'AES-GCM' ? 'AES-GCM' : 'DES + HMAC'}</span>
          ${mine ? `<span class="message-state">${m.readAt ? '✓✓' : '✓'}</span>` : ''}
        </div>
      </article>`;
  }

  root.innerHTML = html || '<div class="empty-list">Không tìm thấy tin nhắn khớp từ khóa.</div>';
  root.scrollTop = root.scrollHeight;
}

async function loadMessages() {
  const target = state.selected;
  if (!target) return;

  const data = await apiGet(`/api/messages/${encodeURIComponent(target.id)}`);

  // Bạn đã chuyển sang hội thoại khác trong lúc chờ API thì bỏ kết quả này
  if (state.selected?.id !== target.id) return;

  state.messages = Array.isArray(data?.messages) ? data.messages : [];
  state.decrypted.clear();

  const passphrase = getConversationPassphrase(target.id);

  if (passphrase) {
    await Promise.all(state.messages.map(async m => {
      try {
        const text = m.algorithm === 'AES-GCM'
          ? await decryptAESMessage(m.envelope, passphrase, target.id)
          : await decryptDESMessage(m.envelope, passphrase, target.id);

        state.decrypted.set(m.id, text);
      } catch {
        state.decrypted.set(m.id, '!DECRYPT_ERROR!');
      }
    }));
  } else {
    for (const m of state.messages) {
      state.decrypted.set(m.id, '!NO_KEY!');
    }
  }

  if (state.selected?.id !== target.id) return;

  // Server đã đánh dấu "đã đọc" khi trả tin nhắn, nên xóa số chưa đọc trên máy mình ngay
  state.selected.unreadCount = 0;
  const row = state.conversations.find(c => c.id === target.id);
  if (row) row.unreadCount = 0;
  loadedLast = { convId: target.id, msgId: state.selected.lastMessage?.id || null };

  updateBadges();
  renderCurrentView();
  renderMessages();
  renderChatHeader();
}

async function selectConversation(conversation) {
  const normalized = normalizeConversationForUI(conversation) || conversation;
  if (!normalized?.id || !normalized?.peer?.id) {
    throw new Error('Dữ liệu cuộc trò chuyện thiếu ID hoặc thông tin người nhận.');
  }

  state.selected = normalized;
  state.view = 'chats';
  state.listTab = 'all';
  $$('.rail-button[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === 'chats');
  });

  $('#appView').classList.add('mobile-chat');
  renderCurrentView();
  renderChatHeader();

  if (state.demo && !getConversationPassphrase(conversation.id)) {
    setConversationPassphrase(conversation.id, DEMO_PASSPHRASE);
  }

  try {
    await loadMessages();
    await loadAppData();
  } catch (error) {
    toast(error.message, 'error');
  }

  if (window.innerWidth <= 760) {
    $('#appView').classList.add('mobile-chat');
  }
}

async function selectPeer(peerId) {
  const targetId = String(peerId || '');
  if (!targetId || targetId === 'undefined' || targetId === 'null') {
    throw new Error('Không lấy được ID tài khoản bạn bè. Cần kiểm tra dữ liệu API /api/friends.');
  }

  // Switch to the chat view immediately so the navigation does not remain on Friends.
  state.view = 'chats';
  state.listTab = 'all';
  $$('.rail-button[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === 'chats');
  });
  $('#listTitle').textContent = 'Trò chuyện';
  $('#listTabs').hidden = false;

  let conversation = state.conversations.find(c => String(c?.peer?.id || '') === targetId);

  if (!conversation) {
    const result = await apiPost('/api/messages/conversation', { targetUserId: targetId });
    const raw = result?.conversation;
    const friend = state.friends.find(f =>
      String(f?.userId || f?.user?.id || f?.user?._id || f?.id || f?._id || '') === targetId
    );
    const normalizedRaw = raw && !raw.peer && Array.isArray(raw.participants)
      ? {
          ...raw,
          peer: raw.participants.find(p =>
            String(p?.id || p?._id || p || '') !== String(state.user?.id || state.user?._id || '')
          )
        }
      : raw;

    conversation = normalizeConversationForUI(normalizedRaw, targetId);

    // Some backends return only a conversation ID. Use the selected friend for the peer display.
    if (!conversation && raw && (raw.id || raw._id)) {
      const peer = friend || {};
      conversation = {
        ...raw,
        id: String(raw.id || raw._id),
        peer: {
          id: targetId,
          username: peer.username || peer.user?.username || '',
          displayName: peer.displayName || peer.user?.displayName || peer.username || 'Người dùng'
        },
        lastMessage: raw.lastMessage || null,
        unreadCount: Number(raw.unreadCount) || 0
      };
    }

    if (!conversation?.id || !conversation?.peer?.id) {
      throw new Error('API tạo cuộc trò chuyện chưa trả về ID hội thoại hợp lệ. Kiểm tra message.controller.js và khởi động lại backend.');
    }

    state.conversations = [
      conversation,
      ...state.conversations.filter(c => String(c.id) !== String(conversation.id))
    ];
  }

  await selectConversation(conversation);
}

function switchView(view) {
  state.view = view;

  $$('.rail-button[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
  });

  if (view === 'chats') {
    state.listTab = 'all';
    renderConversations();
  } else if (view === 'friends') {
    renderFriendsView();
  } else if (view === 'blocked') {
    renderBlocksView();
  }

  $('#listPane').classList.remove('hidden');
}

function openDialog(title, body, footer = '', eyebrow = 'SECURECHAT') {
  $('#dialogTitle').textContent = title;
  $('#dialogEyebrow').textContent = eyebrow;
  $('#dialogBody').innerHTML = body;
  $('#dialogFooter').innerHTML = footer;
  $('#appDialog').showModal();

  $$('[data-icon]', $('#dialogBody')).forEach(n => n.innerHTML = icon(n.dataset.icon));
  $$('[data-icon]', $('#dialogFooter')).forEach(n => n.innerHTML = icon(n.dataset.icon));
}

function closeDialog() {
  $('#appDialog').close();
}

function closeProfile() {
  state.profileOpen = false;
  $('#appView').classList.remove('profile-open');
}

function toggleProfile() {
  const app = $('#appView');
  const open = !app.classList.contains('profile-open');

  app.classList.toggle('profile-open', open);
  state.profileOpen = open;
}

function openAddFriend() {
  openDialog(
    'Tìm và thêm bạn',
    `<p>Tìm bằng username hoặc tên hiển thị. Hai bên cần chấp nhận lời mời để bắt đầu chat.</p>
     <form id="friendSearchForm" class="form-stack">
       <label>Username hoặc tên<input id="friendSearchInput" autocomplete="off" placeholder="vd: bob" required></label>
       <button class="btn btn-primary" type="submit">Tìm người dùng</button>
     </form>
     <div id="friendSearchResults" class="result-list"></div>`,
    '<button class="btn btn-outline" type="button" data-action="close-dialog">Đóng</button>',
    'KẾT NỐI BẠN BÈ'
  );

  setTimeout(() => $('#friendSearchInput')?.focus(), 50);
}

async function searchFriends(query) {
  const results = $('#friendSearchResults');
  if (!results) return;

  const q = normalizeText(query);
  results.innerHTML = '<div class="loading-state"><span class="spinner"></span> Đang tìm…</div>';

  try {
    const data = await apiGet(`/api/users?q=${encodeURIComponent(query)}`);

    const users = (Array.isArray(data?.users) ? data.users : [])
      .map(u => ({ ...u, id: u.id || u._id }))
      .filter(u => u.id && u.id !== state.user.id)
      .filter(u =>
        normalizeText(u.username).includes(q) ||
        normalizeText(u.displayName).includes(q)
      );

    results.innerHTML = users.length
      ? users.map(u => {
          const isFriend = state.friends.some(f => f.id === u.id);
          const isPending = state.outgoing.some(f => f.id === u.id);
          const incoming = state.incoming.find(f => f.id === u.id);

          let label = 'Kết bạn';
          let attrs = `data-action="add-friend" data-id="${esc(u.id)}"`;

          if (isFriend) {
            label = 'Đã là bạn';
            attrs = 'disabled';
          } else if (isPending) {
            label = 'Đã gửi lời mời';
            attrs = 'disabled';
          } else if (incoming) {
            label = 'Chấp nhận';
            attrs = `data-action="accept-friend" data-id="${esc(incoming.friendshipId)}"`;
          }

          return `
            <div class="result-item">
              ${avatarHTML(u.displayName, 'avatar-md', false)}
              <span class="result-copy"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></span>
              <button class="btn btn-outline" ${attrs}>${label}</button>
            </div>`;
        }).join('')
      : '<div class="empty-list">Không tìm thấy tài khoản phù hợp.</div>';
  } catch (error) {
    results.textContent = error.message;
  }
}

function openNotifications() {
  const list = state.notifications;

  const html = list.length
    ? list.map(n => `
      <div class="notification-item ${n.isRead ? 'read' : ''}">
        <span class="notification-dot"></span>
        <div class="notification-copy">
          ${esc(notificationText(n))}
          <small>${esc(timeLabel(n.createdAt))}</small>
          ${n.type === 'friend:request' ? `
            <div class="request-actions" style="margin-top:8px">
              <button class="btn btn-primary" data-action="accept-friend" data-id="${esc(n.data?.friendshipId)}">Chấp nhận</button>
              <button class="btn btn-outline" data-action="reject-friend" data-id="${esc(n.data?.friendshipId)}">Từ chối</button>
            </div>` : ''}
        </div>
      </div>`).join('')
    : '<div class="empty-list">Bạn chưa có thông báo nào.</div>';

  openDialog(
    'Thông báo',
    `<div>${html}</div>`,
    '<button class="btn btn-outline" data-action="mark-notifications-read">Đánh dấu đã đọc</button><button class="btn btn-primary" data-action="close-dialog">Đóng</button>',
    'TRUNG TÂM THÔNG BÁO'
  );

    markNotificationsRead();
}

function notificationText(n) {
  const name = n.data?.displayName || 'Một người dùng';

  if (n.type === 'friend:request') return `${name} đã gửi lời mời kết bạn.`;
  if (n.type === 'friend:accepted') return `${name} đã chấp nhận lời mời kết bạn.`;
  if (n.type === 'message:new') return `${name} đã gửi tin nhắn mới.`;
  if (n.type === 'friend:rejected') return `${name} đã từ chối lời mời kết bạn.`;

  return 'Có hoạt động mới trong SecureChat.';
}

function openSettings(section = 'account') {
  const tabs = [
    ['account', 'user-round', 'Tài khoản'],
    ['privacy', 'shield-check', 'Quyền riêng tư'],
    ['notifications', 'bell', 'Thông báo'],
    ['security', 'lock-keyhole', 'Bảo mật']
  ];
  const active = tabs.some(([key]) => key === section) ? section : 'account';
  const prefs = (() => {
    try { return JSON.parse(localStorage.getItem('securechat.settings') || '{}'); }
    catch { return {}; }
  })();
  const checked = (key, fallback = false) => (prefs[key] ?? fallback) ? 'checked' : '';
  const content = {
    account: `<form id="settingsForm" class="settings-form form-stack">
      <div class="settings-avatar-row">
        <span id="settingsAvatarPreview" class="avatar avatar-xl">${esc(initials(state.user.displayName))}</span>
        <div><b>Ảnh đại diện</b><p>Chọn ảnh để xem trước trên thiết bị này.</p>
          <label class="btn btn-outline settings-file-label">Chọn ảnh<input id="settingsAvatarFile" type="file" accept="image/*" hidden></label>
        </div>
      </div>
      <label>Tên hiển thị<input name="displayName" required maxlength="50" value="${esc(state.user.displayName)}"></label>
      <label>Giới thiệu<textarea name="bio" maxlength="240" rows="3" placeholder="Một chút về bạn">${esc(state.user.bio || '')}</textarea></label>
      <div class="field-note">Email: <b>${esc(state.user.email)}</b><br>Tên đăng nhập: <b>@${esc(state.user.username)}</b></div>
      <button class="btn btn-primary" type="submit">Lưu thay đổi</button>
    </form>`,
    privacy: `<form id="privacySettingsForm" class="settings-form form-stack">
      <div class="settings-option"><div><b>Hiển thị trạng thái trực tuyến</b><p>Ghi nhớ lựa chọn riêng trên trình duyệt này.</p></div><label class="settings-switch"><input name="showOnline" type="checkbox" ${checked('showOnline', true)}><span></span></label></div>
      <div class="settings-option"><div><b>Xác nhận đã đọc</b><p>Lưu tùy chọn trên thiết bị; chưa thay đổi xử lý phía máy chủ.</p></div><label class="settings-switch"><input name="readReceipts" type="checkbox" ${checked('readReceipts', true)}><span></span></label></div>
      <button class="btn btn-primary" type="submit">Lưu quyền riêng tư</button>
    </form>`,
    notifications: `<form id="notificationSettingsForm" class="settings-form form-stack">
      <div class="settings-option"><div><b>Thông báo trong ứng dụng</b><p>Cho phép hiển thị các thông báo của trình duyệt khi được hỗ trợ.</p></div><label class="settings-switch"><input name="desktopNotifications" type="checkbox" ${checked('desktopNotifications')}><span></span></label></div>
      <div class="settings-option"><div><b>Âm thanh thông báo</b><p>Lưu lựa chọn âm thanh trên thiết bị này.</p></div><label class="settings-switch"><input name="soundNotifications" type="checkbox" ${checked('soundNotifications')}><span></span></label></div>
      <button class="btn btn-primary" type="submit">Lưu thông báo</button>
    </form>`,
    security: `<form id="changePasswordForm" class="settings-form form-stack">
      <div class="field-note">Không dùng lại mật khẩu cũ. Mật khẩu mới nên có ít nhất 8 ký tự.</div>
      <label>Mật khẩu hiện tại<input name="currentPassword" type="password" autocomplete="current-password" minlength="8" required></label>
      <label>Mật khẩu mới<input name="newPassword" type="password" autocomplete="new-password" minlength="8" required></label>
      <label>Xác nhận mật khẩu mới<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label>
      <p class="settings-api-note">Đổi mật khẩu cần API backend hỗ trợ. Nếu API chưa có, ứng dụng sẽ báo lỗi thay vì giả vờ đổi thành công.</p>
      <button class="btn btn-primary" type="submit">Đổi mật khẩu</button>
      <div class="settings-security-test"><h3>Kiểm tra mã hóa</h3><p>Chạy tự kiểm tra AES-GCM và DES-CBC + HMAC trên trình duyệt.</p><button class="btn btn-outline" type="button" data-action="crypto-self-test">Chạy kiểm tra mã hóa</button><pre id="cryptoTestOutput" class="test-output"></pre></div>
    </form>`
  };
  openDialog('Cài đặt', `<div class="settings-page">
    <aside class="settings-sidebar"><p class="eyebrow">THIẾT LẬP TÀI KHOẢN</p>
      ${tabs.map(([key, ico, label]) => `<button type="button" class="settings-nav ${active === key ? 'active' : ''}" data-action="settings-tab" data-section="${key}">${icon(ico)}<span>${label}</span></button>`).join('')}
    </aside>
    <section class="settings-main"><div class="settings-heading"><span class="eyebrow">SECURECHAT</span><h2>${tabs.find(([key]) => key === active)[2]}</h2><p>${({account:'Quản lý thông tin hồ sơ của bạn.',privacy:'Kiểm soát các lựa chọn riêng tư.',notifications:'Chọn loại thông báo bạn muốn nhận.',security:'Bảo vệ tài khoản và kiểm tra mã hóa.'})[active]}</p></div>
    ${content[active]}</section></div>`,
    '<button class="btn btn-outline" data-action="close-dialog">Đóng</button>',
    'CÀI ĐẶT TÀI KHOẢN');
  const avatarInput = $('#settingsAvatarFile');
  avatarInput?.addEventListener('change', () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Hãy chọn tệp ảnh.', 'error');
    if (file.size > 2 * 1024 * 1024) return toast('Ảnh đại diện tối đa 2 MB.', 'error');
    const reader = new FileReader();
    reader.onload = () => {
      const preview = $('#settingsAvatarPreview');
      if (preview) preview.innerHTML = `<img alt="Ảnh xem trước" src="${reader.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      try { localStorage.setItem('securechat.avatarPreview', String(reader.result)); } catch {}
      toast('Đã xem trước ảnh trên thiết bị. API lưu ảnh lên máy chủ chưa được cấu hình.');
    };
    reader.readAsDataURL(file);
  });
}
function openManageKey() {
  if (!state.selected) {
    return toast('Hãy chọn cuộc trò chuyện trước.', 'error');
  }

  const existing = getConversationPassphrase(state.selected.id);

  openDialog(
    'Khóa hội thoại',
    `<div class="field-note warning"><b>Quan trọng:</b> Hai người cần dùng cùng một cụm mật khẩu. Máy chủ không lưu cụm mật khẩu và không thể khôi phục nếu bạn quên.</div>
    <form id="keyForm" class="form-stack">
      <label>Cụm mật khẩu<input name="passphrase" type="password" minlength="8" autocomplete="off" required placeholder="Ít nhất 8 ký tự" value="${esc(existing)}"></label>
      <label style="display:flex;grid-template-columns:auto 1fr;align-items:center;gap:8px;font-weight:600">
        <input name="show" type="checkbox" style="width:16px;height:16px;min-height:16px"> Hiện cụm mật khẩu
      </label>
      <p>Khóa được tạo từ PBKDF2-SHA-256 trên trình duyệt. Dùng AES-GCM cho tin nhắn thực tế; DES chỉ dành cho học tập.</p>
    </form>`,
    '<button class="btn btn-outline" data-action="clear-key">Xóa khóa trên thiết bị</button><button class="btn btn-primary" data-action="save-key">Lưu khóa</button>',
    'MÃ HÓA ĐẦU-CUỐI'
  );
}

async function sendMessage(textOverride = null, filePayload = null) {
  if (!state.selected) {
    return toast('Chọn cuộc trò chuyện trước.', 'error');
  }

  const passphrase = getConversationPassphrase(state.selected.id);

  if (!passphrase) {
    openManageKey();
    return toast('Hãy thiết lập khóa hội thoại trước khi gửi.', 'error');
  }

  const text = filePayload
    ? JSON.stringify(filePayload)
    : String(textOverride ?? $('#messageInput').value).trim();

  if (!text) return;

  const input = $('#messageInput');

  if (!filePayload) {
    input.value = '';
    input.style.height = 'auto';
  }

  const algorithm = $('#algorithmSelect').value;
  const sendButton = $('#messageForm button[type="submit"]');

  sendButton.disabled = true;
  $('#encryptionStatus').textContent = 'Đang mã hóa và gửi…';

  try {
    const envelope = algorithm === 'AES-GCM'
      ? await encryptAESMessage(text, passphrase, state.selected.id, state.user.id)
      : await encryptDESMessage(text, passphrase, state.selected.id, state.user.id);

    await apiPost('/api/messages', {
  receiverId: state.selected.peer.id,
  message: envelope,
  algorithm
});

    await loadMessages();
    await loadAppData();
  } catch (error) {
    if (!filePayload) input.value = text;
    toast(error.message, 'error', 'Không gửi được tin nhắn');
  } finally {
    sendButton.disabled = !state.selected;
    $('#encryptionStatus').textContent = 'Tin nhắn được mã hóa trên trình duyệt trước khi gửi.';
  }
}

async function onFileSelected(file) {
  if (!file) return;

  if (file.size > 1024 * 1024) {
    return toast('Bản demo giới hạn tệp ở 1 MB.', 'error');
  }

  const passphrase = state.selected && getConversationPassphrase(state.selected.id);

  if (!passphrase) {
    openManageKey();
    return toast('Hãy thiết lập khóa hội thoại trước khi gửi tệp.', 'error');
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));

    await sendMessage(null, {
      type: 'file',
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      data: base64
    });
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function acceptFriend(id) {
  await apiPost(`/api/friends/${id}/accept`, {});
  closeDialog();
  toast('Đã chấp nhận lời mời.');
  await loadAppData();
  switchView('friends');
}

async function rejectFriend(id) {
  if (!confirm('Từ chối lời mời kết bạn này?')) return;

  await apiPost(`/api/friends/${id}/reject`, {});
  closeDialog();
  toast('Đã từ chối lời mời.');
  await loadAppData();
  switchView('friends');
}

async function addFriend(id) {
    await apiPost('/api/friends/request', {
        targetUserId: id
    });

    toast('Đã gửi lời mời kết bạn.');
    closeDialog();
    await loadAppData();
}

async function unfriend() {
  if (!state.selected) return;

  const friend = state.friends.find(f => f.id === state.selected.peer.id);
  if (!friend) return toast('Hai bạn chưa là bạn bè.', 'error');

  if (!confirm(`Hủy kết bạn với ${state.selected.peer.displayName}?`)) return;

  await apiDelete(`/api/friends/${friend.friendshipId}`);
  toast('Đã hủy kết bạn.');
  state.selected = null;
  await loadAppData();
  renderChatHeader();
  renderMessages();
}

async function blockUser(id) {
  const peer = state.selected?.peer;

  if (!confirm(`Chặn ${peer?.displayName || 'người dùng'}? Hai bên sẽ không thể nhắn tin.`)) return;

  await apiPost(`/api/blocks/${id}`, {});
  toast('Đã chặn người dùng.');
  state.selected = null;
  await loadAppData();
  renderChatHeader();
  renderMessages();
  closeProfile();
}

async function unblockUser(id) {
  if (!confirm('Bỏ chặn tài khoản này?')) return;

  await apiDelete(`/api/blocks/${id}`);
  toast('Đã bỏ chặn.');
  await loadAppData();
}

function openReport() {
  if (!state.selected) return;

  openDialog(
    'Báo cáo người dùng',
    `<p>Báo cáo sẽ được lưu để quản trị viên xem xét. Không gửi mật khẩu hoặc khóa mã hóa.</p>
    <form id="reportForm" class="form-stack">
      <label>Lý do
        <select name="reason" required>
          <option value="spam">Spam / quảng cáo</option>
          <option value="harassment">Quấy rối</option>
          <option value="impersonation">Mạo danh</option>
          <option value="unsafe">Nội dung không an toàn</option>
          <option value="other">Khác</option>
        </select>
      </label>
      <label>Chi tiết (không bắt buộc)
        <textarea name="details" rows="3" maxlength="1000" placeholder="Mô tả thêm…"></textarea>
      </label>
    </form>`,
    '<button class="btn btn-outline" data-action="close-dialog">Hủy</button><button class="btn btn-primary" data-action="submit-report">Gửi báo cáo</button>',
    'AN TOÀN CỘNG ĐỒNG'
  );
}

async function deleteConversation() {
  if (!state.selected) return;

  if (!confirm('Xóa cuộc trò chuyện khỏi danh sách của bạn? Bản lưu của người kia không bị xóa.')) return;

  await apiDelete(`/api/conversations/${state.selected.id}`);
  clearConversationPassphrase(state.selected.id);
  state.selected = null;
  toast('Đã xóa khỏi danh sách của bạn.');
  closeProfile();
  await loadAppData();
  renderChatHeader();
  renderMessages();
}

function toggleTheme() {
  const dark = !document.body.classList.contains('theme-dark');
  document.body.classList.toggle('theme-dark', dark);
  localStorage.setItem('securechat.theme', dark ? 'dark' : 'light');
}

function setupTheme() {
  document.body.classList.toggle('theme-dark', localStorage.getItem('securechat.theme') === 'dark');
}

async function runCryptoTests() {
  const out = $('#cryptoTestOutput');
  if (out) out.textContent = 'Đang chạy…';

  try {
    const aes = await aesSelfTest();
    const des = await desSelfTest();
    const result = { AES_GCM: aes, DES_CBC_HMAC: des };

    if (out) out.textContent = JSON.stringify(result, null, 2);
    toast('Các bài tự kiểm tra mã hóa đã đạt.', 'success');
  } catch (error) {
    if (out) out.textContent = `LỖI: ${error.message}`;
    toast(error.message, 'error', 'Kiểm tra mã hóa');
  }
}
async function startCall(kind) {
  if (!state.selected) return toast('Chọn bạn bè trước khi gọi.', 'error');
  if (!navigator.mediaDevices?.getUserMedia) return toast('Trình duyệt không hỗ trợ camera/microphone.', 'error');
  if (state.currentCall) return toast('Bạn đang có cuộc gọi.', 'error');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video'
    });

    const call = {
      id: crypto.randomUUID(),
      peerId: state.selected.peer.id,
      peerName: state.selected.peer.displayName,
      kind,
      pc: null,
      stream,
      remoteStream: new MediaStream(),
      pendingCandidates: [],
      accepted: true
    };

    state.currentCall = call;
    $('#callOverlay').hidden = false;
    $('#callPeerName').textContent = call.peerName;
    $('#callStatus').textContent = kind === 'video' ? 'ĐANG THIẾT LẬP VIDEO CALL' : 'ĐANG THIẾT LẬP VOICE CALL';
    $('#localVideo').srcObject = stream;
    $('#remoteVideo').srcObject = call.remoteStream;

    setupPeerConnection(call);

    const offer = await call.pc.createOffer();
    await call.pc.setLocalDescription(offer);
    await sendSignal(call, { type: 'offer', kind, sdp: call.pc.localDescription });
  } catch (error) {
    await endCall(false);
    toast(`Không thể bắt đầu cuộc gọi: ${error.message}`, 'error');
  }
}

function setupPeerConnection(call) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  call.pc = pc;
  call.stream.getTracks().forEach(track => pc.addTrack(track, call.stream));

  pc.onicecandidate = event => {
    if (event.candidate) {
      sendSignal(call, { type: 'candidate', candidate: event.candidate.toJSON() }).catch(() => {});
    }
  };

  pc.ontrack = event => {
    for (const track of event.streams[0]?.getTracks() || []) {
      call.remoteStream.addTrack(track);
    }
    $('#remoteVideo').srcObject = call.remoteStream;
  };

  pc.onconnectionstatechange = () => {
    const labels = {
      connected: 'ĐÃ KẾT NỐI',
      connecting: 'ĐANG KẾT NỐI…',
      failed: 'KẾT NỐI THẤT BẠI',
      disconnected: 'MẤT KẾT NỐI',
      closed: 'ĐÃ KẾT THÚC'
    };

    $('#callStatus').textContent = labels[pc.connectionState] || 'ĐANG GỌI';
  };
}

async function sendSignal(call, signal) {
  await apiPost('/api/calls/signal', {
    peerId: call.peerId,
    signal: { ...signal, callId: call.id }
  });
}

async function handleCallSignal(payload) {
  const signal = payload.signal;

  if (signal.type === 'offer') {
    if (state.currentCall) {
      return apiPost('/api/calls/signal', {
        peerId: payload.fromUserId,
        signal: { type: 'busy', callId: signal.callId }
      });
    }

    if (!confirm(`${payload.fromDisplayName} đang gọi ${signal.kind === 'video' ? 'video' : 'thoại'}. Chấp nhận?`)) {
      return apiPost('/api/calls/signal', {
        peerId: payload.fromUserId,
        signal: { type: 'reject', callId: signal.callId }
      });
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: signal.kind === 'video'
    });

    const call = {
      id: signal.callId,
      peerId: payload.fromUserId,
      peerName: payload.fromDisplayName,
      kind: signal.kind,
      pc: null,
      stream,
      remoteStream: new MediaStream(),
      pendingCandidates: [],
      accepted: true
    };

    state.currentCall = call;
    $('#callOverlay').hidden = false;
    $('#callPeerName').textContent = call.peerName;
    $('#callStatus').textContent = 'ĐANG NHẬN CUỘC GỌI';
    $('#localVideo').srcObject = stream;
    $('#remoteVideo').srcObject = call.remoteStream;

    setupPeerConnection(call);
    await call.pc.setRemoteDescription(signal.sdp);

    for (const candidate of call.pendingCandidates) {
      await call.pc.addIceCandidate(candidate);
    }

    call.pendingCandidates = [];

    const answer = await call.pc.createAnswer();
    await call.pc.setLocalDescription(answer);
    await sendSignal(call, { type: 'answer', sdp: call.pc.localDescription });
    return;
  }

  const call = state.currentCall;
  if (!call || signal.callId !== call.id) return;

  if (signal.type === 'answer') {
    await call.pc.setRemoteDescription(signal.sdp);

    for (const candidate of call.pendingCandidates) {
      await call.pc.addIceCandidate(candidate);
    }

    call.pendingCandidates = [];
  } else if (signal.type === 'candidate') {
    if (call.pc.remoteDescription) {
      await call.pc.addIceCandidate(signal.candidate);
    } else {
      call.pendingCandidates.push(signal.candidate);
    }
  } else if (['hangup', 'reject', 'busy'].includes(signal.type)) {
    await endCall(false);

    toast(
      signal.type === 'reject'
        ? 'Người kia đã từ chối cuộc gọi.'
        : signal.type === 'busy'
          ? 'Người kia đang bận.'
          : 'Cuộc gọi đã kết thúc.',
      'success',
      'Cuộc gọi'
    );
  }
}

async function endCall(notify = true) {
  const call = state.currentCall;
  if (!call) return;

  if (notify) {
    try {
      await sendSignal(call, { type: 'hangup' });
    } catch {}
  }

  try {
    call.pc?.close();
  } catch {}

  call.stream?.getTracks().forEach(track => track.stop());
  call.remoteStream?.getTracks().forEach(track => track.stop());

  state.currentCall = null;
  $('#callOverlay').hidden = true;
  $('#localVideo').srcObject = null;
  $('#remoteVideo').srcObject = null;
}

async function handleAction(action, button) {
  const id = button?.dataset.id;

  switch (action) {
    case 'show-register':
      showAuthPanel('register');
      break;
    case 'show-login':
      showAuthPanel('login');
      break;
    case 'show-forgot':
      showAuthPanel('forgot');
      break;
    case 'show-reset':
      showAuthPanel('reset');
      break;
    case 'show-verify':
      showAuthPanel('verify');
      break;
    case 'close-dialog':
      closeDialog();
      break;
    case 'toggle-password': {
      const target = button.dataset.target;
      const input = target === 'loginForm-password'
        ? $('#loginForm input[name="password"]')
        : document.getElementById(target);

      if (input) input.type = input.type === 'password' ? 'text' : 'password';
      break;
    }
    case 'demo-login': {
      const username = button.dataset.user;

      try {
        const result = await apiPost('/api/auth/login', {
          identity: username,
          password: 'SecureChat123!'
        });

        setAppView(result.user, true);
      } catch (error) {
        toast(error.message, 'error');
      }
      break;
    }
    
case 'logout':
  openDialog(
    'Đăng xuất',
    '<p>Bạn có chắc chắn muốn đăng xuất?</p>',
    '<button class="btn btn-outline" data-action="close-dialog">Hủy</button><button class="btn btn-primary" data-action="confirm-logout">Đăng xuất</button>',
    'SECURECHAT'
  );
  break;

case 'confirm-logout':
  disconnectEvents();
  apiPost('/api/auth/logout', {}).catch(() => {});
  clearAllPassphrases();
  state.selected = null;
  closeDialog();
  setAuthView();
  break;

    case 'toggle-rail': {
      state.railCollapsed = !state.railCollapsed;
      const appView = $('#appView');
      const rail = $('#leftRail');

      appView.classList.toggle('rail-expanded', !state.railCollapsed);
      rail.classList.toggle('collapsed', state.railCollapsed);
      break;
    }
    case 'toggle-theme':
      toggleTheme();
      break;
    case 'open-settings':
    case 'open-profile-settings':
      openSettings('account');
      break;
    case 'settings-tab':
      openSettings(button.dataset.section || 'account');
      break;
    case 'open-add-friend':
      openAddFriend();
      break;
    case 'open-notifications':
      openNotifications();
      break;
    case 'toggle-profile':
      toggleProfile();
      break;
    case 'back-to-list':
      $('#appView').classList.remove('mobile-chat');
      break;
    case 'manage-key':
      openManageKey();
      break;
    case 'save-key': {
      const input = $('#keyForm input[name="passphrase"]');

      try {
        if (!state.selected) throw new Error('Chọn cuộc trò chuyện trước.');
        setConversationPassphrase(state.selected.id, input.value);
        closeDialog();
        toast('Đã lưu khóa trong phiên trình duyệt hiện tại.');
        await loadMessages();
      } catch (error) {
        toast(error.message, 'error');
      }
      break;
    }
    case 'clear-key':
      if (state.selected) {
        clearConversationPassphrase(state.selected.id);
        closeDialog();
        toast('Đã xóa khóa trên thiết bị.');
        await loadMessages();
      }
      break;
    case 'accept-friend':
      await acceptFriend(id);
      break;
    case 'reject-friend':
      await rejectFriend(id);
      break;
    case 'add-friend':
      await addFriend(id);
      break;
    case 'unfriend':
      await unfriend();
      break;
    case 'block-user':
      await blockUser(id);
      break;
    case 'unblock-user':
      await unblockUser(id);
      break;
    case 'report-user':
      openReport();
      break;
    case 'submit-report': {
      const form = $('#reportForm');
      const data = Object.fromEntries(new FormData(form));

      await apiPost('/api/reports', {
        targetId: state.selected.peer.id,
        ...data
      });

      closeDialog();
      toast('Đã gửi báo cáo.');
      break;
    }
    case 'delete-conversation':
      await deleteConversation();
      break;
    case 'profile-message':
      closeProfile();
      break;
    case 'view-avatar':
      openDialog(
        'Ảnh đại diện',
        `<div class="profile-hero">
          ${avatarHTML(state.selected?.peer.displayName, '', false).replace(
            'avatar-photo"',
            'avatar-photo" style="width:130px;height:130px;font-size:40px"'
          )}
          <h2>${esc(state.selected?.peer.displayName)}</h2>
        </div>`,
        '<button class="btn btn-primary" data-action="close-dialog">Đóng</button>'
      );
      break;
    case 'toggle-message-search':
      $('#messageSearchBar').hidden = !$('#messageSearchBar').hidden;
      if (!$('#messageSearchBar').hidden) $('#messageSearchInput').focus();
      break;
    case 'close-message-search':
      $('#messageSearchBar').hidden = true;
      $('#messageSearchInput').value = '';
      renderMessages();
      break;
    case 'toggle-emoji':
      $('#emojiPicker').hidden = !$('#emojiPicker').hidden;
      break;
    case 'attach-file':
      $('#fileInput').click();
      break;
    case 'start-audio-call':
      await startCall('audio');
      break;
    case 'start-video-call':
      await startCall('video');
      break;
    case 'hangup-call':
      await endCall(true);
      break;
    case 'mark-notifications-read':
      markNotificationsRead();
      closeDialog();
      break;
    case 'crypto-self-test':
      await runCryptoTests();
      break;
  }
}

document.addEventListener('click', async event => {
  const actionButton = event.target.closest('[data-action]');
  const viewButton = event.target.closest('[data-view]');
  const tabButton = event.target.closest('[data-tab]');
  const conversationButton = event.target.closest('[data-conversation-id]');
  const peerButton = event.target.closest('[data-peer-id]');

  if (viewButton) {
    switchView(viewButton.dataset.view);
    if (window.innerWidth <= 760) $('#appView').classList.remove('mobile-chat');
    return;
  }

  if (tabButton) {
    state.listTab = tabButton.dataset.tab;
    renderConversations();
    return;
  }

  if (conversationButton) {
    const conversation = state.conversations.find(
      c => c.id === conversationButton.dataset.conversationId
    );

    if (conversation) await selectConversation(conversation);
    return;
  }

  if (peerButton) {
    try {
      await selectPeer(peerButton.dataset.peerId);
    } catch (error) {
      console.error('Cannot open friend conversation:', error);
      toast(error.message || 'Không mở được cuộc trò chuyện.', 'error');
    }
    return;
  }

  if (actionButton) {
    try {
      await handleAction(actionButton.dataset.action, actionButton);
    } catch (error) {
      console.error('Action failed:', actionButton.dataset.action, error);
      toast(error.message || 'Thao tác thất bại.', 'error');
    }
  }
});

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));

  try {
    const result = await apiPost('/api/auth/login', form);
    setAppView(result.user, result.isDemo);
  } catch (error) {
    toast(error.message, 'error', 'Đăng nhập thất bại');

    if (error.status === 401 && error.message.toLowerCase().includes('xác minh')) {
      $('#verifyForm input[name="email"]').value = form.identity;
      showAuthPanel('verify');
    }
  }
});

$('#registerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));

  try {
    const result = await apiPost('/api/auth/register', form);

    $('#verifyForm input[name="email"]').value = form.email;
    $('#devOtpHint').hidden = !result.devOtp;
    $('#devOtpHint').textContent = result.devOtp
      ? `Mã OTP môi trường phát triển: ${result.devOtp}. Trong production, OTP phải được gửi qua email.`
      : 'OTP đã được gửi qua email.';

    showAuthPanel('verify');
    toast(result.message);
  } catch (error) {
    toast(error.message, 'error', 'Không thể đăng ký');
  }
});

$('#verifyForm').addEventListener('submit', async event => {
  event.preventDefault();

  try {
    const result = await apiPost(
      '/api/auth/register/verify',
      Object.fromEntries(new FormData(event.currentTarget))
    );

    toast(result.message);
    showAuthPanel('login');
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('#forgotForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));

  try {
    const result = await apiPost('/api/auth/password/forgot', form);

    $('#resetForm input[name="email"]').value = form.email;
    $('#devResetOtpHint').hidden = !result.devOtp;
    $('#devResetOtpHint').textContent = result.devOtp
      ? `Mã OTP môi trường phát triển: ${result.devOtp}.`
      : 'Nếu email tồn tại, mã OTP đã được gửi.';

    showAuthPanel('reset');
    toast(result.message);
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('#resetForm').addEventListener('submit', async event => {
  event.preventDefault();

  try {
    const result = await apiPost(
      '/api/auth/password/reset',
      Object.fromEntries(new FormData(event.currentTarget))
    );

    toast(result.message);
    showAuthPanel('login');
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('#messageForm').addEventListener('submit', event => {
  event.preventDefault();
  sendMessage().catch(error => toast(error.message, 'error'));
});

$('#messageInput').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    $('#messageForm').requestSubmit();
  }
});

$('#messageInput').addEventListener('input', event => {
  event.target.style.height = 'auto';
  event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`;
});

$('#fileInput').addEventListener('change', event => {
  onFileSelected(event.target.files?.[0]);
  event.target.value = '';
});

$('#conversationSearch').addEventListener('input', () => {
  if (state.view === 'chats') renderConversations();
});

$('#messageSearchInput').addEventListener('input', renderMessages);

$('#emojiPicker').addEventListener('click', event => {
  if (event.target.tagName === 'BUTTON') {
    const input = $('#messageInput');
    input.value += event.target.textContent;
    input.focus();
    $('#emojiPicker').hidden = true;
  }
});

$('#appDialog').addEventListener('click', event => {
  if (event.target === $('#appDialog')) closeDialog();
});

$('#appDialog').addEventListener('submit', async event => {
  if (event.target.id === 'friendSearchForm') {
    event.preventDefault();
    await searchFriends($('#friendSearchInput').value.trim());
  } else if (event.target.id === 'settingsForm') {
    event.preventDefault();
    try {
      const formData = Object.fromEntries(new FormData(event.target));
      const data = await apiPatch('/api/profile', formData);
      state.user = data.user;
      $('#railUserName').textContent = state.user.displayName;
      setAvatarElement($('#railAvatar'), state.user.displayName, 'avatar-xl', true);
      toast(data.message || 'Đã lưu thông tin tài khoản.');
      openSettings('account');
    } catch (error) {
      toast(error.message, 'error');
    }
  } else if (event.target.id === 'privacySettingsForm' || event.target.id === 'notificationSettingsForm') {
    event.preventDefault();
    const saved = (() => { try { return JSON.parse(localStorage.getItem('securechat.settings') || '{}'); } catch { return {}; } })();
    for (const [key, value] of new FormData(event.target).entries()) saved[key] = value === 'on';
    for (const input of event.target.querySelectorAll('input[type="checkbox"]')) saved[input.name] = input.checked;
    localStorage.setItem('securechat.settings', JSON.stringify(saved));
    if (event.target.id === 'notificationSettingsForm' && saved.desktopNotifications && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    toast('Đã lưu tùy chọn trên trình duyệt này.');
  } else if (event.target.id === 'changePasswordForm') {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target));
    if (form.newPassword !== form.confirmPassword) return toast('Mật khẩu xác nhận không khớp.', 'error');
    if (form.newPassword.length < 8) return toast('Mật khẩu mới phải có ít nhất 8 ký tự.', 'error');
    try {
      const result = await apiPost('/api/auth/password/change', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      toast(result.message || 'Đã đổi mật khẩu.');
      event.target.reset();
    } catch (error) {
      toast(error.message || 'Backend chưa hỗ trợ API đổi mật khẩu hiện tại.', 'error');
    }
  } else if (event.target.id === 'reportForm') {
    event.preventDefault();
  }
});

$('#appDialog').addEventListener('change', event => {
  if (event.target.name === 'show') {
    const input = $('#keyForm input[name="passphrase"]');
    if (input) input.type = event.target.checked ? 'text' : 'password';
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 1020 && state.user) {
    state.profileOpen = true;
    $('#appView').classList.add('profile-open');
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) pollData();
});
setupTheme();

(async () => {
  try {
    const result = await apiGet('/api/auth/me');
    setAppView(result.user, result.user.id?.startsWith('demo-'));
  } catch {
    setAuthView();
  }
})();