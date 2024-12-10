const { Router } = require("express");
const router = Router();
const { validateToken } = require("../middlewares/validateToken.js");
const { getAllWinner, getWinnerByEvent } = require("../controllers/winnerController.js");

router.get("/", validateToken, getAllWinner)
router.get("/event/:id", validateToken, getWinnerByEvent)


module.exports = router;