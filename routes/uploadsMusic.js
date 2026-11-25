const express = require("express");
const fs = require('fs');
const axios = require('axios');

module.exports = function register({ config, upload, createEntry }) {
  const router = express.Router();
  router.post('/uploads', upload, async (req, res) => {
    const result = await createEntry(req.file.originalname);
    res.json({ success: result.success, reason: result.reason, file: req.file});
  });

  router.get('/list', function(req, res) {
    fs.readFile(config.files.fileList, (readErr, data) => {
      if (readErr) {
        console.log("LIST ERROR: " + readErr);
        res.send(readErr);
        return;
      } else {
        var list = JSON.parse(data);
        const jsonLst = JSON.stringify(list);
        console.log("LIST requested");
        res.send(jsonLst);
      }
    })
  });


  router.get('/api/list_music', async (req, res) => {
    const url = `http://${config.servers.music}/list`;
    const rs = await axios.get(url);
    // console.log(rs);
    res.json(rs.data);
  });

  router.get('/api/getMusicFile', async (req, res) => {
    const { filename } = req.query;
    console.log(`Getting Music File: ${filename}`);
    const url = `http://${config.servers.music}/file`;
    const rs = await axios.get(url, {
      params: {
        filename: filename,
      },
    });
    console.log(rs.headers);
    res.send(rs.data);
  });
  return router;
};
