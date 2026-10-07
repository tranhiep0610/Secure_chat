const express = require("express");

const router =
  express.Router();

const {
  startRegister,
  resendRegisterCode,
  confirmRegister,
  startReset,
  confirmReset
} =
  require(
    "../controllers/emailAuth.controller"
  );


router.post(
  "/start-register",
  startRegister
);


router.post(
  "/resend-register-code",
  resendRegisterCode
);


router.post(
  "/confirm-register",
  confirmRegister
);


router.post(
  "/start-reset",
  startReset
);


router.post(
  "/confirm-reset",
  confirmReset
);


module.exports =
  router;