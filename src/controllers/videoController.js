const multer = require("multer");
const path = require("path");
const { promotions } = require('../db');

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Directorio de destino para los archivos
    cb(null, "/var/www/html/uploads");
  },
  filename: (req, file, cb) => {
    // Nombre único para cada archivo
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Filtro de tipos de archivo permitidos
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["video/mp4", "video/mkv", "video/webm", "video/avi"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // Archivo aceptado
  } else {
    cb(new Error("Tipo de archivo no permitido. Solo se aceptan videos."), false);
  }
};

// Configuración de Multer con límites de tamaño
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1000 * 1024 * 1024 }
});

// Controlador para manejar la carga del video
const uploadVideo = (req, res) => {
  // Middleware de Multer para cargar un solo archivo
  upload.single("video")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Errores específicos de Multer
        return res.status(400).json({ error: err.message });
      } else {
        // Otros errores
        return res.status(400).json({ error: err.message });
      }
    }

    if (!req.file) {
      // Si no se ha cargado ningún archivo
      return res.status(400).json({ error: "No se ha cargado ningún archivo" });
    }

    await promotions.create({
      file: req.file.filename,
      status: true
    });

    // Respuesta exitosa con la ruta del archivo
    res.status(200).json({
      message: "Archivo cargado exitosamente",
      // filePath: `uploads/${req.file.filename}`
    });
  });
};

const getPromotions = async (req, res) => {
  let result = {};
  try {
    const promotionsList = await promotions.findAll();

    if (promotionsList) {
      result = {
        success: true,
        promotions: promotionsList,
        message: "Promotions list"
      };
    }
    return res.json(result);

  } catch (error) {
    result = {
      success: false,
      message: error.message
    };

    return res.status(500).json(result);
  }

};

module.exports = { uploadVideo, getPromotions };
