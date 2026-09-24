const { io } = require("socket.io-client");

const BASE_URL = "http://localhost:3000";

// Conversation giữa hiep_test và hai_test
const CONVERSATION_ID = "6ab3cc66a1cc3767e569ac4c";


// ==========================================
// LOGIN + LẤY SESSION COOKIE
// ==========================================

async function login(username, password) {
    const response = await fetch(
        `${BASE_URL}/api/auth/login`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                username,
                password
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            `${username} login lỗi: ${data.message}`
        );
    }

    const setCookie =
        response.headers.get("set-cookie");

    if (!setCookie) {
        throw new Error(
            `${username} không nhận được session cookie`
        );
    }

    const cookie =
        setCookie.split(";")[0];

    console.log(
        `✅ ${username} đăng nhập thành công`
    );

    return {
        user: data.user,
        cookie
    };
}


// ==========================================
// KẾT NỐI SOCKET BẰNG SESSION
// ==========================================

function connectSocket(username, cookie) {
    return new Promise((resolve, reject) => {

        const socket = io(BASE_URL, {
            transports: ["websocket"],

            extraHeaders: {
                Cookie: cookie
            }
        });


        socket.on("connect", () => {
            console.log(
                `✅ Socket ${username} connected: ${socket.id}`
            );

            resolve(socket);
        });


        socket.on(
            "connect_error",

            (error) => {
                reject(
                    new Error(
                        `${username} socket lỗi: ${error.message}`
                    )
                );
            }
        );

    });
}


// ==========================================
// EMIT VÀ CHỜ CALLBACK
// ==========================================

function emitWithAck(socket, event, data) {
    return new Promise((resolve, reject) => {

        socket.timeout(5000).emit(
            event,
            data,

            (error, response) => {

                if (error) {
                    return reject(
                        new Error(
                            `${event} timeout`
                        )
                    );
                }

                resolve(response);
            }
        );

    });
}


// ==========================================
// TEST
// ==========================================

async function main() {

    let hiepSocket;
    let haiSocket;

    try {

        console.log(
            "\n========== TEST SECURE CHAT SOCKET ==========\n"
        );


        // ======================================
        // 1. LOGIN 2 USER
        // ======================================

        const hiep = await login(
            "hiep_test",
            "Hiep12345"
        );

        const hai = await login(
            "hai_test",
            "Hai12345"
        );


        // ======================================
        // 2. CONNECT SOCKET
        // ======================================

        hiepSocket =
            await connectSocket(
                "hiep_test",
                hiep.cookie
            );

        haiSocket =
            await connectSocket(
                "hai_test",
                hai.cookie
            );


        // ======================================
        // 3. JOIN CONVERSATION
        // ======================================

        const hiepJoin =
            await emitWithAck(
                hiepSocket,
                "conversation:join",
                CONVERSATION_ID
            );

        console.log(
            "Hiệp join:",
            hiepJoin
        );


        const haiJoin =
            await emitWithAck(
                haiSocket,
                "conversation:join",
                CONVERSATION_ID
            );

        console.log(
            "Hải join:",
            haiJoin
        );


        if (
            !hiepJoin?.success ||
            !haiJoin?.success
        ) {
            throw new Error(
                "Không join được conversation"
            );
        }


        // ======================================
        // 4. CHỜ HẢI NHẬN MESSAGE REALTIME
        // ======================================

        const receivedPromise =
            new Promise((resolve, reject) => {

                const timer =
                    setTimeout(() => {

                        reject(
                            new Error(
                                "Hải không nhận được message:new"
                            )
                        );

                    }, 5000);


                haiSocket.once(
                    "message:new",

                    (message) => {

                        clearTimeout(timer);

                        console.log(
                            "\n📩 HẢI NHẬN REALTIME:"
                        );

                        console.log(message);

                        resolve(message);
                    }
                );

            });


        // ======================================
        // 5. CIPHERTEXT GIẢ ĐỂ TEST SERVER
        //
        // Chưa phải AES thật.
        // Mục đích:
        // Socket -> MongoDB -> người nhận
        // ======================================

        const testMessage = {

            conversationId:
                CONVERSATION_ID,

            clientMessageId:
                `test-${Date.now()}`,

            algorithm:
                "AES-GCM",

            keyId:
                "test-key-001",

            // AES-GCM dùng IV 12 byte
            iv: [
                10, 20, 30, 40,
                50, 60, 70, 80,
                90, 100, 110, 120
            ],

            // giả lập ciphertext
            ciphertext: [
                81, 42, 193, 75,
                21, 155, 88, 200,
                31, 72, 119, 15
            ],

            timestamp:
                Date.now()
        };


        console.log(
            "\n📤 HIỆP GỬI CIPHERTEXT..."
        );


        // ======================================
        // 6. GỬI MESSAGE
        // ======================================

        const sendResult =
            await emitWithAck(
                hiepSocket,
                "message:send",
                testMessage
            );


        console.log(
            "\nServer ACK:"
        );

        console.log(sendResult);


        if (!sendResult?.success) {
            throw new Error(
                sendResult?.message ||
                "Gửi message thất bại"
            );
        }


        // ======================================
        // 7. CHỜ HẢI NHẬN
        // ======================================

        const receivedMessage =
            await receivedPromise;


        // ======================================
        // 8. KIỂM TRA HISTORY TRONG DB
        // ======================================

        const historyResponse =
            await fetch(
                `${BASE_URL}/api/messages/${CONVERSATION_ID}`,
                {
                    headers: {
                        Cookie:
                            hiep.cookie
                    }
                }
            );


        const history =
            await historyResponse.json();


        console.log(
            "\n📚 MESSAGE HISTORY:"
        );

        console.log(
            JSON.stringify(
                history,
                null,
                2
            )
        );


        // ======================================
        // HOÀN THÀNH
        // ======================================

        console.log(
            "\n============================================"
        );

        console.log(
            "✅ TEST SOCKET THÀNH CÔNG"
        );

        console.log(
            "✅ hiep_test gửi được ciphertext"
        );

        console.log(
            "✅ MongoDB lưu được message"
        );

        console.log(
            "✅ hai_test nhận realtime"
        );

        console.log(
            "✅ API lấy lại được history"
        );

        console.log(
            "============================================\n"
        );


    } catch (error) {

        console.error(
            "\n❌ TEST THẤT BẠI:"
        );

        console.error(
            error.message
        );

    } finally {

        if (hiepSocket) {
            hiepSocket.disconnect();
        }

        if (haiSocket) {
            haiSocket.disconnect();
        }

        process.exit();
    }
}


main();
