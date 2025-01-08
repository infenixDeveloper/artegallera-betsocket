const { Router } = require("express")
const router = Router();

const { getUsers, updateUser, addBalance, deleteUser, getUserById, withdrawBalance, getTotalAmount } = require("../controllers/userController");

router.get("/", getUsers);
router.get("/total-amount", getTotalAmount);
router.get("/:id", getUserById);
router.put("/", updateUser);
router.put("/balance", addBalance);
router.put("/withdraw-balance", withdrawBalance);
router.put("/delete/:id", deleteUser);

module.exports = router