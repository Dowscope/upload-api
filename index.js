const express  = require('express');
const multer = require('multer');
const bp = require('body-parser');
const fs = require('fs');
const dj = require('downloadjs');
const { send } = require('process');
const { Console } = require('console');
const download = require('downloadjs');

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
    res.send(files);
  })
});

app.use(bp.json());

app.post('/download', (req, res) => {
  fileName = req.body['fileName'];
  filePath = __dirname + '/uploads/' + fileName;
  console.log(filePath);
  fs.stat(filePath, function(err, stat) {
    if (err == null){
      download(filePath);
      res.send('OK');
    } else {
      res.send(err);
    }
  })
});

app.use(function(err, req, res, next) {
  if (err.code === "LIMIT_FILE_TYPES"){
    res.status(422).json({ error: "Only ZIP files are allowed" })
    return;
  }
});

app.listen(55000, () => console.log("Running on port: 55000"));