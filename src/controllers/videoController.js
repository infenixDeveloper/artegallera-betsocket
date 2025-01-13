const multer = require("multer");
const path = require("path");
const fs = require("fs");
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
  upload.single("video")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Error de Multer: ${err.message}` });
      } else {
        return res.status(400).json({ error: `Error al cargar el archivo: ${err.message}` });
      }
    }

    if (!req.file) {
      return res.status(400).json({ error: "No se ha cargado ningún archivo" });
    }

    const { name, type, is_event_video } = req.body; // Extraer el nombre del video del cuerpo de la solicitud
    if (!name) {
      return res.status(400).json({ error: "El nombre del video es obligatorio" });
    }

    try {
      const customFileName = `${name}-${Date.now()}${path.extname(req.file.originalname)}`;
      const newFilePath = path.join(req.file.destination, customFileName);

      // Renombrar el archivo con el nombre personalizado
      fs.renameSync(req.file.path, newFilePath);

      await promotions.create({
        file: customFileName,
        type,
        status: true,
        is_event_video
      });

      res.status(200).json({
        message: "Archivo cargado exitosamente",
        fileName: customFileName,
      });
    } catch (error) {
      res.status(500).json({ error: `Error al guardar en la base de datos: ${error.message}` });
    }
  });
};


const getAllVideos = async (req, res) => {
  let result = {};
  try {
    const promotionsList = await promotions.findAll();

    if (promotionsList) {
      result = {
        success: true,
        promotions: promotionsList,
      };
    } else {
      result = {
        success: false,
        message: "No se encontraron promociones"
      };
    }
    return res.json(result);

  } catch (error) {
    result = {
      success: false,
      message: `Error al obtener las promociones: ${error.message}`
    };

    return res.status(500).json(result);
  }
};

const deleteVideo = async (req, res) => {
  const { id } = req.params; // ID del registro a eliminar

  try {
    // Buscar el registro en la base de datos
    const promotion = await promotions.findByPk(id);

    if (!promotion) {
      return res.status(404).json({ success: false, message: "Registro no encontrado" });
    }

    // Obtener la ruta completa del archivo
    const filePath = path.join(
      "E:/Proyectos/Alex/arteGallera-landing/public/uploads",
      promotion.file
    );

    // Verificar si el archivo existe y eliminarlo
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Eliminar el archivo
    } else {
      console.warn(`Archivo no encontrado en: ${filePath}`);
    }

    // Eliminar el registro de la base de datos
    await promotions.destroy({ where: { id } });

    return res.status(200).json({ success: true, message: "Promoción eliminada exitosamente" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error al eliminar la promoción: ${error.message}`,
    });
  }
};

module.exports = { uploadVideo, getAllVideos, deleteVideo };
