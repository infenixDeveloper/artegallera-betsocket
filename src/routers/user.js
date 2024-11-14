const { Router } = require("express")
const router = Router();

const { getUsers, updateUser, addBalance, deleteUser } = require("../controllers/userController");

router.get("/", getUsers);
router.put("/", updateUser);
router.put("/balance", addBalance);
router.put("/delete/:id", deleteUser);

module.exports = router