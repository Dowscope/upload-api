const express  = require('express');
const multer = require('multer');
const bp = require('body-parser');
const fs = require('fs');
const { send } = require('process');
const { Console } = require('console');
const path = require('path');

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
  const timestamp = new Date(Date.now());
  const year = timestamp.getFullYear();
  const month = timestamp.getMonth();
  const day = timestamp.getDate();
  const hours = timestamp.getHours();
  const minutes = timestamp.getMinutes();
  console.log(year + '-' + month + '-' + day + ' ' + hours + ':' + minutes);
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
  fs.stat(filePath, function(err, stat) {
    if (err == null){
      const data = fs.readFileSync(filePath);
      res.send(data.toString('base64'));
      // res.sendFile(filePath);
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