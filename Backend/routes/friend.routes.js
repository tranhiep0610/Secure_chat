const express = require('express');
const mongoose = require('mongoose');

const Friendship = require('../models/Friendship'); 
const User = require('../models/User');

const router = express.Router();


// ======================================================
// HELPER - LẤY ID USER ĐANG ĐĂNG NHẬP
//
// Viết nhiều fallback để tương thích với
// middleware/session hiện tại của project.
// ======================================================

function getCurrentUserId(req) {
  return (
    req.user?._id ||
    req.user?.id ||
    req.userId ||
    req.session?.userId ||
    req.session?.user?._id ||
    req.session?.user?.id ||
    null
  );
}


// ======================================================
// HELPER - BẮT BUỘC ĐĂNG NHẬP
// ======================================================

function requireLogin(req, res, next) {
  const userId =
    getCurrentUserId(req);

  if (!userId) {
    return res
      .status(401)
      .json({
        success: false,
        message:
          'Bạn cần đăng nhập.'
      });
  }

  req.currentUserId =
    String(userId);

  next();
}


// Tất cả API bên dưới đều cần đăng nhập.
router.use(requireLogin);


// ======================================================
// HELPER - KIỂM TRA OBJECT ID
// ======================================================

function isValidId(id) {
  return (
    typeof id === 'string' &&
    mongoose.Types.ObjectId
      .isValid(id)
  );
}


// ======================================================
// HELPER - PUBLIC USER
//
// Tuyệt đối không trả password/hash ra frontend.
// ======================================================

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    _id:
      String(user._id),

    username:
      user.username,

    displayName:
      user.displayName ||
      user.username
  };
}


// ======================================================
// HELPER - LẤY USER CÒN LẠI TRONG FRIENDSHIP
// ======================================================

function getOtherUser(
  friendship,
  currentUserId
) {
  const userA =
    friendship.userA;

  const userB =
    friendship.userB;

  const userAId =
    String(
      userA?._id ||
      userA
    );

  if (
    userAId ===
    String(currentUserId)
  ) {
    return userB;
  }

  return userA;
}


// ======================================================
// GET /api/friends
//
// DANH SÁCH BẠN BÈ ĐÃ ACCEPT
// ======================================================

router.get(
  '/',
  async (req, res) => {
    try {
      const currentUserId =
        req.currentUserId;


      const friendships =
        await Friendship
          .find({
            status:
              'accepted',

            $or: [
              {
                userA:
                  currentUserId
              },

              {
                userB:
                  currentUserId
              }
            ]
          })

          .populate(
            'userA',
            'username displayName'
          )

          .populate(
            'userB',
            'username displayName'
          )

          .sort({
            updatedAt: -1
          });


      const friends =
        friendships
          .map(
            friendship => {
              const otherUser =
                getOtherUser(
                  friendship,
                  currentUserId
                );


              return {
                friendshipId:
                  String(
                    friendship._id
                  ),

                user:
                  publicUser(
                    otherUser
                  ),

                friendsSince:
                  friendship
                    .respondedAt ||
                  friendship
                    .updatedAt
              };
            }
          )

          .filter(
            item =>
              item.user
          );


      return res.json({
        success: true,
        friends
      });
    }

    catch (error) {
      console.error(
        'GET /api/friends:',
        error
      );


      return res
        .status(500)
        .json({
          success: false,
          message:
            'Không tải được danh sách bạn bè.'
        });
    }
  }
);


// ======================================================
// GET /api/friends/requests/incoming
//
// LỜI MỜI NGƯỜI KHÁC GỬI CHO MÌNH
// ======================================================

router.get(
  '/requests/incoming',
  async (req, res) => {
    try {
      const currentUserId =
        req.currentUserId;


      const requests =
        await Friendship
          .find({
            status:
              'pending',

            requestedBy: {
              $ne:
                currentUserId
            },

            $or: [
              {
                userA:
                  currentUserId
              },

              {
                userB:
                  currentUserId
              }
            ]
          })

          .populate(
            'userA',
            'username displayName'
          )

          .populate(
            'userB',
            'username displayName'
          )

          .populate(
            'requestedBy',
            'username displayName'
          )

          .sort({
            createdAt: -1
          });


      const incoming =
        requests.map(
          friendship => ({
            friendshipId:
              String(
                friendship._id
              ),

            sender:
              publicUser(
                friendship
                  .requestedBy
              ),

            createdAt:
              friendship
                .createdAt
          })
        );


      return res.json({
        success: true,
        requests:
          incoming
      });
    }

    catch (error) {
      console.error(
        'GET incoming friends:',
        error
      );


      return res
        .status(500)
        .json({
          success: false,
          message:
            'Không tải được lời mời kết bạn.'
        });
    }
  }
);


// ======================================================
// GET /api/friends/requests/outgoing
//
// LỜI MỜI MÌNH ĐÃ GỬI
// ======================================================

router.get(
  '/requests/outgoing',
  async (req, res) => {
    try {
      const currentUserId =
        req.currentUserId;


      const requests =
        await Friendship
          .find({
            status:
              'pending',

            requestedBy:
              currentUserId
          })

          .populate(
            'userA',
            'username displayName'
          )

          .populate(
            'userB',
            'username displayName'
          )

          .sort({
            createdAt: -1
          });


      const outgoing =
        requests.map(
          friendship => ({
            friendshipId:
              String(
                friendship._id
              ),

            receiver:
              publicUser(
                getOtherUser(
                  friendship,
                  currentUserId
                )
              ),

            createdAt:
              friendship
                .createdAt
          })
        );


      return res.json({
        success: true,
        requests:
          outgoing
      });
    }

    catch (error) {
      console.error(
        'GET outgoing friends:',
        error
      );


      return res
        .status(500)
        .json({
          success: false,
          message:
            'Không tải được lời mời đã gửi.'
        });
    }
  }
);


// ======================================================
// GET /api/friends/status/:userId
//
// KIỂM TRA QUAN HỆ VỚI MỘT USER
// ======================================================

router.get(
  '/status/:userId',
  async (req, res) => {
    try {
      const currentUserId =
        req.currentUserId;

      const targetUserId =
        req.params.userId;


      if (
        !isValidId(
          targetUserId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'User ID không hợp lệ.'
          });
      }


      if (
        String(
          currentUserId
        ) ===
        String(
          targetUserId
        )
      ) {
        return res.json({
          success: true,
          status:
            'self',
          friendshipId:
            null
        });
      }


      const pair =
        Friendship
          .normalizePair(
            currentUserId,
            targetUserId
          );


      const friendship =
        await Friendship
          .findOne(pair);


      if (!friendship) {
        return res.json({
          success: true,
          status:
            'none',
          friendshipId:
            null
        });
      }


      let direction =
        null;


      if (
        friendship.status ===
        'pending'
      ) {
        direction =
          String(
            friendship
              .requestedBy
          ) ===
          String(
            currentUserId
          )
            ? 'outgoing'
            : 'incoming';
      }


      return res.json({
        success: true,

        status:
          friendship.status,

        direction,

        friendshipId:
          String(
            friendship._id
          )
      });
    }

    catch (error) {
      console.error(
        'GET friendship status:',
        error
      );


      return res
        .status(500)
        .json({
          success: false,
          message:
            'Không kiểm tra được quan hệ bạn bè.'
        });
    }
  }
);


// ======================================================
// POST /api/friends/request
//
// BODY:
// {
//     "targetUserId": "..."
// }
// ======================================================

router.post(
  '/request',
  async (req, res) => {
    try {
      const currentUserId =
        req.currentUserId;


      const targetUserId =
        String(
          req.body
            ?.targetUserId ||
          ''
        ).trim();


      if (
        !isValidId(
          targetUserId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'Người nhận không hợp lệ.'
          });
      }


      if (
        String(
          currentUserId
        ) ===
        String(
          targetUserId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'Không thể tự kết bạn với chính mình.'
          });
      }


      // Kiểm tra target user tồn tại.
      const targetUser =
        await User
          .findById(
            targetUserId
          )
          .select(
            'username displayName'
          );


      if (!targetUser) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Không tìm thấy người dùng.'
          });
      }


      const pair =
        Friendship
          .normalizePair(
            currentUserId,
            targetUserId
          );


      let friendship =
        await Friendship
          .findOne(pair);


      // ==================================================
      // CHƯA TỪNG CÓ QUAN HỆ
      // ==================================================

      if (!friendship) {
        friendship =
          await Friendship.create({
            ...pair,

            requestedBy:
              currentUserId,

            status:
              'pending'
          });


        return res
          .status(201)
          .json({
            success: true,

            message:
              'Đã gửi lời mời kết bạn.',

            friendship: {
              _id:
                String(
                  friendship._id
                ),

              status:
                friendship.status,

              targetUser:
                publicUser(
                  targetUser
                )
            }
          });
      }


      // ==================================================
      // ĐÃ LÀ BẠN
      // ==================================================

      if (
        friendship.status ===
        'accepted'
      ) {
        return res
          .status(409)
          .json({
            success: false,
            message:
              'Hai tài khoản đã là bạn bè.'
          });
      }


      // ==================================================
      // ĐÃ CÓ LỜI MỜI PENDING
      // ==================================================

      if (
        friendship.status ===
        'pending'
      ) {
        const sentByMe =
          String(
            friendship
              .requestedBy
          ) ===
          String(
            currentUserId
          );


        return res
          .status(409)
          .json({
            success: false,

            message:
              sentByMe
                ? 'Bạn đã gửi lời mời trước đó.'
                : 'Người này đã gửi lời mời cho bạn.',

            friendshipId:
              String(
                friendship._id
              ),

            direction:
              sentByMe
                ? 'outgoing'
                : 'incoming'
          });
      }


      // ==================================================
      // TRƯỚC ĐÓ BỊ REJECT
      //
      // Cho phép gửi lại lời mời mới.
      // ==================================================

      friendship.status =
        'pending';


      friendship.requestedBy =
        currentUserId;


      friendship.respondedAt =
        null;


      await friendship.save();


      return res.json({
        success: true,

        message:
          'Đã gửi lại lời mời kết bạn.',

        friendship: {
          _id:
            String(
              friendship._id
            ),

          status:
            friendship.status,

          targetUser:
            publicUser(
              targetUser
            )
        }
      });
    }

    catch (error) {
      console.error(
        'POST friend request:',
        error
      );


      if (
        error?.code ===
        11000
      ) {
        return res
          .status(409)
          .json({
            success: false,
            message:
              'Quan hệ bạn bè này đã tồn tại.'
          });
      }


      return res
        .status(500)
        .json({
          success: false,
          message:
            'Không gửi được lời mời kết bạn.'
        });
    }
  }
);


// ======================================================
// POST /api/friends/:friendshipId/accept
//
// CHẤP NHẬN LỜI MỜI
// ======================================================

router.post(
  '/:friendshipId/accept',
  async (req, res) => {
    try {
      const currentUserId =
        req.currentUserId;


      const friendshipId =
        req.params
          .friendshipId;


      if (
        !isValidId(
          friendshipId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'Friendship ID không hợp lệ.'
          });
      }


      const friendship =
        await Friendship
          .findById(
            friendshipId
          );


      if (!friendship) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Không tìm thấy lời mời.'
          });
      }


      if (
        !friendship
          .containsUser(
            currentUserId
          )
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              'Bạn không có quyền xử lý lời mời này.'
          });
      }


      if (
        friendship.status !==
        'pending'
      ) {
        return res
          .status(409)
          .json({
            success: false,
            message:
              'Lời mời này không còn ở trạng thái chờ.'
          });
      }


      // Người gửi không được tự accept.
      if (
        String(
          friendship
            .requestedBy
        ) ===
        String(
          currentUserId
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              'Bạn không thể tự chấp nhận lời mời mình đã gửi.'
          });
      }


      friendship.status =
        'accepted';


      friendship.respondedAt =
        new Date();


      await friendship.save();


      return res.json({
        success: true,

        message:
          'Đã chấp nhận lời mời kết bạn.',

        friendshipId:
          String(
            friendship._id
          )
      });
    }

    catch (error) {
      console.error(
        'Accept friend:',
        error
      );


      return res
        .status(500)
        .json({
          success: false,
          message:
            'Không thể chấp nhận lời mời.'
        });
    }
  }
);


// ======================================================
// POST /api/friends/:friendshipId/reject
//
// TỪ CHỐI LỜI MỜI
// ======================================================

router.post(
  '/:friendshipId/reject',
  async (req, res) => {
    try {
      const currentUserId =
        req.currentUserId;


      const friendshipId =
        req.params
          .friendshipId;


      if (
        !isValidId(
          friendshipId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'Friendship ID không hợp lệ.'
          });
      }


      const friendship =
        await Friendship
          .findById(
            friendshipId
          );


      if (!friendship) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Không tìm thấy lời mời.'
          });
      }


      if (
        !friendship
          .containsUser(
            currentUserId
          )
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              'Bạn không có quyền xử lý lời mời này.'
          });
      }


      if (
        friendship.status !==
        'pending'
      ) {
        return res
          .status(409)
          .json({
            success: false,
            message:
              'Lời mời này không còn ở trạng thái chờ.'
          });
      }


      if (
        String(
          friendship
            .requestedBy
        ) ===
        String(
          currentUserId
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              'Người gửi phải hủy lời mời thay vì từ chối.'
          });
      }


      friendship.status =
        'rejected';


      friendship.respondedAt =
        new Date();


      await friendship.save();


      return res.json({
        success: true,

        message:
          'Đã từ chối lời mời kết bạn.'
      });
    }

    catch (error) {
      console.error(
        'Reject friend:',
        error
      );


      return res
        .status(500)
        .json({
          success: false,
          message:
            'Không thể từ chối lời mời.'
        });
    }
  }
);


// ======================================================
// DELETE /api/friends/:friendshipId/cancel
//
// HỦY LỜI MỜI MÌNH ĐÃ GỬI
// ======================================================

router.delete(
  '/:friendshipId/cancel',
  async (req, res) => {
    try {
      const currentUserId =
        req.currentUserId;


      const friendshipId =
        req.params
          .friendshipId;


      if (
        !isValidId(
          friendshipId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'Friendship ID không hợp lệ.'
          });
      }


      const friendship =
        await Friendship
          .findById(
            friendshipId
          );


      if (!friendship) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Không tìm thấy lời mời.'
          });
      }


      if (
        friendship.status !==
        'pending'
      ) {
        return res
          .status(409)
          .json({
            success: false,
            message:
              'Lời mời này không còn ở trạng thái chờ.'
          });
      }


      if (
        String(
          friendship
            .requestedBy
        ) !==
        String(
          currentUserId
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              'Bạn không phải người gửi lời mời này.'
          });
      }


      await friendship.deleteOne();


      return res.json({
        success: true,

        message:
          'Đã hủy lời mời kết bạn.'
      });
    }

    catch (error) {
      console.error(
        'Cancel friend:',
        error
      );


      return res
        .status(500)
        .json({
          success: false,
          message:
            'Không thể hủy lời mời.'
        });
    }
  }
);


// ======================================================
// DELETE /api/friends/:friendshipId
//
// HỦY KẾT BẠN
// ======================================================

router.delete(
  '/:friendshipId',
  async (req, res) => {
    try {
      const currentUserId =
        req.currentUserId;


      const friendshipId =
        req.params
          .friendshipId;


      if (
        !isValidId(
          friendshipId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'Friendship ID không hợp lệ.'
          });
      }


      const friendship =
        await Friendship
          .findById(
            friendshipId
          );


      if (!friendship) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Không tìm thấy quan hệ bạn bè.'
          });
      }


      if (
        !friendship
          .containsUser(
            currentUserId
          )
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              'Bạn không có quyền xóa quan hệ này.'
          });
      }


      if (
        friendship.status !==
        'accepted'
      ) {
        return res
          .status(409)
          .json({
            success: false,
            message:
              'Hai tài khoản chưa phải bạn bè.'
          });
      }


      await friendship.deleteOne();


      return res.json({
        success: true,

        message:
          'Đã hủy kết bạn.'
      });
    }

    catch (error) {
      console.error(
        'Delete friend:',
        error
      );


      return res
        .status(500)
        .json({
          success: false,
          message:
            'Không thể hủy kết bạn.'
        });
    }
  }
);


module.exports = router;