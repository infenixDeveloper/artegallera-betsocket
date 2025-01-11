const { Router } = require("express");
const router = Router();
const { uploadVideo, getAllVideos } = require("../controllers/videoController");


router.get("/", getAllVideos);
router.post("/upload", uploadVideo);

module.exports = router;