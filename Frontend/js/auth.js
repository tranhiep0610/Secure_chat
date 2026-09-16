// ========================================
// SECURE CHAT - AUTH PROTOTYPE
// Phần giao diện đăng ký / đăng nhập
// ========================================


// ========================================
// 1. LẤY CÁC PHẦN TỬ HTML
// ========================================

const loginForm =
    document.getElementById("loginForm");

const registerForm =
    document.getElementById("registerForm");

const messageElement =
    document.getElementById("message");


// ========================================
// 2. HIỂN THỊ THÔNG BÁO
// ========================================

function showMessage(message, type) {

    if (!messageElement) {
        return;
    }


    messageElement.textContent =
        message;


    messageElement.className =
        "form-message " + type;
}


// ========================================
// 3. LẤY DANH SÁCH TÀI KHOẢN DEMO
// ========================================

function getUsers() {

    const data =
        localStorage.getItem(
            "secureChatDemoUsers"
        );


    if (!data) {
        return [];
    }


    try {

        return JSON.parse(data);

    }

    catch (error) {

        return [];

    }
}


// ========================================
// 4. LƯU DANH SÁCH TÀI KHOẢN DEMO
// ========================================

function saveUsers(users) {

    localStorage.setItem(
        "secureChatDemoUsers",
        JSON.stringify(users)
    );

}


// ========================================
// 5. XỬ LÝ ĐĂNG KÝ
// ========================================

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const username =
                document
                    .getElementById(
                        "registerUsername"
                    )
                    .value
                    .trim();


            const password =
                document
                    .getElementById(
                        "registerPassword"
                    )
                    .value;


            const confirmPassword =
                document
                    .getElementById(
                        "confirmPassword"
                    )
                    .value;


            // Kiểm tra tên đăng nhập
            if (username.length < 3) {

                showMessage(
                    "Tên đăng nhập phải có ít nhất 3 ký tự.",
                    "error"
                );

                return;
            }


            // Kiểm tra mật khẩu
            if (password.length < 6) {

                showMessage(
                    "Mật khẩu phải có ít nhất 6 ký tự.",
                    "error"
                );

                return;
            }


            // Kiểm tra xác nhận mật khẩu
            if (
                password
                !==
                confirmPassword
            ) {

                showMessage(
                    "Mật khẩu nhập lại không khớp.",
                    "error"
                );

                return;
            }


            const users =
                getUsers();


            // Kiểm tra username đã tồn tại
            const existedUser =
                users.find(
                    function (user) {

                        return (
                            user.username
                                .toLowerCase()

                            ===

                            username
                                .toLowerCase()
                        );

                    }
                );


            if (existedUser) {

                showMessage(
                    "Tên đăng nhập đã tồn tại.",
                    "error"
                );

                return;
            }


            // Tài khoản demo
            const newUser = {

                username: username,

                password: password

            };


            users.push(newUser);


            saveUsers(users);


            showMessage(
                "Đăng ký thành công! Đang chuyển đến đăng nhập...",
                "success"
            );


            setTimeout(
                function () {

                    window.location.href =
                        "./index.html";

                },

                900
            );

        }
    );

}


// ========================================
// 6. XỬ LÝ ĐĂNG NHẬP
// ========================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const username =
                document
                    .getElementById(
                        "loginUsername"
                    )
                    .value
                    .trim();


            const password =
                document
                    .getElementById(
                        "loginPassword"
                    )
                    .value;


            const users =
                getUsers();


            // Tìm tài khoản
            const foundUser =
                users.find(
                    function (user) {

                        return (

                            user.username
                                .toLowerCase()

                            ===

                            username
                                .toLowerCase()

                            &&

                            user.password
                            ===
                            password

                        );

                    }
                );


            // Sai tài khoản
            if (!foundUser) {

                showMessage(
                    "Tên đăng nhập hoặc mật khẩu không đúng.",
                    "error"
                );

                return;
            }


            // Đăng nhập thành công
            showMessage(
                "Đăng nhập thành công!",
                "success"
            );


            /*
                Prototype hiện tại dừng ở đây.

                Khi Công hoàn thành backend:
                - gửi username/password lên API
                - backend kiểm tra tài khoản
                - nhận token / session
                - sau đó chuyển sang trang chat

                Không xử lý backend trong phần này.
            */

        }
    );

}