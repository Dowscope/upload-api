const express  = require('express');
const multer = require('multer');
const bp = require('body-parser');
const fs = require('fs');
const { send } = require('process');
const { Console } = require('console');
const path = require('path');
const { registerRuntimeCompiler } = require('vue');

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
  const fileEntry = {
    fileName: req.file.filename,
    uploaded: timestamp.toDateString() + ' ' + timestamp.toLocaleTimeString(),
    timestamp: timestamp,
  }
  fs.stat('./fileList.json', (err, stat) => {
    if (err) {
      console.log('file doesnt exist');
      const obj = {
        files: [
          fileEntry,
        ],
      }
      const jsonStr = JSON.stringify(obj);
      fs.writeFile('fileList.json', jsonStr, (wriErr) => {
        if (wriErr) {
          console.log(wriErr);
        } else {
          console.log('File created successfully');
        }
      });
    } else {
      console.log('file exists');
      fs.readFile('fileList.json', (readErr, data) => {
        if (readErr) {
          console.log(readErr);
        } else {
          list = JSON.parse(data)
          list.files.push(fileEntry);
          console.log(list);
        }
      })
    }
  })
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