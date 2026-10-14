const BLOCK_API_BASE =
  window.location.protocol === "file:"
    ? "http://localhost:3000"
    : window.location.port === "3000"
      ? window.location.origin
      : `${window.location.protocol}//${window.location.hostname}:3000`;

async function blockApi(path, options = {}) {
  const response = await fetch(`${BLOCK_API_BASE}${path}`, {
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

function blockEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function blockName(user = {}) {
  return user.displayName || user.username || "Người dùng";
}

function blockInitials(user = {}) {
  const value = blockName(user).trim();

  if (!value) return "?";

  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts.at(-1)?.[0] || ""}`.toUpperCase();
}

function normalizeBlockList(body) {
  if (Array.isArray(body)) return body;

  for (const key of ["blocks", "blocked", "users", "data"]) {
    if (Array.isArray(body?.[key])) {
      return body[key];
    }
  }

  return [];
}

function getBlockedUser(item) {
  return (
    item?.user ||
    item?.blockedUser ||
    item?.blocked ||
    item?.targetUser ||
    item
  );
}

function openBlockedShell() {
  const app = document.querySelector(".app-shell");
  const page = document.getElementById("featurePage");
  const title = document.getElementById("featureTitle");
  const description = document.getElementById("featureDescription");
  const toolbar = document.querySelector("#featurePage .feature-toolbar");

  app?.classList.add("feature-mode");

  if (!page) return false;

  page.hidden = false;

  if (title) {
    title.textContent = "Đã chặn";
  }

  if (description) {
    description.textContent =
      "Quản lý những tài khoản bạn không muốn nhận tin nhắn";
  }

  if (toolbar) {
    toolbar.style.display = "none";
  }

  document
    .querySelectorAll(".main-rail .rail-icon")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.id === "navBlocked"
      );
    });

  return true;
}

function renderBlockedEmpty(content, title, description) {
  content.innerHTML = `
    <div class="blocked-empty">
      <div class="blocked-empty-icon">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M5.6 5.6l12.8 12.8"></path>
        </svg>
      </div>

      <h3>${blockEscape(title)}</h3>
      <p>${blockEscape(description)}</p>
    </div>
  `;
}

async function openBlockedPageModern() {
  if (!openBlockedShell()) return;

  const content = document.getElementById("featureContent");

  if (!content) return;

  content.innerHTML = `
    <div class="blocked-page">
      <div class="blocked-card">
        <div class="blocked-loading">
          <div class="blocked-spinner"></div>
          <span>Đang tải danh sách chặn...</span>
        </div>
      </div>
    </div>
  `;

  try {
    const body = await blockApi("/api/blocks");
    const blocks = normalizeBlockList(body);

    content.innerHTML = `
      <div class="blocked-page">
        <section class="blocked-card">
          <div class="blocked-card-head">
            <div>
              <h2>Danh sách đã chặn</h2>
              <p>
                Người bị chặn không thể tiếp tục nhắn tin với bạn.
              </p>
            </div>

            <span class="blocked-count">
              ${blocks.length}
            </span>
          </div>

          <div class="blocked-tools">
            <div class="blocked-search">
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7"></circle>
                <path d="M20 20l-3.8-3.8"></path>
              </svg>

              <input
                id="blockedSearchInput"
                type="search"
                placeholder="Tìm trong danh sách chặn..."
                autocomplete="off"
              >
            </div>
          </div>

          <div id="blockedList" class="blocked-list"></div>
        </section>
      </div>
    `;

    const list = document.getElementById("blockedList");
    const search = document.getElementById("blockedSearchInput");

    const renderRows = (query = "") => {
      const keyword = query.trim().toLowerCase();

      const filtered = blocks.filter((item) => {
        const user = getBlockedUser(item);

        const text =
          `${blockName(user)} ${user?.username || ""}`
            .toLowerCase();

        return !keyword || text.includes(keyword);
      });

      list.replaceChildren();

      if (!filtered.length) {
        renderBlockedEmpty(
          list,
          keyword ? "Không tìm thấy" : "Chưa chặn ai",
          keyword
            ? "Không có tài khoản nào khớp với từ khóa."
            : "Các tài khoản bạn chặn sẽ xuất hiện ở đây."
        );

        return;
      }

      for (const item of filtered) {
        const user = getBlockedUser(item);
        const userId = user?._id || user?.id || item?.blockedUserId || "";

        const row = document.createElement("div");
        row.className = "blocked-user-row";

        row.innerHTML = `
          <div class="blocked-avatar">
            ${blockEscape(blockInitials(user))}
          </div>

          <div class="blocked-user-info">
            <strong>
              ${blockEscape(blockName(user))}
            </strong>

            <span>
              @${blockEscape(user?.username || "user")}
            </span>
          </div>

          <button
            type="button"
            class="blocked-unblock-btn"
          >
            Bỏ chặn
          </button>
        `;

        const button =
          row.querySelector(".blocked-unblock-btn");

        button?.addEventListener("click", async () => {
          if (!userId) return;

          try {
            button.disabled = true;
            button.textContent = "Đang bỏ chặn...";

            await blockApi(
              `/api/blocks/${encodeURIComponent(userId)}`,
              {
                method: "DELETE"
              }
            );

            row.classList.add("removing");

            setTimeout(() => {
              openBlockedPageModern();
            }, 150);
          } catch (error) {
            button.disabled = false;
            button.textContent = "Bỏ chặn";
            alert(error.message);
          }
        });

        list.appendChild(row);
      }
    };

    search?.addEventListener("input", (event) => {
      renderRows(event.target.value);
    });

    renderRows();
  } catch (error) {
    const card = content.querySelector(".blocked-card") || content;

    renderBlockedEmpty(
      card,
      "Không tải được danh sách chặn",
      error.message
    );
  }
}

function bindBlockedUi() {
  const button = document.getElementById("navBlocked");

  button?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      openBlockedPageModern();
    },
    true
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    bindBlockedUi
  );
} else {
  bindBlockedUi();
}