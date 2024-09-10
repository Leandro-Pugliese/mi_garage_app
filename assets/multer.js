const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

//Configuración del almacenamiento de Multer para usar Cloudinary.
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'actividades', //Carpeta donde se guardarán las imágenes en Cloudinary.
    allowed_formats: ['jpg', 'jpeg', 'png'], //Formatos permitidos.
    transformation: [{ width: 400, height: 400, crop: 'limit' }] //Opcional.
  }
});

//Configuración Multer con el almacenamiento de Cloudinary.
const upload = multer({ storage: storage });
const uploadImagen = upload.single('imagen')

module.exports = {uploadImagen}
