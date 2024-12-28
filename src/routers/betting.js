const { Router } = require("express");
const router = Router();
const { GetAll, GetId, Create, Update, Delete, GetBetsByTeam, getBetsByRound } = require("../controllers/bettingController.js");
const { validateToken } = require("../middlewares/validateToken.js");
const { get } = require("http");

router.get("/", validateToken, GetAll)
router.get("/:id", validateToken, GetId)
router.get("/rounds/:id", validateToken, getBetsByRound);
router.post("/create", validateToken, Create);
router.post("/update/:id", validateToken, Update);
router.post("/delete/:id", validateToken, Delete);
router.post("/amount/", validateToken, GetBetsByTeam);

module.exports = router;