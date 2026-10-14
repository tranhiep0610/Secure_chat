const API_BASE =
    window.location.protocol === "file:"
        ? "http://localhost:3000"
        : window.location.port === "3000"
            ? window.location.origin
            : `${window.location.protocol}//${window.location.hostname}:3000`;


async function api(
    path,
    options = {}
) {

    const response =
        await fetch(
            `${API_BASE}${path}`,
            {
                credentials:
                    "include",

                headers: {
                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})
                },

                ...options
            }
        );


    let body =
        null;


    try {

        body =
            await response.json();

    } catch {}


    if (!response.ok) {

        throw new Error(
            body?.message ||
            body?.error ||
            `Yêu cầu thất bại (${response.status})`
        );
    }


    return body;
}


function setStatus(
    message = "",
    type = ""
) {

    const element =
        document.getElementById(
            "authStatus"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `scauth-status ${type}`.trim();
}


function setBusy(
    button,
    busy,
    text
) {

    if (!button) {
        return;
    }


    if (busy) {

        button.dataset.oldText =
            button.textContent;


        button.disabled =
            true;


        button.textContent =
            text;

    } else {

        button.disabled =
            false;


        if (
            button.dataset.oldText
        ) {

            button.textContent =
                button.dataset.oldText;
        }
    }
}


function bindPasswordToggles() {

    document
        .querySelectorAll(
            "[data-toggle-password]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const input =
                            document.getElementById(
                                button.dataset.togglePassword
                            );


                        if (!input) {
                            return;
                        }


                        input.type =
                            input.type ===
                            "password"
                                ? "text"
                                : "password";
                    }
                );
            }
        );
}


// ============================================================
// LOGIN
// ============================================================

function initLogin() {

    const form =
        document.getElementById(
            "loginForm"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const usernameInput =
                document.getElementById(
                    "username"
                ) ||
                document.getElementById(
                    "loginId"
                );


            const emailInput =
                document.getElementById(
                    "email"
                );


            const passwordInput =
                document.getElementById(
                    "password"
                );


            const username =
                usernameInput?.value
                    ?.trim() ||
                "";


            const email =
                emailInput?.value
                    ?.trim() ||
                "";


            const password =
                passwordInput?.value ||
                "";


            const button =
                form.querySelector(
                    "[type=submit]"
                );


            try {

                setStatus("");


                setBusy(
                    button,
                    true,
                    "Đang đăng nhập..."
                );


                await api(
                    "/api/auth/login",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                username,
                                email,
                                password
                            })
                    }
                );


                setStatus(
                    "Đăng nhập thành công.",
                    "success"
                );


                window.setTimeout(
                    () => {

                        window.location.href =
                            "./chat.html";
                    },
                    300
                );

            } catch (error) {

                setStatus(
                    error.message,
                    "error"
                );

            } finally {

                setBusy(
                    button,
                    false
                );
            }
        }
    );
}


// ============================================================
// REGISTER START
// ============================================================

function initRegister() {

    const form =
        document.getElementById(
            "registerForm"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const username =
                document
                    .getElementById(
                        "username"
                    )
                    .value
                    .trim();


            const displayName =
                document
                    .getElementById(
                        "displayName"
                    )
                    .value
                    .trim();


            const email =
                document
                    .getElementById(
                        "email"
                    )
                    .value
                    .trim();


            const password =
                document
                    .getElementById(
                        "password"
                    )
                    .value;


            const confirmPassword =
                document
                    .getElementById(
                        "confirmPassword"
                    )
                    .value;


            const button =
                form.querySelector(
                    "[type=submit]"
                );


            if (
                password !==
                confirmPassword
            ) {

                setStatus(
                    "Mật khẩu nhập lại không khớp.",
                    "error"
                );


                return;
            }


            try {

                setStatus("");


                setBusy(
                    button,
                    true,
                    "Đang gửi OTP..."
                );


                const result =
                    await api(
                        "/api/auth/register/start",
                        {
                            method:
                                "POST",

                            body:
                                JSON.stringify({
                                    username,
                                    displayName,
                                    email,
                                    password
                                })
                        }
                    );


                sessionStorage.setItem(
                    "securechat-register-email",
                    result.email ||
                    email
                );


                window.location.href =
                    `./verify-email.html?email=${encodeURIComponent(result.email || email)}`;

            } catch (error) {

                setStatus(
                    error.message,
                    "error"
                );

            } finally {

                setBusy(
                    button,
                    false
                );
            }
        }
    );
}


// ============================================================
// VERIFY REGISTER OTP
// ============================================================

function initVerifyRegister() {

    const form =
        document.getElementById(
            "verifyEmailForm"
        ) ||
        document.getElementById(
            "verifyForm"
        );


    if (!form) {
        return;
    }


    const params =
        new URLSearchParams(
            window.location.search
        );


    const email =
        params.get(
            "email"
        ) ||
        sessionStorage.getItem(
            "securechat-register-email"
        ) ||
        "";


    const emailText =
        document.getElementById(
            "verifyEmailText"
        );


    if (emailText) {

        emailText.textContent =
            email ||
            "email của bạn";
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const codeInput =
                document.getElementById(
                    "otpCode"
                );


            const code =
                codeInput?.value
                    ?.trim() ||
                "";


            const button =
                form.querySelector(
                    "[type=submit]"
                );


            if (
                !/^\d{6}$/.test(
                    code
                )
            ) {

                setStatus(
                    "OTP phải gồm đúng 6 số.",
                    "error"
                );


                return;
            }


            try {

                setStatus("");


                setBusy(
                    button,
                    true,
                    "Đang xác thực..."
                );


                await api(
                    "/api/auth/register/verify",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                email,
                                code
                            })
                    }
                );


                sessionStorage.removeItem(
                    "securechat-register-email"
                );


                setStatus(
                    "Tạo tài khoản thành công.",
                    "success"
                );


                window.setTimeout(
                    () => {

                        window.location.href =
                            "./index.html";
                    },
                    700
                );

            } catch (error) {

                setStatus(
                    error.message,
                    "error"
                );

            } finally {

                setBusy(
                    button,
                    false
                );
            }
        }
    );


    const resendButton =
        document.getElementById(
            "resendVerificationButton"
        ) ||
        document.getElementById(
            "btnResend"
        );


    resendButton
        ?.addEventListener(
            "click",
            async () => {

                try {

                    setStatus(
                        "Đang gửi lại OTP..."
                    );


                    await api(
                        "/api/auth/register/resend",
                        {
                            method:
                                "POST",

                            body:
                                JSON.stringify({
                                    email
                                })
                        }
                    );


                    setStatus(
                        "Đã gửi OTP mới.",
                        "success"
                    );

                } catch (error) {

                    setStatus(
                        error.message,
                        "error"
                    );
                }
            }
        );
}


// ============================================================
// FORGOT PASSWORD
// ============================================================

function initForgotPassword() {

    const form =
        document.getElementById(
            "forgotPasswordForm"
        ) ||
        document.getElementById(
            "forgotForm"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const emailInput =
                document.getElementById(
                    "forgotEmail"
                ) ||
                document.getElementById(
                    "email"
                );


            const email =
                emailInput?.value
                    ?.trim() ||
                "";


            const button =
                form.querySelector(
                    "[type=submit]"
                );


            try {

                setStatus("");


                setBusy(
                    button,
                    true,
                    "Đang gửi OTP..."
                );


                await api(
                    "/api/auth/password/forgot",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                email
                            })
                    }
                );


                sessionStorage.setItem(
                    "securechat-reset-email",
                    email
                );


                window.location.href =
                    `./reset-password.html?email=${encodeURIComponent(email)}`;

            } catch (error) {

                setStatus(
                    error.message,
                    "error"
                );

            } finally {

                setBusy(
                    button,
                    false
                );
            }
        }
    );
}


// ============================================================
// RESET PASSWORD
// ============================================================

function initResetPassword() {

    const form =
        document.getElementById(
            "resetPasswordForm"
        ) ||
        document.getElementById(
            "resetForm"
        );


    if (!form) {
        return;
    }


    const params =
        new URLSearchParams(
            window.location.search
        );


    const email =
        params.get(
            "email"
        ) ||
        sessionStorage.getItem(
            "securechat-reset-email"
        ) ||
        "";


    const emailText =
        document.getElementById(
            "resetEmailText"
        );


    if (emailText) {

        emailText.textContent =
            email ||
            "email của bạn";
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const otpInput =
                document.getElementById(
                    "resetOtp"
                );


            const code =
                otpInput?.value
                    ?.trim() ||
                "";


            const newPassword =
                document
                    .getElementById(
                        "newPassword"
                    )
                    ?.value ||
                "";


            const confirmNewPasswordInput =
                document.getElementById(
                    "confirmNewPassword"
                ) ||
                document.getElementById(
                    "confirmPassword"
                );


            const confirmNewPassword =
                confirmNewPasswordInput?.value ||
                "";


            const button =
                form.querySelector(
                    "[type=submit]"
                );


            if (
                !/^\d{6}$/.test(
                    code
                )
            ) {

                setStatus(
                    "OTP phải gồm đúng 6 số.",
                    "error"
                );


                return;
            }


            if (
                newPassword !==
                confirmNewPassword
            ) {

                setStatus(
                    "Mật khẩu nhập lại không khớp.",
                    "error"
                );


                return;
            }


            try {

                setStatus("");


                setBusy(
                    button,
                    true,
                    "Đang đổi mật khẩu..."
                );


                await api(
                    "/api/auth/password/reset",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                email,
                                code,
                                newPassword
                            })
                    }
                );


                sessionStorage.removeItem(
                    "securechat-reset-email"
                );


                setStatus(
                    "Đổi mật khẩu thành công.",
                    "success"
                );


                window.setTimeout(
                    () => {

                        window.location.href =
                            "./index.html";
                    },
                    700
                );

            } catch (error) {

                setStatus(
                    error.message,
                    "error"
                );

            } finally {

                setBusy(
                    button,
                    false
                );
            }
        }
    );
}


// ============================================================
// INIT
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        bindPasswordToggles();


        const page =
            document.body.dataset.page;


        switch (page) {

            case "login":
                initLogin();
                break;


            case "register":
                initRegister();
                break;


            case "verify-email":
            case "verify":
                initVerifyRegister();
                break;


            case "forgot-password":
            case "forgot":
                initForgotPassword();
                break;


            case "reset-password":
            case "reset":
                initResetPassword();
                break;
        }
    }
);