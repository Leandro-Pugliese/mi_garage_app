const multer = require('multer');

//Configuración Multer.
const storage = multer.memoryStorage();
const upload = multer({ storage });
const uploadImagen = upload.single('imagen');

module.exports = {uploadImagen}
