const { Router } = require("express");
const router = Router();
const { GetAll,GetId, Create, Update, Delete} = require("../controllers/roundsController.js");
const {validateToken} = require("../middlewares/validateToken.js");

router.get("/",validateToken,GetAll)
router.get("/:id",validateToken,GetId)
router.post("/create",validateToken,Create);
router.post("/update/:id",validateToken,Update);
router.post("/delete/:id",validateToken,Delete);

module.exports = router;