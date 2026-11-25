const multer = require('multer');

function createUploadMiddleware(config) {
  const fileFilter = (req, file, callback) => {
    const allowedTypes = ['application/zip', 'application/octet-stream', 'text/markdown'];
    if (!allowedTypes.includes(file.mimetype) || file.originalname.slice(-3) === 'crp') {
      const error = new Error('Wrong file type');
      error.code = 'LIMIT_FILE_TYPES';
      return callback(error, false);
    }
    callback(null, true);
  };

  const storage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, config.files.uploadDir),
    filename: (req, file, callback) => callback(null, file.originalname)
  });

  return multer({ storage, fileFilter }).single('file');
}

module.exports = createUploadMiddleware;
