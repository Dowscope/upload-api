const express = require("express");
const fs = require('fs');
const axios = require('axios');
const path = require('path');

module.exports = function register({ config, upload, createEntry, listTracks }) {
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


  router.get('/api/list_music', async (req, res, next) => {
    try {
      res.json(await listTracks());
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/getMusicFile', async (req, res, next) => {
    const { filename } = req.query;
    if (typeof filename !== 'string' || !filename.trim()) {
      return res.status(400).json({ error: 'filename query parameter is required' });
    }

    const libraryRoot = path.posix.resolve(config.files.musicLibraryRoot);
    const filePath = path.posix.resolve(libraryRoot, filename);
    if (filePath === libraryRoot || !filePath.startsWith(`${libraryRoot}/`)) {
      return res.status(400).json({ error: 'filename must identify a file inside the music library' });
    }

    console.log(`Getting Music File: ${filePath}`);
    const url = `http://${config.servers.music}/file`;
    try {
      const upstream = await axios.get(url, {
        params: { filename: filePath },
        headers: req.headers.range ? { Range: req.headers.range } : {},
        responseType: 'stream',
        validateStatus: () => true
      });

      res.status(upstream.status);
      for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        if (upstream.headers[header]) res.setHeader(header, upstream.headers[header]);
      }

      upstream.data.on('error', error => {
        if (!res.headersSent) return next(error);
        res.destroy(error);
      });
      upstream.data.pipe(res);
    } catch (error) {
      next(error);
    }
  });
  return router;
};
