const Friendship =
    require("../models/Friendship");

const Block =
    require("../models/Block");


// ======================================================
// KIỂM TRA 2 USER CÓ CHẶN NHAU KHÔNG
// ======================================================

async function getBlockBetween(
    userId1,
    userId2
) {
    if (
        !userId1 ||
        !userId2
    ) {
        return null;
    }


    return Block.findOne({
        $or: [
            {
                blocker:
                    userId1,

                blocked:
                    userId2
            },

            {
                blocker:
                    userId2,

                blocked:
                    userId1
            }
        ]
    });
}


async function isBlockedBetween(
    userId1,
    userId2
) {
    const block =
        await getBlockBetween(
            userId1,
            userId2
        );


    return Boolean(
        block
    );
}


async function assertNotBlocked(
    userId1,
    userId2
) {
    const blocked =
        await isBlockedBetween(
            userId1,
            userId2
        );


    if (blocked) {
        const error =
            new Error(
                "Không thể tương tác vì một trong hai tài khoản đã chặn người kia."
            );


        error.statusCode =
            403;


        error.code =
            "USER_BLOCKED";


        throw error;
    }


    return true;
}


// ======================================================
// FRIENDSHIP
// ======================================================

async function getAcceptedFriendship(
    userId1,
    userId2
) {
    if (
        !userId1 ||
        !userId2
    ) {
        return null;
    }


    if (
        String(userId1) ===
        String(userId2)
    ) {
        return null;
    }


    // Chặn trước
    await assertNotBlocked(
        userId1,
        userId2
    );


    const pair =
        Friendship.normalizePair(
            userId1,
            userId2
        );


    return Friendship.findOne({
        ...pair,

        status:
            "accepted"
    });
}


async function areFriends(
    userId1,
    userId2
) {
    try {
        const friendship =
            await getAcceptedFriendship(
                userId1,
                userId2
            );


        return Boolean(
            friendship
        );
    }

    catch {
        return false;
    }
}


async function assertFriends(
    userId1,
    userId2
) {
    await assertNotBlocked(
        userId1,
        userId2
    );


    const pair =
        Friendship.normalizePair(
            userId1,
            userId2
        );


    const friendship =
        await Friendship.findOne({
            ...pair,

            status:
                "accepted"
        });


    if (!friendship) {
        const error =
            new Error(
                "Hai tài khoản phải kết bạn trước khi nhắn tin."
            );


        error.statusCode =
            403;


        error.code =
            "FRIENDSHIP_REQUIRED";


        throw error;
    }


    return friendship;
}


function isFriendshipMember(
    friendship,
    userId
) {
    if (
        !friendship ||
        !userId
    ) {
        return false;
    }


    const id =
        String(userId);


    return (
        String(
            friendship.userA
        ) === id ||

        String(
            friendship.userB
        ) === id
    );
}


function getOtherFriendId(
    friendship,
    userId
) {
    if (
        !friendship ||
        !userId
    ) {
        return null;
    }


    const id =
        String(userId);


    if (
        String(
            friendship.userA
        ) === id
    ) {
        return friendship.userB;
    }


    if (
        String(
            friendship.userB
        ) === id
    ) {
        return friendship.userA;
    }


    return null;
}


module.exports = {
    getBlockBetween,
    isBlockedBetween,
    assertNotBlocked,

    getAcceptedFriendship,
    areFriends,
    assertFriends,

    isFriendshipMember,
    getOtherFriendId
};