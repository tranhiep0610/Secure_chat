// ========================================
// SECURE CHAT - AUTH
// Đăng ký / Đăng nhập với Backend thật
// ========================================


// ========================================
// 1. CẤU HÌNH BACKEND
// ========================================

// Nếu frontend là:
// http://127.0.0.1:5500
//
// thì backend sẽ là:
// http://127.0.0.1:3000
//
// Dùng cùng hostname để session cookie hoạt động ổn định.

const API_BASE_URL =
    window.location.protocol === "file:"
        ? "http://127.0.0.1:3000"
        : `${window.location.protocol}//${window.location.hostname}:3000`;


// ========================================
// 2. LẤY CÁC PHẦN TỬ HTML
// ========================================

const loginForm =
    document.getElementById("loginForm");

const registerForm =
    document.getElementById("registerForm");

const messageElement =
    document.getElementById("message");


// ========================================
// 3. HIỂN THỊ THÔNG BÁO
// ========================================

function showMessage(message, type = "") {

    if (!messageElement) {
        return;
    }

    messageElement.textContent =
        message;

    messageElement.className =
        "form-message";

    if (type) {
        messageElement.classList.add(type);
    }
}


// ========================================
// 4. GỌI API
// ========================================

async function apiRequest(
    path,
    options = {}
) {

    const response =
        await fetch(
            `${API_BASE_URL}${path}`,
            {
                credentials: "include",

                headers: {
                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})
                },

                ...options
            }
        );


    let data = null;


    try {

        data =
            await response.json();

    } catch {

        data = null;

    }


    if (!response.ok) {

        throw new Error(
            data?.message ||
            `Yêu cầu thất bại (${response.status})`
        );

    }


    return data;
}


// ========================================
// 5. XỬ LÝ ĐĂNG KÝ
// ========================================

if (registerForm) {

    registerForm.addEventListener(
        "submit",

        async function (event) {

            event.preventDefault();


            // ----------------------------------------
            // LẤY USERNAME
            // ----------------------------------------

            const usernameInput =
                document.getElementById(
                    "registerUsername"
                );


            const username =
                usernameInput
                    ?.value
                    .trim() || "";


            // ----------------------------------------
            // DISPLAY NAME
            //
            // Nếu HTML có ô registerDisplayName
            // thì lấy từ đó.
            //
            // Nếu chưa có thì lấy username làm
            // displayName để vẫn chạy được backend.
            // ----------------------------------------

            const displayNameInput =
                document.getElementById(
                    "registerDisplayName"
                ) ||
                document.getElementById(
                    "displayName"
                );


            const displayName =
                displayNameInput
                    ?.value
                    .trim() ||
                username;


            // ----------------------------------------
            // PASSWORD
            // ----------------------------------------

            const password =
                document
                    .getElementById(
                        "registerPassword"
                    )
                    ?.value || "";


            const confirmPassword =
                document
                    .getElementById(
                        "confirmPassword"
                    )
                    ?.value || "";


            // ========================================
            // VALIDATE USERNAME
            // Backend yêu cầu:
            // 3 - 32 ký tự
            // chữ, số, ., _, -
            // ========================================

            const usernameRegex =
                /^[a-zA-Z0-9._-]{3,32}$/;


            if (
                !usernameRegex.test(
                    username
                )
            ) {

                showMessage(
                    "Tên đăng nhập phải dài 3-32 ký tự và chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.",
                    "error"
                );

                return;
            }


            // ========================================
            // VALIDATE DISPLAY NAME
            // ========================================

            if (!displayName) {

                showMessage(
                    "Tên hiển thị không được để trống.",
                    "error"
                );

                return;
            }


            if (
                displayName.length > 50
            ) {

                showMessage(
                    "Tên hiển thị tối đa 50 ký tự.",
                    "error"
                );

                return;
            }


            // ========================================
            // VALIDATE PASSWORD
            // Backend yêu cầu tối thiểu 8 ký tự
            // ========================================

            if (
                password.length < 8
            ) {

                showMessage(
                    "Mật khẩu phải có ít nhất 8 ký tự.",
                    "error"
                );

                return;
            }


            if (
                password.length > 128
            ) {

                showMessage(
                    "Mật khẩu tối đa 128 ký tự.",
                    "error"
                );

                return;
            }


            // ========================================
            // CONFIRM PASSWORD
            // ========================================

            if (
                confirmPassword &&
                password !==
                confirmPassword
            ) {

                showMessage(
                    "Mật khẩu nhập lại không khớp.",
                    "error"
                );

                return;
            }


            try {

                showMessage(
                    "Đang tạo tài khoản...",
                    ""
                );


                // ====================================
                // GỬI BACKEND
                // ====================================

                const data =
                    await apiRequest(
                        "/api/auth/register",
                        {
                            method: "POST",

                            body:
                                JSON.stringify({
                                    username,
                                    displayName,
                                    password
                                })
                        }
                    );


                console.log(
                    "Register:",
                    data
                );


                showMessage(
                    "Đăng ký thành công! Đang chuyển đến đăng nhập...",
                    "success"
                );


                // ====================================
                // CHUYỂN VỀ LOGIN
                // ====================================

                setTimeout(
                    function () {

                        window.location.href =
                            "./index.html";

                    },

                    700
                );


            } catch (error) {

                console.error(
                    "Register error:",
                    error
                );


                showMessage(
                    error.message,
                    "error"
                );

            }

        }
    );
}


// ========================================
// 6. XỬ LÝ ĐĂNG NHẬP
// ========================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",

        async function (event) {

            event.preventDefault();


            const username =
                document
                    .getElementById(
                        "loginUsername"
                    )
                    ?.value
                    .trim() || "";


            const password =
                document
                    .getElementById(
                        "loginPassword"
                    )
                    ?.value || "";


            // ========================================
            // KIỂM TRA CƠ BẢN
            // ========================================

            if (!username) {

                showMessage(
                    "Vui lòng nhập tên đăng nhập.",
                    "error"
                );

                return;
            }


            if (!password) {

                showMessage(
                    "Vui lòng nhập mật khẩu.",
                    "error"
                );

                return;
            }


            try {

                showMessage(
                    "Đang đăng nhập...",
                    ""
                );


                // ====================================
                // LOGIN BACKEND
                // ====================================

                const data =
                    await apiRequest(
                        "/api/auth/login",
                        {
                            method: "POST",

                            body:
                                JSON.stringify({
                                    username,
                                    password
                                })
                        }
                    );


                console.log(
                    "Login:",
                    data
                );


                showMessage(
                    "Đăng nhập thành công!",
                    "success"
                );


                // ====================================
                // CHUYỂN SANG CHAT
                // ====================================

                window.location.href =
                    "./chat.html";


            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );


                showMessage(
                    error.message,
                    "error"
                );

            }

        }
    );
}