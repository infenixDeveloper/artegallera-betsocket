const { Router } = require("express");
const router = Router();
const { uploadVideo, getPromotions } = require("../controllers/videoController");


router.post("/upload", uploadVideo);
router.get("/promotions", getPromotions);

module.exports = router;