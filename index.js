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
  const timestamp = new Date(Date.now());
  const fileEntry = {
    fileName: req.file.filename,
    uploaded: timestamp.toDateString() + ' ' + timestamp.toLocaleTimeString(),
    timestamp: timestamp,
    downloaded: false,
  }
  fs.stat('./fileList.json', (err, stat) => {
    if (err) {
      const obj = [
          fileEntry,
      ]
      const jsonStr = JSON.stringify(obj);
      fs.writeFile('fileList.json', jsonStr, (wriErr) => {
        if (wriErr) {
          res.send(wriErr);
          return
        } else {
          console.log('File created successfully');
        }
      });
    } else {
      fs.readFile('fileList.json', (readErr, data) => {
        if (readErr) {
          res.send(readErr);
          return;
        } else {
          rawdata = data;
          var list = JSON.parse(data);
          list.push(fileEntry);
          const jsonStr = JSON.stringify(list);
          fs.writeFile('fileList.json', jsonStr, (wriErr) => {
            if (wriErr) {
              res.send(wriErr);
              return;
            } else {
              console.log('File added successfully');
            }
          });
        }
      });
    }
  });
  res.json({ file: req.file });
});

app.get('/list', function(req, res) {
  fs.readFile('fileList.json', (readErr, data) => {
    if (readErr) {
      res.send(readErr);
      return;
    } else {
      var list = JSON.parse(data);
      const jsonLst = JSON.stringify(list);
      res.send(jsonLst);
    }
  })
});

app.use(bp.json());

app.post('/download', (req, res) => {
  fileName = req.body['fileName'];
  filePath = __dirname + '/uploads/' + fileName;
  fs.stat(filePath, function(err, stat) {
    if (err){
      res.send(err);
    } else {
      global.updateData = false;
      fs.readFile('fileList.json', (readErr, data) => {
        if (readErr) {
          res.send(readErr);
          return;
        } else {
          updateData = true;
          // list = JSON.parse(data)
          // var fileFound = list.filter( (item) => {
          //   return item.fileName == fileName;
          // });
          
          // const index = list.indexOf(fileFound[0]);
          // delete list[index];

          
          // var tempArry = [];
          // for (let i of list) {
          //   i && tempArry.push(i);
          // }

          // list = tempArry;
          
          // fileFound.downloaded = true;
          // list.push(fileFound[0]);

          // updateAry = true;
        }
      });
      
      console.log(updateData);
      // if (updateAry) {
      //   const jsonStr = JSON.stringify(list);
      //   fs.writeFile('fileList.json', jsonStr, (wriErr) => {
      //     if (wriErr) {
      //       console.log(wriErr);
      //       res.send(wriErr);
      //       return;
      //     } else {
      //       console.log('File added successfully');
      //     }
      //   });
      // }
      const data = fs.readFileSync(filePath);
      res.send(data.toString('base64'));
    }
  })
});

app.use(function(err, req, res, next) {
  if (err.code === "LIMIT_FILE_TYPES"){
    res.status(422).json({ error: "Only game files are allowed" })
    return;
  }
});

app.listen(55000, () => console.log("Running on port: 55000"));