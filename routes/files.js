const express = require("express");
const fs = require('fs');

module.exports = function register({ config }) {
  const router = express.Router();
  router.post('/download', (req, res) => {
    const fileName = req.body['fileName'];
    const dl_type = req.body['dl_type'];
    let filePath = "";
    console.log('dltype: ' + dl_type);
    if (dl_type === 'music'){
      filePath = config.files.musicRecordDir + fileName;
    } else {
      filePath = config.files.uploadDir + '/' + fileName;
    }
    console.log('Trying to download ' + filePath);
    fs.stat(filePath, function(err, stat) {
      if (err){
        console.log('File not found: ' + filePath);
        res.send(err);
        return;
      }
      if (dl_type != 'music') {
        fs.readFile(config.files.fileList, (readErr, data) => {
          if (readErr) {
            res.send(readErr);
            return;
          } else {
            var list = JSON.parse(data)
            var fileFound = list.filter( (item) => {
              return item.fileName == fileName;
            });
            const index = list.indexOf(fileFound[0]);
            delete list[index];
            var tempArry = [];
            for (let i of list) {
              i && tempArry.push(i);
            }
            list = tempArry;

            fileFound[0].downloaded = true;
            list.push(fileFound[0]);

            console.log(list);

            const jsonStr = JSON.stringify(list);
            fs.writeFile(config.files.fileList, jsonStr, (wriErr) => {
              if (wriErr) {
                console.log(wriErr);
                res.send(wriErr);
                return;
              } else {
                console.log('File added successfully');
              }
            });
          }
        });
      }
      const data = fs.readFileSync(filePath);
      res.send(data.toString('base64'));
    });
  });

  router.post('/remove', (req, res) => {
    const filename = req.body['filename'];

    fs.readFile(config.files.fileList, (readErr, data) => {
      if (readErr) {
        console.log ("REMOVE: " + readErr);
        res.send(readErr);
        return;
      }
      var list = JSON.parse(data)
      var fileFound = list.filter( (item) => {
        return item.fileName != filename;
      });
      list = fileFound;

      const jsonStr = JSON.stringify(list);
      fs.writeFile(config.files.fileList, jsonStr, (wriErr) => {
        if (wriErr) {
          console.log("REMOVED: " + wriErr);
          res.send(wriErr);
          return;
        } else {
          console.log('File Removed successfully');
        }
      });
      res.send(filename + " Removed");
    });
  });
  return router;
};
