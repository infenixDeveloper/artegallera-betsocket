const { Router } = require("express");
const router = Router();

const { login, register, forgotPassword } = require("../controllers/authController.js");

router.post("/login",login);
router.post("/register",register);
router.post("/forgot_password",forgotPassword);

module.exports = router;