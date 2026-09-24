const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

function initChatSocket(io) {

    io.on("connection", async (socket) => {

        // ==========================================
        // LẤY USER TỪ SESSION
        // ==========================================

        const userId = socket.request.session?.userId;

        if (!userId) {
            console.log("❌ Socket không có session -> disconnect");
            socket.disconnect(true);
            return;
        }

        console.log(
            `✅ Socket connected | user=${userId} | socket=${socket.id}`
        );


        // ==========================================
        // ROOM RIÊNG CỦA USER
        // ==========================================

        socket.join(`user:${userId}`);


        // ==========================================
        // JOIN CONVERSATION
        // client emit:
        // socket.emit("conversation:join", conversationId)
        // ==========================================

        socket.on(
            "conversation:join",

            async (conversationId, callback) => {

                try {

                    if (!conversationId) {
                        return callback?.({
                            success: false,
                            message: "Thiếu conversationId"
                        });
                    }


                    // Kiểm tra user có thuộc conversation không
                    const conversation =
                        await Conversation.findOne({
                            _id: conversationId,
                            participants: userId
                        });


                    if (!conversation) {
                        return callback?.({
                            success: false,
                            message:
                                "Bạn không thuộc cuộc trò chuyện này"
                        });
                    }


                    const roomName =
                        `conversation:${conversationId}`;


                    socket.join(roomName);


                    console.log(
                        `✅ User ${userId} joined ${roomName}`
                    );


                    return callback?.({
                        success: true,
                        conversationId
                    });

                } catch (error) {

                    console.error(
                        "❌ conversation:join error:",
                        error.message
                    );


                    return callback?.({
                        success: false,
                        message:
                            "Không thể tham gia cuộc trò chuyện"
                    });
                }
            }
        );


        // ==========================================
        // LEAVE CONVERSATION
        // ==========================================

        socket.on(
            "conversation:leave",

            (conversationId, callback) => {

                if (!conversationId) {
                    return callback?.({
                        success: false,
                        message: "Thiếu conversationId"
                    });
                }


                const roomName =
                    `conversation:${conversationId}`;


                socket.leave(roomName);


                console.log(
                    `User ${userId} left ${roomName}`
                );


                return callback?.({
                    success: true
                });
            }
        );


        // ==========================================
        // GỬI TIN NHẮN
        //
        // Client gửi ciphertext, KHÔNG gửi plaintext
        //
        // socket.emit("message:send", {
        //     conversationId,
        //     clientMessageId,
        //     algorithm,
        //     keyId,
        //     iv,
        //     ciphertext,
        //     hmac,
        //     timestamp
        // })
        // ==========================================

        socket.on(
            "message:send",

            async (data, callback) => {

                try {

                    if (!data || typeof data !== "object") {
                        return callback?.({
                            success: false,
                            message:
                                "Dữ liệu tin nhắn không hợp lệ"
                        });
                    }


                    const {
                        conversationId,
                        clientMessageId,
                        algorithm,
                        keyId,
                        iv,
                        ciphertext,
                        hmac,
                        timestamp
                    } = data;


                    // ==================================
                    // VALIDATE
                    // ==================================

                    if (!conversationId) {
                        return callback?.({
                            success: false,
                            message:
                                "Thiếu conversationId"
                        });
                    }


                    if (!clientMessageId) {
                        return callback?.({
                            success: false,
                            message:
                                "Thiếu clientMessageId"
                        });
                    }


                    if (!algorithm) {
                        return callback?.({
                            success: false,
                            message:
                                "Thiếu thuật toán mã hóa"
                        });
                    }


                    if (!iv) {
                        return callback?.({
                            success: false,
                            message:
                                "Thiếu IV"
                        });
                    }


                    if (!ciphertext) {
                        return callback?.({
                            success: false,
                            message:
                                "Thiếu ciphertext"
                        });
                    }


                    // ==================================
                    // CHỈ CHO AES-GCM / DES-CBC
                    // ==================================

                    if (
                        algorithm !== "AES-GCM" &&
                        algorithm !== "DES-CBC"
                    ) {
                        return callback?.({
                            success: false,
                            message:
                                "Thuật toán mã hóa không được hỗ trợ"
                        });
                    }


                    // ==================================
                    // KIỂM TRA QUYỀN
                    // ==================================

                    const conversation =
                        await Conversation.findOne({
                            _id: conversationId,
                            participants: userId
                        });


                    if (!conversation) {
                        return callback?.({
                            success: false,
                            message:
                                "Bạn không có quyền gửi tin nhắn vào cuộc trò chuyện này"
                        });
                    }


                    // ==================================
                    // LƯU CIPHERTEXT VÀO MONGODB
                    // ==================================

                    let message;

                    try {

                        message = await Message.create({

                            conversationId,

                            senderId: userId,

                            clientMessageId,

                            algorithm,

                            keyId:
                                keyId || null,

                            iv,

                            ciphertext,

                            hmac:
                                hmac || null,

                            cryptoTimestamp:
                                timestamp ||
                                Date.now()

                        });

                    } catch (error) {

                        // ==================================
                        // CLIENT RETRY
                        // Không lưu trùng message
                        // ==================================

                        if (error?.code === 11000) {

                            message =
                                await Message.findOne({
                                    senderId:
                                        userId,

                                    clientMessageId
                                });


                            if (!message) {
                                throw error;
                            }

                        } else {

                            throw error;

                        }
                    }


                    // ==================================
                    // CẬP NHẬT LAST MESSAGE
                    // ==================================

                    conversation.lastMessage =
                        message._id;

                    await conversation.save();


                    // ==================================
                    // DỮ LIỆU TRẢ CHO CLIENT
                    // ==================================

                    const messageData = {

                        _id:
                            message._id.toString(),

                        conversationId:
                            message.conversationId.toString(),

                        senderId:
                            message.senderId.toString(),

                        clientMessageId:
                            message.clientMessageId,

                        algorithm:
                            message.algorithm,

                        keyId:
                            message.keyId,

                        iv:
                            message.iv,

                        ciphertext:
                            message.ciphertext,

                        hmac:
                            message.hmac,

                        timestamp:
                            message.cryptoTimestamp,

                        createdAt:
                            message.createdAt

                    };


                    // ==================================
                    // GỬI REALTIME
                    // ==================================

                    const conversationRoom =
                        `conversation:${conversationId}`;


                    io.to(conversationRoom).emit(
                        "message:new",
                        messageData
                    );


                    console.log(
                        `📨 Message saved | ${message._id}`
                    );


                    // ==================================
                    // ACK CHO NGƯỜI GỬI
                    // ==================================

                    return callback?.({
                        success: true,
                        message: messageData
                    });

                } catch (error) {

                    console.error(
                        "❌ message:send error:",
                        error
                    );


                    return callback?.({
                        success: false,
                        message:
                            "Gửi tin nhắn thất bại"
                    });
                }
            }
        );


        // ==========================================
        // DISCONNECT
        // ==========================================

        socket.on(
            "disconnect",

            (reason) => {

                console.log(
                    `🔌 Socket disconnected | user=${userId} | reason=${reason}`
                );

            }
        );

    });
}


module.exports = initChatSocket;