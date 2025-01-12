const { Router } = require("express");
const router = Router();
const { uploadVideo, getAllVideos, deleteVideo } = require("../controllers/videoController");


router.get("/", getAllVideos);
router.post("/upload", uploadVideo);
router.delete("/:id", deleteVideo);

module.exports = router;