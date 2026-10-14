const PROFILE_API_BASE =
  window.location.protocol === "file:"
    ? "http://localhost:3000"
    : window.location.port === "3000"
      ? window.location.origin
      : `${window.location.protocol}//${window.location.hostname}:3000`;

async function profileApi(path, options = {}) {
  const response = await fetch(`${PROFILE_API_BASE}${path}`, {
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

function profileEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function profileDisplayName(user = {}) {
  return (
    user.displayName ||
    user.username ||
    "Người dùng"
  );
}

function profileInitials(user = {}) {
  const value =
    profileDisplayName(user).trim();

  if (!value) return "?";

  const parts =
    value.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    `${parts[0][0] || ""}${parts.at(-1)?.[0] || ""}`
      .toUpperCase()
  );
}

function formatProfileDate(value) {
  if (!value) return "Chưa có";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa có";
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(date);
}

function getProfileFeatureElements() {
  return {
    app:
      document.querySelector(".app-shell"),

    page:
      document.getElementById("featurePage"),

    title:
      document.getElementById("featureTitle"),

    description:
      document.getElementById(
        "featureDescription"
      ),

    toolbar:
      document.querySelector(
        "#featurePage .feature-toolbar"
      ),

    content:
      document.getElementById(
        "featureContent"
      )
  };
}

function profileSetRailActive() {
  document
    .querySelectorAll(
      ".main-rail .rail-icon"
    )
    .forEach(button => {
      button.classList.remove("active");
    });
}

function updateMainProfileIdentity(user) {
  const meAvatar =
    document.getElementById("meAvatar");

  const meDisplayName =
    document.getElementById(
      "meDisplayName"
    );

  if (meAvatar) {
    meAvatar.textContent =
      profileInitials(user);
  }

  if (meDisplayName) {
    meDisplayName.textContent =
      profileDisplayName(user);
  }
}

function renderProfileLoading(content) {
  content.innerHTML = `
    <div class="profile-loading-state">
      <div class="profile-spinner"></div>
      <span>Đang tải hồ sơ...</span>
    </div>
  `;
}

function renderProfileError(
  content,
  message
) {
  content.innerHTML = `
    <div class="profile-empty-state">
      <div class="profile-empty-symbol">!</div>

      <h3>
        Không tải được hồ sơ
      </h3>

      <p>
        ${profileEscape(message)}
      </p>
    </div>
  `;
}

async function loadProfileData() {
  const authBody =
    await profileApi("/api/auth/me");

  let user =
    authBody?.user ||
    authBody ||
    {};

  try {
    const profileBody =
      await profileApi("/api/profile");

    user = {
      ...user,
      ...(profileBody?.user ||
          profileBody ||
          {})
    };
  } catch {
    // /api/auth/me đã đủ để vẫn mở được hồ sơ.
  }

  return user;
}

function buildProfilePage(user) {
  const roleText =
    user.role === "admin"
      ? "Quản trị viên"
      : "Người dùng";

  return `
    <div class="profile-page-shell">

      <section class="profile-hero-card">

        <div class="profile-hero-avatar">
          ${profileEscape(
            profileInitials(user)
          )}
        </div>

        <div class="profile-hero-copy">
          <h2>
            ${profileEscape(
              profileDisplayName(user)
            )}
          </h2>

          <p>
            @${profileEscape(
              user.username || "user"
            )}
          </p>

          <div class="profile-status-pill">
            <span></span>
            Tài khoản đang hoạt động
          </div>
        </div>

      </section>


      <div class="profile-layout">

        <aside class="profile-menu-card">

          <button
            type="button"
            class="profile-menu-item active"
            data-profile-tab="personal"
          >
            <span class="profile-menu-icon">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M4 21a8 8 0 0 1 16 0"></path>
              </svg>
            </span>

            <span>
              <strong>Thông tin cá nhân</strong>
              <small>Hồ sơ tài khoản</small>
            </span>
          </button>


          <button
            type="button"
            class="profile-menu-item"
            data-profile-tab="account"
          >
            <span class="profile-menu-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path>
              </svg>
            </span>

            <span>
              <strong>Tài khoản</strong>
              <small>Thông tin hệ thống</small>
            </span>
          </button>

        </aside>


        <section
          class="profile-content-card"
          id="profileTabContent"
        ></section>

      </div>

    </div>
  `;
}

function renderPersonalProfileTab(
  container,
  user
) {
  container.innerHTML = `
    <div class="profile-card-heading">
      <div>
        <h2>Thông tin cá nhân</h2>
        <p>
          Cập nhật tên hiển thị của bạn
        </p>
      </div>
    </div>


    <form
      id="profilePersonalForm"
      class="profile-form"
    >

      <div class="profile-field">
        <label>
          Tên đăng nhập
        </label>

        <div class="profile-static-field">
          @${profileEscape(
            user.username || ""
          )}
        </div>

        <small>
          Tên đăng nhập không thể thay đổi.
        </small>
      </div>


      <div class="profile-field">
        <label for="profileDisplayNameInput">
          Tên hiển thị
        </label>

        <input
          id="profileDisplayNameInput"
          type="text"
          maxlength="50"
          value="${profileEscape(
            user.displayName ||
            user.username ||
            ""
          )}"
          placeholder="Nhập tên hiển thị"
        >
      </div>


      <div class="profile-field">
        <label>
          Email
        </label>

        <div class="profile-static-field">
          ${profileEscape(
            user.email ||
            "Chưa có thông tin"
          )}
        </div>
      </div>


      <div class="profile-form-footer">
        <p
          id="profileSaveMessage"
          class="profile-save-message"
        ></p>

        <button
          id="profileSaveButton"
          class="profile-save-button"
          type="submit"
        >
          Lưu thay đổi
        </button>
      </div>

    </form>
  `;

  const form =
    container.querySelector(
      "#profilePersonalForm"
    );

  const input =
    container.querySelector(
      "#profileDisplayNameInput"
    );

  const message =
    container.querySelector(
      "#profileSaveMessage"
    );

  const button =
    container.querySelector(
      "#profileSaveButton"
    );

  form?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      const displayName =
        input?.value.trim() || "";

      if (!displayName) {
        message.textContent =
          "Tên hiển thị không được để trống.";

        message.className =
          "profile-save-message error";

        return;
      }

      try {
        button.disabled = true;
        button.textContent =
          "Đang lưu...";

        const body =
          await profileApi(
            "/api/profile",
            {
              method: "PATCH",
              body:
                JSON.stringify({
                  displayName
                })
            }
          );

        const updatedUser = {
          ...user,
          ...(body?.user || {}),
          displayName
        };

        Object.assign(
          user,
          updatedUser
        );

        updateMainProfileIdentity(
          user
        );

        const heroName =
          document.querySelector(
            ".profile-hero-copy h2"
          );

        const heroAvatar =
          document.querySelector(
            ".profile-hero-avatar"
          );

        if (heroName) {
          heroName.textContent =
            profileDisplayName(user);
        }

        if (heroAvatar) {
          heroAvatar.textContent =
            profileInitials(user);
        }

        message.textContent =
          "Đã lưu thay đổi.";

        message.className =
          "profile-save-message success";

        button.textContent =
          "Đã lưu";

        window.setTimeout(
          () => {
            button.textContent =
              "Lưu thay đổi";
          },
          1000
        );
      } catch (error) {
        message.textContent =
          error.message;

        message.className =
          "profile-save-message error";

        button.textContent =
          "Lưu thay đổi";
      } finally {
        button.disabled = false;
      }
    }
  );
}

function renderAccountProfileTab(
  container,
  user
) {
  container.innerHTML = `
    <div class="profile-card-heading">
      <div>
        <h2>Thông tin tài khoản</h2>
        <p>
          Chi tiết tài khoản SecureChat
        </p>
      </div>
    </div>


    <div class="profile-account-list">

      <div class="profile-account-row">
        <span>ID tài khoản</span>

        <strong>
          ${profileEscape(
            user._id ||
            user.id ||
            "Không xác định"
          )}
        </strong>
      </div>


      <div class="profile-account-row">
        <span>Vai trò</span>

        <strong>
          ${
            user.role === "admin"
              ? "Quản trị viên"
              : "Người dùng"
          }
        </strong>
      </div>


      <div class="profile-account-row">
        <span>Ngày tạo</span>

        <strong>
          ${profileEscape(
            formatProfileDate(
              user.createdAt
            )
          )}
        </strong>
      </div>


      <div class="profile-account-row">
        <span>Bảo vệ tin nhắn</span>

        <strong class="profile-secure-text">
          AES-GCM / DES-CBC
        </strong>
      </div>

    </div>


    <div class="profile-security-note">
      <div class="profile-security-icon">
        <svg viewBox="0 0 24 24">
          <rect x="5" y="10" width="14" height="10" rx="2"></rect>
          <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
        </svg>
      </div>

      <div>
        <strong>
          Tin nhắn được mã hóa trước khi gửi
        </strong>

        <p>
          SecureChat ưu tiên AES-GCM.
          DES-CBC chỉ phục vụ học tập và so sánh thuật toán.
        </p>
      </div>
    </div>
  `;
}

function bindProfileTabs(user) {
  const content =
    document.getElementById(
      "profileTabContent"
    );

  if (!content) return;

  const buttons =
    document.querySelectorAll(
      "[data-profile-tab]"
    );

  const activate =
    tab => {
      buttons.forEach(
        button => {
          button.classList.toggle(
            "active",
            button.dataset.profileTab ===
              tab
          );
        }
      );

      if (tab === "account") {
        renderAccountProfileTab(
          content,
          user
        );
      } else {
        renderPersonalProfileTab(
          content,
          user
        );
      }
    };

  buttons.forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          activate(
            button.dataset.profileTab
          );
        }
      );
    }
  );

  activate("personal");
}

async function openProfileUi() {
  const {
    app,
    page,
    title,
    description,
    toolbar,
    content
  } =
    getProfileFeatureElements();

  if (!page || !content) return;

  app?.classList.add(
    "feature-mode"
  );

  page.hidden = false;

  if (title) {
    title.textContent =
      "Hồ sơ cá nhân";
  }

  if (description) {
    description.textContent =
      "Quản lý thông tin và tài khoản của bạn";
  }

  if (toolbar) {
    toolbar.style.display =
      "none";
  }

  profileSetRailActive();
  renderProfileLoading(content);

  try {
    const user =
      await loadProfileData();

    content.innerHTML =
      buildProfilePage(user);

    bindProfileTabs(user);

    updateMainProfileIdentity(
      user
    );
  } catch (error) {
    renderProfileError(
      content,
      error.message
    );
  }
}

function bindProfileUi() {
  const button =
    document.getElementById(
      "btnProfile"
    );

  button?.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      openProfileUi();
    },
    true
  );
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    bindProfileUi
  );
} else {
  bindProfileUi();
}