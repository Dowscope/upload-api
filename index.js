const express  = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { send } = require('process');

const app = express();

const fileFilter = function(req, file, cb){
  const allowedTypes = ["application/zip"];
  if (!allowedTypes.includes(file.mimetype)){
    const error = new Error("Wrong file type");
    error.code = "LIMIT_FILE_TYPES";
    return cb(error, false);
  }
  cb(null, true);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads');
  },
  filename: function ( req, file, cb ){
    cb(null, file.originalname);
  },
  fileFilter
});

const upload = multer({storage: storage});

app.post('/uploads', upload.single('file'), (req, res) => {
  res.json({ file: req.file });
});

app.get('/list', function(req, res) {
  fs.readdir('./uploads', (err, files) => {
    if (err) {
      throw err;
    }
    console.log(res.status);
    res.send(files);
  })
});

app.use(function(err, req, res, next) {
  if (err.code === "LIMIT_FILE_TYPES"){
    res.status(422).json({ error: "Only ZIP files are allowed" })
    return;
  }
});

app.listen(55000, () => console.log("Running on port: 55000"));