/* Secure Chat notification UI
 * Fixes: unread badge logic, friend-request badge, sender-name field mapping,
 * nested API response shapes, safe localStorage parsing, and duplicate bindings.
 */

const NOTIFY_API_BASE =
  window.location.protocol === "file:"
    ? "http://localhost:3000"
    : window.location.port === "3000"
      ? window.location.origin
      : `${window.location.protocol}//${window.location.hostname}:3000`;

function readSavedNotificationIds() {
  try {
    const value = JSON.parse(
      localStorage.getItem("securechat-notification-read") || "[]"
    );
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

const notificationState = {
  items: [],
  filter: "all",
  readIds: readSavedNotificationIds(),
  closeTimer: null,
  pollTimer: null
};

async function notifyApi(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(`${NOTIFY_API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(
      body?.message ||
      body?.error ||
      `Yêu cầu thất bại (${response.status})`
    );
  }

  return body;
}

function notifyEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/* Handles both { requests: [] } and wrappers such as { data: { requests: [] } }. */
function normalizeNotifyList(body, keys = ["requests", "incoming", "data"]) {
  const visited = new Set();

  function findList(value, depth = 0) {
    if (Array.isArray(value)) return value;
    if (!isObject(value) || depth > 4 || visited.has(value)) return [];
    visited.add(value);

    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key];
    }

    for (const key of ["data", "result", "payload", "response"]) {
      if (isObject(value[key]) || Array.isArray(value[key])) {
        const result = findList(value[key], depth + 1);
        if (result.length || Array.isArray(value[key])) return result;
      }
    }

    return [];
  }

  return findList(body);
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getNotifyUser(item = {}) {
  const candidates = [
    item?.sender,
    item?.fromUser,
    item?.requester,
    item?.requestedByUser,
    item?.requestedBy,
    item?.user,
    item?.friend,
    item?.otherUser,
    item?.senderUser,
    item?.userInfo,
    item?.requesterInfo,
    item?.request?.sender,
    item?.request?.requester,
    item?.request?.user,
    item?.friendship?.sender,
    item?.friendship?.requester,
    item?.friendship?.user,
    item?.createdBy,
    item?.senderId,
    item?.requesterId,
    item?.userId
  ];

  // Prefer a populated user object with an actual display name/username.
  const namedUser = candidates.find((value) =>
    isObject(value) &&
    firstText(
      value.displayName,
      value.fullName,
      value.full_name,
      value.name,
      value.username
    )
  );

  if (namedUser) return namedUser;

  // Some APIs return name fields directly on the friendship/request object.
  const fallback = {
    displayName: firstText(
      item?.requesterDisplayName,
      item?.senderDisplayName,
      item?.fromDisplayName,
      item?.requestedByName,
      item?.displayName,
      item?.fullName,
      item?.full_name,
      item?.name
    ),
    username: firstText(
      item?.requesterUsername,
      item?.senderUsername,
      item?.fromUsername,
      item?.requestedByUsername,
      item?.username
    ),
    _id:
      item?.requesterId?._id ||
      item?.senderId?._id ||
      item?.userId?._id ||
      item?.requesterId ||
      item?.senderId ||
      item?.userId ||
      ""
  };

  // Keep an ID-only populated object when no direct name fields were supplied.
  const idOnlyUser = candidates.find((value) => isObject(value) && (value._id || value.id));
  if (!fallback.displayName && !fallback.username && idOnlyUser) {
    return idOnlyUser;
  }

  return fallback;
}

function notifyName(user = {}, item = {}) {
  return firstText(
    user.displayName,
    user.fullName,
    user.full_name,
    user.name,
    user.username,
    item?.requesterDisplayName,
    item?.senderDisplayName,
    item?.fromDisplayName,
    item?.requestedByName,
    item?.displayName,
    item?.fullName,
    item?.name
  ) || "Người dùng";
}

function notifyUsername(user = {}, item = {}) {
  return firstText(
    user.username,
    item?.requesterUsername,
    item?.senderUsername,
    item?.fromUsername,
    item?.requestedByUsername,
    item?.username
  );
}

function notifyInitials(user = {}, item = {}) {
  const value = notifyName(user, item).trim();
  if (!value) return "?";

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] || ""}${parts.at(-1)?.[0] || ""}`.toUpperCase();
}

function getNotificationId(item = {}) {
  const directId =
    item?.notificationId ||
    item?.friendshipId?._id ||
    item?.friendshipId?.id ||
    item?.friendshipId ||
    item?.requestId?._id ||
    item?.requestId?.id ||
    item?.requestId ||
    item?.friendship?._id ||
    item?.friendship?.id ||
    item?.request?._id ||
    item?.request?.id ||
    item?._id ||
    item?.id;

  if (directId && typeof directId !== "object") return String(directId);

  const senderId =
    item?.senderId?._id ||
    item?.senderId?.id ||
    item?.requesterId?._id ||
    item?.requesterId?.id ||
    item?.userId?._id ||
    item?.userId?.id;

  if (senderId) return `sender:${senderId}`;

  const user = getNotifyUser(item);
  const username = notifyUsername(user, item);
  const createdAt = item?.createdAt || item?.created_at || item?.requestedAt || "";
  const fallbackName = notifyName(user, item);

  if (username || createdAt || fallbackName !== "Người dùng") {
    return `friend-request:${username || fallbackName}:${createdAt}`;
  }

  return "";
}

function getFriendshipActionId(item = {}) {
  const value =
    item?.friendshipId?._id ||
    item?.friendshipId?.id ||
    item?.friendshipId ||
    item?.friendship?._id ||
    item?.friendship?.id ||
    item?.requestId?._id ||
    item?.requestId?.id ||
    item?.requestId ||
    item?.request?._id ||
    item?.request?.id ||
    item?._id ||
    item?.id;

  return value && typeof value !== "object" ? String(value) : "";
}

function saveReadIds() {
  try {
    localStorage.setItem(
      "securechat-notification-read",
      JSON.stringify([...notificationState.readIds])
    );
  } catch {
    // Storage có thể bị chặn; giao diện vẫn tiếp tục hoạt động trong phiên hiện tại.
  }
}

function ensureNotificationPanel() {
  let root = document.getElementById("notificationPanelRoot");
  if (root) return root;

  root = document.createElement("div");
  root.id = "notificationPanelRoot";
  root.className = "notification-panel-root";
  root.hidden = true;

  root.innerHTML = `
    <div id="notificationBackdrop" class="notification-panel-backdrop"></div>
    <aside class="notification-panel" aria-label="Thông báo" role="dialog" aria-modal="true">
      <header class="notification-panel-header">
        <div>
          <h2>Thông báo</h2>
          <p>Cập nhật hoạt động gần đây</p>
        </div>
        <button id="btnCloseNotifications" class="notification-close-btn" type="button" aria-label="Đóng">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </header>
      <div class="notification-filter-bar">
        <div class="notification-tabs">
          <button type="button" class="notification-tab active" data-notification-filter="all">Tất cả</button>
          <button type="button" class="notification-tab" data-notification-filter="unread">Chưa đọc</button>
        </div>
        <button id="btnMarkAllRead" class="notification-mark-all" type="button">Đánh dấu tất cả</button>
      </div>
      <div id="notificationPanelContent" class="notification-panel-content">
        <div class="notification-loading">
          <div class="notification-spinner"></div>
          <span>Đang tải thông báo...</span>
        </div>
      </div>
    </aside>
  `;

  document.body.appendChild(root);

  root.querySelector("#notificationBackdrop")
    ?.addEventListener("click", closeNotificationPanel);

  root.querySelector("#btnCloseNotifications")
    ?.addEventListener("click", closeNotificationPanel);

  root.querySelectorAll("[data-notification-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      notificationState.filter = button.dataset.notificationFilter || "all";

      root.querySelectorAll("[data-notification-filter]").forEach((tab) => {
        tab.classList.toggle("active", tab === button);
      });

      renderNotificationItems();
    });
  });

  root.querySelector("#btnMarkAllRead")
    ?.addEventListener("click", () => {
      for (const item of notificationState.items) {
        const id = getNotificationId(item);
        if (id) notificationState.readIds.add(id);
      }

      saveReadIds();
      updateNotificationBadge();
      renderNotificationItems();
    });

  return root;
}

function openNotificationPanel() {
  const root = ensureNotificationPanel();

  if (notificationState.closeTimer) {
    window.clearTimeout(notificationState.closeTimer);
    notificationState.closeTimer = null;
  }

  root.hidden = false;
  requestAnimationFrame(() => root.classList.add("open"));
  document.body.classList.add("notification-open");
  loadNotifications();
}

function closeNotificationPanel() {
  const root = document.getElementById("notificationPanelRoot");
  if (!root) return;

  root.classList.remove("open");
  document.body.classList.remove("notification-open");

  if (notificationState.closeTimer) {
    window.clearTimeout(notificationState.closeTimer);
  }

  notificationState.closeTimer = window.setTimeout(() => {
    // Do not hide it if it was reopened before the close animation finished.
    if (!root.classList.contains("open")) root.hidden = true;
    notificationState.closeTimer = null;
  }, 180);
}

async function loadNotifications() {
  const content = document.getElementById("notificationPanelContent");
  if (!content) return;

  content.innerHTML = `
    <div class="notification-loading">
      <div class="notification-spinner"></div>
      <span>Đang tải thông báo...</span>
    </div>
  `;

  try {
    const body = await notifyApi("/api/friends/requests/incoming");
    const requests = normalizeNotifyList(body, ["requests", "incoming", "data"]);

    notificationState.items = requests.map((item) => ({
      ...item,
      type: "friend_request"
    }));

    updateNotificationBadge();
    renderNotificationItems();
  } catch (error) {
    content.innerHTML = `
      <div class="notification-empty">
        <div class="notification-empty-icon">!</div>
        <h3>Không tải được thông báo</h3>
        <p>${notifyEscape(error?.message || "Đã xảy ra lỗi khi tải thông báo.")}</p>
      </div>
    `;
  }
}

function updateNotificationBadge() {
  const bellButton = document.getElementById("btnNotifications");
  const pendingCount = notificationState.items.length;
  const unreadCount = notificationState.items.filter((item) => {
    const id = getNotificationId(item);
    // Nếu API không trả ID, vẫn tính là chưa đọc để không làm mất số badge.
    return !id || !notificationState.readIds.has(id);
  }).length;

  if (bellButton) {
    let badge = document.getElementById("notificationBadge");

    if (!badge || !bellButton.contains(badge)) {
      badge = bellButton.querySelector("#notificationBadge") || document.createElement("span");
      badge.id = "notificationBadge";
      bellButton.appendChild(badge);
    }

    badge.className = "notification-badge";
    badge.hidden = unreadCount <= 0;
    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    badge.setAttribute("aria-label", `${unreadCount} thông báo chưa đọc`);
  }

  const friendsButton = document.getElementById("navFriends");

  if (friendsButton) {
    let badge = document.getElementById("friendRequestBadge");

    if (!badge || !friendsButton.contains(badge)) {
      badge = friendsButton.querySelector("#friendRequestBadge") || document.createElement("span");
      badge.id = "friendRequestBadge";
      friendsButton.appendChild(badge);
    }

    badge.className = "friend-request-badge";
    badge.hidden = pendingCount <= 0;
    badge.textContent = pendingCount > 99 ? "99+" : String(pendingCount);
    badge.setAttribute("aria-label", `${pendingCount} lời mời kết bạn đang chờ`);
    friendsButton.setAttribute(
      "aria-label",
      pendingCount > 0
        ? `Bạn bè, ${pendingCount} lời mời kết bạn đang chờ`
        : "Bạn bè"
    );
  }
}

function renderNotificationItems() {
  const content = document.getElementById("notificationPanelContent");
  if (!content) return;

  const visible = notificationState.items.filter((item) => {
    if (notificationState.filter !== "unread") return true;
    const id = getNotificationId(item);
    return !id || !notificationState.readIds.has(id);
  });

  content.replaceChildren();

  if (!visible.length) {
    content.innerHTML = `
      <div class="notification-empty">
        <div class="notification-empty-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>
        <h3>${notificationState.filter === "unread" ? "Không có thông báo chưa đọc" : "Chưa có thông báo"}</h3>
        <p>Thông báo về lời mời kết bạn sẽ xuất hiện ở đây.</p>
      </div>
    `;
    return;
  }

  for (const item of visible) {
    content.appendChild(createNotificationItem(item));
  }
}

function createNotificationItem(item) {
  const id = getNotificationId(item);
  const user = getNotifyUser(item);
  const name = notifyName(user, item);
  const username = notifyUsername(user, item);
  const friendshipId = getFriendshipActionId(item);
  const isRead = Boolean(id && notificationState.readIds.has(id));

  const row = document.createElement("article");
  row.className = `notification-item${isRead ? "" : " unread"}`;

  row.innerHTML = `
    <div class="notification-avatar">${notifyEscape(notifyInitials(user, item))}</div>
    <div class="notification-item-main">
      <div class="notification-item-copy">
        <p><strong>${notifyEscape(name)}</strong> đã gửi cho bạn một lời mời kết bạn.</p>
        <span>${username ? `@${notifyEscape(username)}` : "Lời mời kết bạn"}</span>
      </div>
      <div class="notification-item-actions">
        <button type="button" class="notification-action primary" data-notify-accept>Chấp nhận</button>
        <button type="button" class="notification-action" data-notify-reject>Từ chối</button>
      </div>
    </div>
    ${isRead ? "" : '<span class="notification-unread-dot" title="Chưa đọc"></span>'}
  `;

  const markRead = () => {
    if (id) {
      notificationState.readIds.add(id);
      saveReadIds();
    }

    updateNotificationBadge();
    row.classList.remove("unread");
    row.querySelector(".notification-unread-dot")?.remove();
  };

  row.addEventListener("click", (event) => {
    if (event.target.closest(".notification-item-actions")) return;
    markRead();
  });

  async function handleFriendRequest(button, action) {
    if (!friendshipId) {
      alert("Không tìm thấy mã lời mời. Cần kiểm tra dữ liệu API/backend.");
      return;
    }

    const originalText = action === "accept" ? "Chấp nhận" : "Từ chối";

    try {
      button.disabled = true;
      button.textContent = "Đang xử lý...";

      await notifyApi(
        `/api/friends/${encodeURIComponent(friendshipId)}/${action}`,
        { method: "POST" }
      );

      await loadNotifications();
    } catch (error) {
      button.disabled = false;
      button.textContent = originalText;
      alert(error?.message || "Không thể xử lý lời mời.");
    }
  }

  row.querySelector("[data-notify-accept]")
    ?.addEventListener("click", (event) => {
      event.stopPropagation();
      handleFriendRequest(event.currentTarget, "accept");
    });

  row.querySelector("[data-notify-reject]")
    ?.addEventListener("click", (event) => {
      event.stopPropagation();
      handleFriendRequest(event.currentTarget, "reject");
    });

  return row;
}

async function refreshNotificationBadge() {
  try {
    const body = await notifyApi("/api/friends/requests/incoming");
    const requests = normalizeNotifyList(body, ["requests", "incoming", "data"]);

    notificationState.items = requests.map((item) => ({
      ...item,
      type: "friend_request"
    }));

    updateNotificationBadge();

    const root = document.getElementById("notificationPanelRoot");
    if (root && !root.hidden && root.classList.contains("open")) {
      renderNotificationItems();
    }
  } catch {
    // Giữ nguyên giao diện nếu backend tạm thời chưa sẵn sàng.
  }
}

function bindNotificationUi() {
  if (window.__secureChatNotificationUiBound) return;
  window.__secureChatNotificationUiBound = true;

  const button = document.getElementById("btnNotifications");

  button?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openNotificationPanel();
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNotificationPanel();
  });

  refreshNotificationBadge();

  // Refresh badge while the page is open, but avoid polling in a hidden tab.
  if (!notificationState.pollTimer) {
    notificationState.pollTimer = window.setInterval(() => {
      if (!document.hidden) refreshNotificationBadge();
    }, 30000);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshNotificationBadge();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindNotificationUi, { once: true });
} else {
  bindNotificationUi();
}
