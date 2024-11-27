const { Router } = require("express")
const router = Router();

const { getUsers, updateUser, addBalance, deleteUser, getUserById } = require("../controllers/userController");

router.get("/", getUsers);
router.get("/:id", getUserById);
router.put("/", updateUser);
router.put("/balance", addBalance);
router.put("/delete/:id", deleteUser);

module.exports = router