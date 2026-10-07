const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const {
    assertFriends
} = require("../services/friendship.service");


// =====================================================
// LẤY USER ID TỪ SOCKET / SESSION
// =====================================================

function getSocketUserId(socket) {

    return (
        socket.userId ||

        socket.request
            ?.session
            ?.userId ||

        socket.request
            ?.session
            ?.user
            ?._id ||

        socket.request
            ?.session
            ?.user
            ?.id ||

        null
    );
}


// =====================================================
// LẤY USER CÒN LẠI TRONG CUỘC TRÒ CHUYỆN
// =====================================================

function getOtherMemberId(
    conversation,
    currentUserId
) {

    // Project hiện tại dùng participants.
    // members để dự phòng dữ liệu/code cũ.
    const participants =
        conversation?.participants ||
        conversation?.members ||
        [];


    const other =
        participants.find(
            participant => {

                const id =
                    String(
                        participant?._id ||
                        participant?.id ||
                        participant
                    );


                return (
                    id !==
                    String(
                        currentUserId
                    )
                );
            }
        );


    return (
        other?._id ||
        other?.id ||
        other ||
        null
    );
}


// =====================================================
// GỬI CALLBACK AN TOÀN
// =====================================================

function sendAck(
    callback,
    payload
) {

    if (
        typeof callback ===
        "function"
    ) {

        callback(
            payload
        );
    }
}


// =====================================================
// SOCKET CHAT
// =====================================================

function initChatSocket(io) {

    io.on(
        "connection",

        async socket => {

            // ==========================================
            // LẤY USER TỪ SESSION
            // ==========================================

            const userId =
                getSocketUserId(
                    socket
                );


            if (!userId) {

                console.log(
                    "❌ Socket không có session -> disconnect"
                );

                socket.disconnect(
                    true
                );

                return;
            }


            const currentUserId =
                String(
                    userId
                );


            console.log(
                `✅ Socket connected | user=${currentUserId} | socket=${socket.id}`
            );


            // ==========================================
            // ROOM RIÊNG CỦA USER
            // ==========================================

            socket.join(
                `user:${currentUserId}`
            );


            // ==========================================
            // JOIN CONVERSATION
            // ==========================================

            socket.on(
                "conversation:join",

                async (
                    conversationId,
                    callback
                ) => {

                    try {

                        if (
                            !conversationId
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Thiếu conversationId"
                                }
                            );

                            return;
                        }


                        // Kiểm tra user có thuộc conversation
                        const conversation =
                            await Conversation.findOne({
                                _id:
                                    conversationId,

                                participants:
                                    currentUserId
                            });


                        if (
                            !conversation
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Bạn không thuộc cuộc trò chuyện này"
                                }
                            );

                            return;
                        }


                        const otherUserId =
                            getOtherMemberId(
                                conversation,
                                currentUserId
                            );


                        if (
                            !otherUserId
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Không xác định được người còn lại trong hội thoại."
                                }
                            );

                            return;
                        }


                        // ==========================================
                        // CHỈ CHO JOIN NẾU VẪN LÀ BẠN
                        // ==========================================

                        try {

                            await assertFriends(
                                currentUserId,
                                otherUserId
                            );

                        }

                        catch (
                            error
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    code:
                                        error.code,

                                    message:
                                        error.message
                                }
                            );

                            return;
                        }


                        const roomName =
                            `conversation:${conversationId}`;


                        socket.join(
                            roomName
                        );


                        console.log(
                            `✅ User ${currentUserId} joined ${roomName}`
                        );


                        sendAck(
                            callback,
                            {
                                success:
                                    true,

                                conversationId
                            }
                        );

                    }

                    catch (
                        error
                    ) {

                        console.error(
                            "❌ conversation:join error:",
                            error
                        );


                        sendAck(
                            callback,
                            {
                                success:
                                    false,

                                message:
                                    "Không thể tham gia cuộc trò chuyện"
                            }
                        );
                    }
                }
            );


            // ==========================================
            // LEAVE CONVERSATION
            // ==========================================

            socket.on(
                "conversation:leave",

                (
                    conversationId,
                    callback
                ) => {

                    try {

                        if (
                            !conversationId
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Thiếu conversationId"
                                }
                            );

                            return;
                        }


                        const roomName =
                            `conversation:${conversationId}`;


                        socket.leave(
                            roomName
                        );


                        console.log(
                            `User ${currentUserId} left ${roomName}`
                        );


                        sendAck(
                            callback,
                            {
                                success:
                                    true
                            }
                        );

                    }

                    catch (
                        error
                    ) {

                        console.error(
                            "❌ conversation:leave error:",
                            error
                        );


                        sendAck(
                            callback,
                            {
                                success:
                                    false,

                                message:
                                    "Không thể rời cuộc trò chuyện"
                            }
                        );
                    }
                }
            );


            // ==========================================
            // GỬI TIN NHẮN
            //
            // CLIENT GỬI CIPHERTEXT
            // KHÔNG GỬI PLAINTEXT
            // ==========================================

            socket.on(
                "message:send",

                async (
                    data,
                    callback
                ) => {

                    try {

                        // ==================================
                        // KIỂM TRA DATA
                        // ==================================

                        if (
                            !data ||
                            typeof data !==
                                "object"
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Dữ liệu tin nhắn không hợp lệ"
                                }
                            );

                            return;
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

                        if (
                            !conversationId
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Thiếu conversationId"
                                }
                            );

                            return;
                        }


                        if (
                            !clientMessageId
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Thiếu clientMessageId"
                                }
                            );

                            return;
                        }


                        if (
                            !algorithm
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Thiếu thuật toán mã hóa"
                                }
                            );

                            return;
                        }


                        if (
                            !iv
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Thiếu IV"
                                }
                            );

                            return;
                        }


                        if (
                            !ciphertext
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Thiếu ciphertext"
                                }
                            );

                            return;
                        }


                        // ==================================
                        // CHỈ CHO AES-GCM / DES-CBC
                        // ==================================

                        if (
                            algorithm !==
                                "AES-GCM" &&

                            algorithm !==
                                "DES-CBC"
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Thuật toán mã hóa không được hỗ trợ"
                                }
                            );

                            return;
                        }


                        // ==================================
                        // KIỂM TRA QUYỀN TRUY CẬP CONVERSATION
                        // ==================================

                        const conversation =
                            await Conversation.findOne({
                                _id:
                                    conversationId,

                                participants:
                                    currentUserId
                            });


                        if (
                            !conversation
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Bạn không có quyền gửi tin nhắn vào cuộc trò chuyện này"
                                }
                            );

                            return;
                        }


                        // ==================================
                        // LẤY NGƯỜI NHẬN
                        // ==================================

                        const otherUserId =
                            getOtherMemberId(
                                conversation,
                                currentUserId
                            );


                        if (
                            !otherUserId
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    message:
                                        "Không xác định được người nhận."
                                }
                            );

                            return;
                        }


                        // ==================================
                        // KIỂM TRA BẠN BÈ / BLOCK
                        // ==================================

                        try {

                            await assertFriends(
                                currentUserId,
                                otherUserId
                            );

                        }

                        catch (
                            error
                        ) {

                            sendAck(
                                callback,
                                {
                                    success:
                                        false,

                                    code:
                                        error.code,

                                    message:
                                        error.message
                                }
                            );

                            return;
                        }


                        // ==================================
                        // LƯU CIPHERTEXT VÀO MONGODB
                        // ==================================

                        let message;


                        try {

                            message =
                                await Message.create({

                                    conversationId,

                                    senderId:
                                        currentUserId,

                                    clientMessageId,

                                    algorithm,

                                    keyId:
                                        keyId ||
                                        null,

                                    iv,

                                    ciphertext,

                                    hmac:
                                        hmac ||
                                        null,

                                    cryptoTimestamp:
                                        timestamp ||
                                        Date.now()
                                });

                        }

                        catch (
                            error
                        ) {

                            // ==================================
                            // CLIENT RETRY
                            // KHÔNG LƯU TRÙNG MESSAGE
                            // ==================================

                            if (
                                error?.code ===
                                11000
                            ) {

                                message =
                                    await Message.findOne({

                                        senderId:
                                            currentUserId,

                                        clientMessageId
                                    });


                                if (
                                    !message
                                ) {

                                    throw error;
                                }

                            }

                            else {

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


                        io
                            .to(
                                conversationRoom
                            )
                            .emit(
                                "message:new",
                                messageData
                            );


                        console.log(
                            `📨 Message saved | ${message._id}`
                        );


                        // ==================================
                        // ACK CHO NGƯỜI GỬI
                        // ==================================

                        sendAck(
                            callback,
                            {
                                success:
                                    true,

                                message:
                                    messageData
                            }
                        );

                    }

                    catch (
                        error
                    ) {

                        console.error(
                            "❌ message:send error:",
                            error
                        );


                        sendAck(
                            callback,
                            {
                                success:
                                    false,

                                message:
                                    "Gửi tin nhắn thất bại"
                            }
                        );
                    }
                }
            );


            // ==========================================
            // DISCONNECT
            // ==========================================

            socket.on(
                "disconnect",

                reason => {

                    console.log(
                        `🔌 Socket disconnected | user=${currentUserId} | reason=${reason}`
                    );

                }
            );

        }
    );
}


module.exports =
    initChatSocket;