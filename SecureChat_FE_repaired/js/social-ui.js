const IS_LOCAL =
    ["127.0.0.1", "localhost"].includes(
        window.location.hostname
    );

const API_BASE_URL =
    IS_LOCAL && window.location.port !== "3000"
        ? "http://127.0.0.1:3000"
        : window.location.origin;

// const API_BASE_URL =
//     window.location.protocol === "file:"
//         ? "http://localhost:3000"
//         : window.location.port === "3000"
//             ? window.location.origin
//             : `${window.location.protocol}//${window.location.hostname}:3000`;

const socialState = {
    me: null,
    activeTab: "friends"
};

let addFriendSearchTimer = null;


// ============================================================
// API
// ============================================================

async function socialApi(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
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


// ============================================================
// HELPERS
// ============================================================

function socialEscape(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function socialName(user = {}) {
    return user.displayName || user.username || "Người dùng";
}

function socialInitials(user = {}) {
    const name = socialName(user).trim();

    if (!name) {
        return "?";
    }

    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ""}${parts.at(-1)?.[0] || ""}`.toUpperCase();
}

function socialUserId(user = {}) {
    return String(user?._id || user?.id || "");
}

function getFeatureElements() {
    return {
        app: document.querySelector(".app-shell"),
        page: document.getElementById("featurePage"),
        title: document.getElementById("featureTitle"),
        description: document.getElementById("featureDescription"),
        toolbar: document.querySelector("#featurePage .feature-toolbar"),
        content: document.getElementById("featureContent")
    };
}

function setSocialRailActive(id) {
    document
        .querySelectorAll(".main-rail .rail-icon")
        .forEach((button) => {
            button.classList.toggle(
                "active",
                button.id === id
            );
        });
}

function openFeaturePageShell(
    title,
    description,
    activeId
) {
    const {
        app,
        page,
        title: titleEl,
        description: descriptionEl,
        toolbar
    } = getFeatureElements();

    app?.classList.add("feature-mode");

    if (!page) {
        console.error(
            "[social-ui] Không tìm thấy #featurePage"
        );
        return false;
    }

    page.hidden = false;

    if (titleEl) {
        titleEl.textContent = title;
    }

    if (descriptionEl) {
        descriptionEl.textContent = description;
    }

    if (toolbar) {
        toolbar.style.display = "none";
    }

    setSocialRailActive(activeId);

    return true;
}

function normalizeList(body, possibleKeys = []) {
    if (Array.isArray(body)) {
        return body;
    }

    for (const key of possibleKeys) {
        if (Array.isArray(body?.[key])) {
            return body[key];
        }
    }

    return [];
}

function getItemUser(item) {
    return (
        item?.user ||
        item?.friend ||
        item?.requester ||
        item?.recipient ||
        item?.targetUser ||
        item?.requestedByUser ||
        item?.otherUser ||
        null
    );
}

function getItemId(item) {
    return (
        item?.friendshipId ||
        item?._id ||
        item?.id ||
        ""
    );
}


// ============================================================
// BASIC RENDER
// ============================================================

function renderLoading(
    content,
    text = "Đang tải dữ liệu..."
) {
    if (!content) {
        return;
    }

    content.innerHTML = `
        <div class="social-state">
            <div class="social-spinner"></div>
            <p>${socialEscape(text)}</p>
        </div>
    `;
}

function renderEmpty(
    content,
    title,
    description
) {
    if (!content) {
        return;
    }

    content.innerHTML = `
        <div class="social-state social-empty">
            <div class="social-empty-icon">
                <svg viewBox="0 0 24 24">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M19 8v6"></path>
                    <path d="M16 11h6"></path>
                </svg>
            </div>
            <h3>${socialEscape(title)}</h3>
            <p>${socialEscape(description)}</p>
        </div>
    `;
}


// ============================================================
// FRIEND ROW
// ============================================================

function socialUserRow(
    item,
    mode = "friends"
) {
    const user =
        getItemUser(item) ||
        item;

    const friendshipId =
        getItemId(item);

    const userId =
        socialUserId(user);

    const row =
        document.createElement("div");

    row.className =
        "social-user-row";

    row.innerHTML = `
        <div class="social-avatar">
            ${socialEscape(
                socialInitials(user)
            )}
        </div>

        <div class="social-user-main">
            <strong>
                ${socialEscape(
                    socialName(user)
                )}
            </strong>
            <span>
                @${socialEscape(
                    user?.username ||
                    "user"
                )}
            </span>
        </div>

        <div class="social-row-actions"></div>
    `;

    const actions =
        row.querySelector(
            ".social-row-actions"
        );

    const makeButton = (
        text,
        className,
        onClick
    ) => {
        const button =
            document.createElement(
                "button"
            );

        button.type = "button";
        button.className =
            `social-action ${className || ""}`.trim();
        button.textContent = text;

        button.addEventListener(
            "click",
            onClick
        );

        actions?.appendChild(button);

        return button;
    };


    // --------------------------------------------------------
    // FRIENDS
    // --------------------------------------------------------

    if (mode === "friends") {
        makeButton(
            "Nhắn tin",
            "is-primary",
            () => {
                document
                    .getElementById(
                        "navMessages"
                    )
                    ?.click();

                setTimeout(() => {
                    const candidates = [
                        ...document.querySelectorAll(
                            "#userList > *"
                        )
                    ];

                    const username =
                        String(
                            user?.username ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    const target =
                        candidates.find(
                            (element) => {
                                const text =
                                    String(
                                        element.textContent ||
                                        ""
                                    )
                                        .toLowerCase();

                                return (
                                    username &&
                                    text.includes(
                                        username
                                    )
                                );
                            }
                        );

                    target?.click();
                }, 150);
            }
        );

        makeButton(
            "Hủy kết bạn",
            "",
            async (event) => {
                const button =
                    event.currentTarget;

                if (!friendshipId) {
                    alert(
                        "Không tìm thấy ID quan hệ bạn bè."
                    );
                    return;
                }

                try {
                    button.disabled = true;
                    button.textContent =
                        "Đang xử lý...";

                    await socialApi(
                        `/api/friends/${encodeURIComponent(friendshipId)}`,
                        {
                            method: "DELETE"
                        }
                    );

                    await openSocialFriendsPage(
                        "friends"
                    );
                } catch (error) {
                    button.disabled = false;
                    button.textContent =
                        "Hủy kết bạn";

                    alert(error.message);
                }
            }
        );

        makeButton(
            "Chặn",
            "is-danger",
            async (event) => {
                const button =
                    event.currentTarget;

                if (!userId) {
                    alert(
                        "Không tìm thấy ID người dùng."
                    );
                    return;
                }

                try {
                    button.disabled = true;
                    button.textContent =
                        "Đang chặn...";

                    await socialApi(
                        "/api/blocks",
                        {
                            method: "POST",
                            body:
                                JSON.stringify({
                                    targetUserId:
                                        userId
                                })
                        }
                    );

                    await openSocialFriendsPage(
                        "friends"
                    );
                } catch (error) {
                    button.disabled = false;
                    button.textContent =
                        "Chặn";

                    alert(error.message);
                }
            }
        );
    }


    // --------------------------------------------------------
    // INCOMING REQUEST
    // --------------------------------------------------------

    if (mode === "incoming") {
        makeButton(
            "Chấp nhận",
            "is-primary",
            async (event) => {
                const button =
                    event.currentTarget;

                if (!friendshipId) {
                    return;
                }

                try {
                    button.disabled = true;
                    button.textContent =
                        "Đang xử lý...";

                    await socialApi(
                        `/api/friends/${encodeURIComponent(friendshipId)}/accept`,
                        {
                            method: "POST"
                        }
                    );

                    await openSocialFriendsPage(
                        "incoming"
                    );
                } catch (error) {
                    button.disabled = false;
                    button.textContent =
                        "Chấp nhận";

                    alert(error.message);
                }
            }
        );

        makeButton(
            "Từ chối",
            "",
            async (event) => {
                const button =
                    event.currentTarget;

                if (!friendshipId) {
                    return;
                }

                try {
                    button.disabled = true;
                    button.textContent =
                        "Đang xử lý...";

                    await socialApi(
                        `/api/friends/${encodeURIComponent(friendshipId)}/reject`,
                        {
                            method: "POST"
                        }
                    );

                    await openSocialFriendsPage(
                        "incoming"
                    );
                } catch (error) {
                    button.disabled = false;
                    button.textContent =
                        "Từ chối";

                    alert(error.message);
                }
            }
        );
    }


    // --------------------------------------------------------
    // OUTGOING REQUEST
    // --------------------------------------------------------

    if (mode === "outgoing") {
        makeButton(
            "Hủy lời mời",
            "",
            async (event) => {
                const button =
                    event.currentTarget;

                if (!friendshipId) {
                    return;
                }

                try {
                    button.disabled = true;
                    button.textContent =
                        "Đang xử lý...";

                    await socialApi(
                        `/api/friends/${encodeURIComponent(friendshipId)}/cancel`,
                        {
                            method: "DELETE"
                        }
                    );

                    await openSocialFriendsPage(
                        "outgoing"
                    );
                } catch (error) {
                    button.disabled = false;
                    button.textContent =
                        "Hủy lời mời";

                    alert(error.message);
                }
            }
        );
    }

    return row;
}


// ============================================================
// FRIEND TABS
// ============================================================

async function fetchSocialTab(tab) {
    if (tab === "friends") {
        const body =
            await socialApi(
                "/api/friends"
            );

        return normalizeList(
            body,
            [
                "friends",
                "data"
            ]
        );
    }

    if (tab === "incoming") {
        const body =
            await socialApi(
                "/api/friends/requests/incoming"
            );

        return normalizeList(
            body,
            [
                "requests",
                "incoming",
                "data"
            ]
        );
    }

    const body =
        await socialApi(
            "/api/friends/requests/outgoing"
        );

    return normalizeList(
        body,
        [
            "requests",
            "outgoing",
            "data"
        ]
    );
}

function tabTitle(
    tab,
    count
) {
    if (tab === "friends") {
        return `Danh sách bạn bè (${count})`;
    }

    if (tab === "incoming") {
        return `Lời mời kết bạn (${count})`;
    }

    return `Đã gửi lời mời (${count})`;
}

function renderSocialTabs(
    content,
    activeTab
) {
    const tabs =
        document.createElement(
            "div"
        );

    tabs.className =
        "social-tabs";

    const definitions = [
        [
            "friends",
            "Danh sách bạn bè"
        ],
        [
            "incoming",
            "Lời mời kết bạn"
        ],
        [
            "outgoing",
            "Đã gửi lời mời"
        ]
    ];

    for (
        const [
            id,
            label
        ] of definitions
    ) {
        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            `social-tab ${activeTab === id ? "active" : ""}`;

        button.textContent =
            label;

        button.addEventListener(
            "click",
            () => {
                openSocialFriendsPage(
                    id
                );
            }
        );

        tabs.appendChild(
            button
        );
    }

    content.appendChild(
        tabs
    );
}


// ============================================================
// FRIEND PAGE
// ============================================================

async function openSocialFriendsPage(
    tab = "friends"
) {
    socialState.activeTab =
        tab;

    const activeId =
        tab === "friends"
            ? "navFriends"
            : "navRequests";

    if (
        !openFeaturePageShell(
            "Bạn bè",
            "Quản lý bạn bè và lời mời kết bạn",
            activeId
        )
    ) {
        return;
    }

    const {
        content
    } = getFeatureElements();

    if (!content) {
        return;
    }

    content.innerHTML = "";

    renderSocialTabs(
        content,
        tab
    );

    const body =
        document.createElement(
            "div"
        );

    body.className =
        "social-page-body";

    content.appendChild(
        body
    );

    renderLoading(body);

    try {
        const items =
            await fetchSocialTab(
                tab
            );

        body.innerHTML = `
            <div class="social-list-head">
                <strong>
                    ${socialEscape(
                        tabTitle(
                            tab,
                            items.length
                        )
                    )}
                </strong>

                <div class="social-list-tools">
                    <div class="social-search-box">
                        <svg viewBox="0 0 24 24">
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                            ></circle>
                            <path
                                d="M20 20l-3.8-3.8"
                            ></path>
                        </svg>

                        <input
                            type="search"
                            class="social-list-search"
                            placeholder="Tìm kiếm"
                            autocomplete="off"
                        >
                    </div>

                    ${
                        tab === "friends"
                            ? `
                                <button
                                    id="socialAddFriendButton"
                                    class="social-add-button"
                                    type="button"
                                >
                                    + Thêm bạn
                                </button>
                            `
                            : ""
                    }
                </div>
            </div>

            <div class="social-list"></div>
        `;

        const list =
            body.querySelector(
                ".social-list"
            );

        const search =
            body.querySelector(
                ".social-list-search"
            );

        const renderRows = (
            query = ""
        ) => {
            const keyword =
                String(query)
                    .trim()
                    .toLowerCase();

            const filtered =
                items.filter(
                    (item) => {
                        const user =
                            getItemUser(item) ||
                            item;

                        const text =
                            `${socialName(user)} ${user?.username || ""}`
                                .toLowerCase();

                        return (
                            !keyword ||
                            text.includes(
                                keyword
                            )
                        );
                    }
                );

            list?.replaceChildren();

            if (!filtered.length) {
                const title =
                    tab === "friends"
                        ? "Chưa có bạn bè"
                        : tab === "incoming"
                            ? "Không có lời mời kết bạn"
                            : "Chưa gửi lời mời nào";

                const description =
                    keyword
                        ? "Không có kết quả phù hợp với từ khóa."
                        : tab === "friends"
                            ? "Thêm bạn để bắt đầu trò chuyện an toàn."
                            : "Danh sách hiện đang trống.";

                renderEmpty(
                    list,
                    title,
                    description
                );

                return;
            }

            for (
                const item of filtered
            ) {
                list?.appendChild(
                    socialUserRow(
                        item,
                        tab
                    )
                );
            }
        };

        search?.addEventListener(
            "input",
            (event) => {
                renderRows(
                    event.target.value
                );
            }
        );

        body
            .querySelector(
                "#socialAddFriendButton"
            )
            ?.addEventListener(
                "click",
                openAddFriendModal
            );

        renderRows();
    } catch (error) {
        console.error(
            "[social-ui] Load social page error:",
            error
        );

        renderEmpty(
            body,
            "Không tải được dữ liệu",
            error.message ||
            "Có lỗi xảy ra."
        );
    }
}


// ============================================================
// CURRENT USER
// ============================================================

async function loadSocialMe(
    force = false
) {
    if (
        socialState.me &&
        !force
    ) {
        return socialState.me;
    }

    const body =
        await socialApi(
            "/api/auth/me"
        );

    socialState.me =
        body?.user ||
        null;

    return socialState.me;
}


// ============================================================
// ADD FRIEND MODAL
// ============================================================

function ensureAddFriendModal() {
    let modal =
        document.getElementById(
            "addFriendModal"
        );

    // Nếu chat.html hoặc code cũ đã tạo modal này trước đó,
    // xóa modal cũ để tạo lại và gắn event listener sạch.
    if (modal) {
        modal.remove();
        modal = null;
    }

    modal =
        document.createElement(
            "div"
        );

    modal.id =
        "addFriendModal";

    modal.className =
        "secure-modal social-add-modal";

    modal.hidden =
        true;

    modal.innerHTML = `
        <div
            id="addFriendBackdrop"
            class="secure-modal-backdrop"
        ></div>

        <section
            class="secure-modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="addFriendTitle"
        >
            <header class="secure-modal-header">
                <div>
                    <h2 id="addFriendTitle">
                        Thêm bạn bè
                    </h2>
                    <p>
                        Tìm tài khoản và gửi lời mời kết bạn
                    </p>
                </div>

                <button
                    id="btnCloseAddFriend"
                    class="secure-modal-close"
                    type="button"
                    aria-label="Đóng"
                >
                    ×
                </button>
            </header>

            <div class="social-add-search">
                <svg viewBox="0 0 24 24">
                    <circle
                        cx="11"
                        cy="11"
                        r="7"
                    ></circle>
                    <path
                        d="M20 20l-3.8-3.8"
                    ></path>
                </svg>

                <input
                    id="addFriendSearch"
                    type="search"
                    placeholder="Tìm theo username hoặc tên..."
                    autocomplete="off"
                >
            </div>

            <div
                id="addFriendContent"
                class="social-add-results"
            >
                <div class="social-state social-empty">
                    <div class="social-empty-icon">
                        +
                    </div>
                    <h3>
                        Tìm người dùng
                    </h3>
                    <p>
                        Nhập tên hoặc username để tìm tài khoản.
                    </p>
                </div>
            </div>

            <footer class="secure-modal-footer">
                <button
                    id="btnCancelAddFriend"
                    class="modal-btn-secondary"
                    type="button"
                >
                    Đóng
                </button>
            </footer>
        </section>
    `;

    document.body.appendChild(
        modal
    );

    const close =
        () => {
            closeAddFriendModal();
        };

    modal
        .querySelector(
            "#btnCloseAddFriend"
        )
        ?.addEventListener(
            "click",
            close
        );

    modal
        .querySelector(
            "#btnCancelAddFriend"
        )
        ?.addEventListener(
            "click",
            close
        );

    modal
        .querySelector(
            "#addFriendBackdrop"
        )
        ?.addEventListener(
            "click",
            close
        );

    const searchInput =
        modal.querySelector(
            "#addFriendSearch"
        );

    searchInput?.addEventListener(
        "input",
        (event) => {
            clearTimeout(
                addFriendSearchTimer
            );

            const value =
                event.target.value;

            addFriendSearchTimer =
                setTimeout(
                    () => {
                        renderAddFriendSearch(
                            value
                        );
                    },
                    250
                );
        }
    );

    return modal;
}

function closeAddFriendModal() {
    const modal =
        document.getElementById(
            "addFriendModal"
        );

    if (!modal) {
        return;
    }

    clearTimeout(
        addFriendSearchTimer
    );

    modal.hidden =
        true;

    modal.style.display =
        "none";

    document.body.classList.remove(
        "modal-open"
    );
}

async function openAddFriendModal() {
    const modal =
        ensureAddFriendModal();

    const input =
        modal.querySelector(
            "#addFriendSearch"
        );

    const content =
        modal.querySelector(
            "#addFriendContent"
        );

    modal.style.display =
        "";

    modal.hidden =
        false;

    document.body.classList.add(
        "modal-open"
    );

    if (input) {
        input.value = "";
    }

    renderLoading(
        content,
        "Đang tải..."
    );

    try {
        await loadSocialMe(
            true
        );

        renderEmpty(
            content,
            "Tìm người dùng",
            "Nhập tên hoặc username để tìm tài khoản."
        );

        setTimeout(
            () => {
                input?.focus();
            },
            50
        );
    } catch (error) {
        console.error(
            "[social-ui] Open add friend error:",
            error
        );

        renderEmpty(
            content,
            "Không thể mở danh sách người dùng",
            error.message ||
            "Có lỗi xảy ra."
        );
    }
}


// ============================================================
// SEARCH USER FROM BACKEND
// ============================================================

async function renderAddFriendSearch(
    query = ""
) {
    const content =
        document.getElementById(
            "addFriendContent"
        );

    if (!content) {
        return;
    }

    const rawKeyword =
        String(
            query ||
            ""
        ).trim();

    const keyword =
        rawKeyword.toLowerCase();

    if (!keyword) {
        renderEmpty(
            content,
            "Tìm người dùng",
            "Nhập tên hoặc username để tìm tài khoản."
        );

        return;
    }

    renderLoading(
        content,
        "Đang tìm người dùng..."
    );

    try {
        // Gọi lại backend mỗi lần tìm.
        // Không dùng danh sách cache cũ.
        const [
            usersBody,
            me
        ] = await Promise.all([
            socialApi(
                "/api/users"
            ),
            loadSocialMe(
                true
            )
        ]);

        const users =
            normalizeList(
                usersBody,
                [
                    "users",
                    "data"
                ]
            );

        const myId =
            socialUserId(
                me
            );

        const results =
            users
                .filter(
                    (user) => {
                        const userId =
                            socialUserId(
                                user
                            );

                        if (
                            myId &&
                            userId === myId
                        ) {
                            return false;
                        }

                        const username =
                            String(
                                user?.username ||
                                ""
                            )
                                .trim()
                                .toLowerCase();

                        const displayName =
                            String(
                                user?.displayName ||
                                ""
                            )
                                .trim()
                                .toLowerCase();

                        return (
                            username.includes(
                                keyword
                            ) ||
                            displayName.includes(
                                keyword
                            )
                        );
                    }
                )
                .slice(
                    0,
                    20
                );

        content.replaceChildren();

        if (!results.length) {
            renderEmpty(
                content,
                "Không tìm thấy người dùng",
                `Không tìm thấy tài khoản "${rawKeyword}".`
            );

            return;
        }

        for (
            const user of results
        ) {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "social-user-row";

            row.innerHTML = `
                <div class="social-avatar">
                    ${socialEscape(
                        socialInitials(
                            user
                        )
                    )}
                </div>

                <div class="social-user-main">
                    <strong>
                        ${socialEscape(
                            socialName(
                                user
                            )
                        )}
                    </strong>

                    <span>
                        @${socialEscape(
                            user?.username ||
                            "user"
                        )}
                    </span>
                </div>

                <div
                    class="social-row-actions"
                ></div>
            `;

            const actions =
                row.querySelector(
                    ".social-row-actions"
                );

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "social-action is-primary";

            button.textContent =
                "Kết bạn";

            button.addEventListener(
                "click",
                async () => {
                    const targetUserId =
                        socialUserId(
                            user
                        );

                    if (!targetUserId) {
                        alert(
                            "Không tìm thấy ID người dùng."
                        );
                        return;
                    }

                    try {
                        button.disabled =
                            true;

                        button.textContent =
                            "Đang gửi...";

                        await socialApi(
                            "/api/friends/request",
                            {
                                method:
                                    "POST",
                                body:
                                    JSON.stringify({
                                        targetUserId
                                    })
                            }
                        );

                        button.textContent =
                            "Đã gửi";

                        button.classList.remove(
                            "is-primary"
                        );

                        button.classList.add(
                            "is-done"
                        );
                    } catch (error) {
                        console.error(
                            "[social-ui] Send friend request error:",
                            error
                        );

                        button.disabled =
                            false;

                        button.textContent =
                            "Kết bạn";

                        alert(
                            error.message
                        );
                    }
                }
            );

            actions?.appendChild(
                button
            );

            content.appendChild(
                row
            );
        }
    } catch (error) {
        console.error(
            "[social-ui] Search users error:",
            error
        );

        renderEmpty(
            content,
            "Không tìm được người dùng",
            error.message ||
            "Có lỗi khi tải tài khoản."
        );
    }
}


// ============================================================
// BIND UI
// ============================================================

function bindSocialUi() {
    const navFriends =
        document.getElementById(
            "navFriends"
        );

    const navRequests =
        document.getElementById(
            "navRequests"
        );

    const addFriendButton =
        document.getElementById(
            "btnAddFriend"
        );

    navFriends?.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            openSocialFriendsPage(
                "friends"
            );
        },
        true
    );

    navRequests?.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            openSocialFriendsPage(
                "incoming"
            );
        },
        true
    );

    addFriendButton?.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            openAddFriendModal();
        },
        true
    );

    document.addEventListener(
        "keydown",
        (event) => {
            if (
                event.key ===
                "Escape"
            ) {
                closeAddFriendModal();
            }
        }
    );

    console.log(
        "✅ social-ui.js loaded"
    );
}


// ============================================================
// INIT
// ============================================================

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        bindSocialUi
    );
} else {
    bindSocialUi();
}
