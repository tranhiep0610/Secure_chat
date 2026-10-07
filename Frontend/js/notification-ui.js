const NOTIFY_API_BASE =
  window.location.protocol === "file:"
    ? "http://localhost:3000"
    : window.location.port === "3000"
      ? window.location.origin
      : `${window.location.protocol}//${window.location.hostname}:3000`;

const notificationState = {
  items: [],
  filter: "all",
  readIds: new Set(
    JSON.parse(
      localStorage.getItem("securechat-notification-read") || "[]"
    )
  )
};

async function notifyApi(path, options = {}) {
  const response = await fetch(`${NOTIFY_API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
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

function normalizeNotifyList(body, keys = []) {
  if (Array.isArray(body)) return body;

  for (const key of keys) {
    if (Array.isArray(body?.[key])) return body[key];
  }

  return [];
}

function getNotifyUser(item) {
  return (
    item?.user ||
    item?.requester ||
    item?.requestedByUser ||
    item?.friend ||
    item?.otherUser ||
    null
  );
}

function notifyName(user = {}) {
  return user.displayName || user.username || "Người dùng";
}

function notifyInitials(user = {}) {
  const value = notifyName(user).trim();

  if (!value) return "?";

  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts.at(-1)?.[0] || ""}`.toUpperCase();
}

function getNotificationId(item) {
  return String(
    item?.notificationId ||
    item?.friendshipId ||
    item?._id ||
    item?.id ||
    ""
  );
}

function saveReadIds() {
  localStorage.setItem(
    "securechat-notification-read",
    JSON.stringify([...notificationState.readIds])
  );
}

function ensureNotificationPanel() {
  let root = document.getElementById("notificationPanelRoot");

  if (root) return root;

  root = document.createElement("div");
  root.id = "notificationPanelRoot";
  root.className = "notification-panel-root";
  root.hidden = true;

  root.innerHTML = `
    <div
      id="notificationBackdrop"
      class="notification-panel-backdrop"
    ></div>

    <aside
      class="notification-panel"
      aria-label="Thông báo"
    >
      <header class="notification-panel-header">
        <div>
          <h2>Thông báo</h2>
          <p>Cập nhật hoạt động gần đây</p>
        </div>

        <button
          id="btnCloseNotifications"
          class="notification-close-btn"
          type="button"
          aria-label="Đóng"
        >
          <svg viewBox="0 0 24 24">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </header>

      <div class="notification-filter-bar">
        <div class="notification-tabs">
          <button
            type="button"
            class="notification-tab active"
            data-notification-filter="all"
          >
            Tất cả
          </button>

          <button
            type="button"
            class="notification-tab"
            data-notification-filter="unread"
          >
            Chưa đọc
          </button>
        </div>

        <button
          id="btnMarkAllRead"
          class="notification-mark-all"
          type="button"
        >
          Đánh dấu tất cả
        </button>
      </div>

      <div
        id="notificationPanelContent"
        class="notification-panel-content"
      >
        <div class="notification-loading">
          <div class="notification-spinner"></div>
          <span>Đang tải thông báo...</span>
        </div>
      </div>
    </aside>
  `;

  document.body.appendChild(root);

  root
    .querySelector("#notificationBackdrop")
    ?.addEventListener("click", closeNotificationPanel);

  root
    .querySelector("#btnCloseNotifications")
    ?.addEventListener("click", closeNotificationPanel);

  root
    .querySelectorAll("[data-notification-filter]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        notificationState.filter =
          button.dataset.notificationFilter || "all";

        root
          .querySelectorAll("[data-notification-filter]")
          .forEach((tab) => {
            tab.classList.toggle(
              "active",
              tab === button
            );
          });

        renderNotificationItems();
      });
    });

  root
    .querySelector("#btnMarkAllRead")
    ?.addEventListener("click", () => {
      for (const item of notificationState.items) {
        const id = getNotificationId(item);

        if (id) {
          notificationState.readIds.add(id);
        }
      }

      saveReadIds();
      updateNotificationBadge();
      renderNotificationItems();
    });

  return root;
}

function openNotificationPanel() {
  const root = ensureNotificationPanel();

  root.hidden = false;

  requestAnimationFrame(() => {
    root.classList.add("open");
  });

  document.body.classList.add("notification-open");

  loadNotifications();
}

function closeNotificationPanel() {
  const root =
    document.getElementById("notificationPanelRoot");

  if (!root) return;

  root.classList.remove("open");
  document.body.classList.remove("notification-open");

  window.setTimeout(() => {
    root.hidden = true;
  }, 180);
}

async function loadNotifications() {
  const content =
    document.getElementById("notificationPanelContent");

  if (!content) return;

  content.innerHTML = `
    <div class="notification-loading">
      <div class="notification-spinner"></div>
      <span>Đang tải thông báo...</span>
    </div>
  `;

  try {
    const body =
      await notifyApi(
        "/api/friends/requests/incoming"
      );

    const requests =
      normalizeNotifyList(
        body,
        [
          "requests",
          "incoming",
          "data"
        ]
      );

    notificationState.items =
      requests.map((item) => ({
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
        <p>${notifyEscape(error.message)}</p>
      </div>
    `;
  }
}

function updateNotificationBadge() {
  const button =
    document.getElementById("btnNotifications");

  if (!button) return;

  let badge =
    document.getElementById("notificationBadge");

  const unreadCount =
    notificationState.items.filter((item) => {
      const id = getNotificationId(item);
      return id && !notificationState.readIds.has(id);
    }).length;

  if (!badge) {
    badge = document.createElement("span");
    badge.id = "notificationBadge";
    badge.className = "notification-badge";
    button.appendChild(badge);
  }

  if (unreadCount <= 0) {
    badge.hidden = true;
    badge.textContent = "";
    return;
  }

  badge.hidden = false;
  badge.textContent =
    unreadCount > 99 ? "99+" : String(unreadCount);
}

function renderNotificationItems() {
  const content =
    document.getElementById("notificationPanelContent");

  if (!content) return;

  const visible =
    notificationState.items.filter((item) => {
      if (notificationState.filter !== "unread") {
        return true;
      }

      const id = getNotificationId(item);

      return (
        id &&
        !notificationState.readIds.has(id)
      );
    });

  content.replaceChildren();

  if (!visible.length) {
    content.innerHTML = `
      <div class="notification-empty">
        <div class="notification-empty-icon">
          <svg viewBox="0 0 24 24">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>

        <h3>
          ${
            notificationState.filter === "unread"
              ? "Không có thông báo chưa đọc"
              : "Chưa có thông báo"
          }
        </h3>

        <p>
          Thông báo về lời mời kết bạn sẽ xuất hiện ở đây.
        </p>
      </div>
    `;

    return;
  }

  for (const item of visible) {
    content.appendChild(
      createNotificationItem(item)
    );
  }
}

function createNotificationItem(item) {
  const id = getNotificationId(item);
  const user = getNotifyUser(item) || {};
  const friendshipId =
    item?.friendshipId ||
    item?._id ||
    item?.id ||
    "";

  const isRead =
    id &&
    notificationState.readIds.has(id);

  const row =
    document.createElement("article");

  row.className =
    `notification-item${isRead ? "" : " unread"}`;

  row.innerHTML = `
    <div class="notification-avatar">
      ${notifyEscape(notifyInitials(user))}
    </div>

    <div class="notification-item-main">
      <div class="notification-item-copy">
        <p>
          <strong>${notifyEscape(notifyName(user))}</strong>
          đã gửi cho bạn một lời mời kết bạn.
        </p>

        <span>
          @${notifyEscape(user.username || "user")}
        </span>
      </div>

      <div class="notification-item-actions">
        <button
          type="button"
          class="notification-action primary"
          data-notify-accept
        >
          Chấp nhận
        </button>

        <button
          type="button"
          class="notification-action"
          data-notify-reject
        >
          Từ chối
        </button>
      </div>
    </div>

    ${
      isRead
        ? ""
        : `<span class="notification-unread-dot" title="Chưa đọc"></span>`
    }
  `;

  const markRead = () => {
    if (!id) return;

    notificationState.readIds.add(id);
    saveReadIds();
    updateNotificationBadge();

    row.classList.remove("unread");
    row
      .querySelector(".notification-unread-dot")
      ?.remove();
  };

  row.addEventListener("click", (event) => {
    if (
      event.target.closest(
        ".notification-item-actions"
      )
    ) {
      return;
    }

    markRead();
  });

  row
    .querySelector("[data-notify-accept]")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget;

      if (!friendshipId) return;

      try {
        button.disabled = true;
        button.textContent = "Đang xử lý...";

        await notifyApi(
          `/api/friends/${encodeURIComponent(friendshipId)}/accept`,
          {
            method: "POST"
          }
        );

        markRead();
        await loadNotifications();
      } catch (error) {
        button.disabled = false;
        button.textContent = "Chấp nhận";
        alert(error.message);
      }
    });

  row
    .querySelector("[data-notify-reject]")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget;

      if (!friendshipId) return;

      try {
        button.disabled = true;
        button.textContent = "Đang xử lý...";

        await notifyApi(
          `/api/friends/${encodeURIComponent(friendshipId)}/reject`,
          {
            method: "POST"
          }
        );

        markRead();
        await loadNotifications();
      } catch (error) {
        button.disabled = false;
        button.textContent = "Từ chối";
        alert(error.message);
      }
    });

  return row;
}

async function refreshNotificationBadge() {
  try {
    const body =
      await notifyApi(
        "/api/friends/requests/incoming"
      );

    const requests =
      normalizeNotifyList(
        body,
        [
          "requests",
          "incoming",
          "data"
        ]
      );

    notificationState.items =
      requests.map((item) => ({
        ...item,
        type: "friend_request"
      }));

    updateNotificationBadge();
  } catch {
    // Không phá giao diện nếu backend chưa sẵn sàng.
  }
}

function bindNotificationUi() {
  const button =
    document.getElementById("btnNotifications");

  button?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openNotificationPanel();
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeNotificationPanel();
      }
    }
  );

  refreshNotificationBadge();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    bindNotificationUi
  );
} else {
  bindNotificationUi();
}