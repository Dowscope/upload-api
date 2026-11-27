const express = require("express");
const fs = require('fs');
const axios = require('axios');
const path = require('path');

module.exports = function register({ config, upload, createEntry, listTracks, listTracksPage, getTrackCount, getTopTracks, incrementTrackCounter, updateTrackMetadata, verifyAdminSession }) {
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

  const musicStatusHandler = async (req, res, next) => {
    try {
      return res.json({ totalSongs: await getTrackCount() });
    } catch (error) {
      return next(error);
    }
  };
  router.get('/status', musicStatusHandler);
  router.get('/api/status', musicStatusHandler);


  router.get('/api/list_music', async (req, res, next) => {
    try {
      res.json(await listTracks());
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/list_music_page', async (req, res, next) => {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 100);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
      return res.status(400).json({ error: 'page and pageSize must be positive integers' });
    }

    const filters = {
      title: req.query.title,
      artist: req.query.artist,
      genre: req.query.genre,
      year: req.query.year,
      bpm: req.query.bpm,
      key: req.query.key
    };
    try {
      return res.json(await listTracksPage({
        page,
        pageSize,
        filters,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      }));
    } catch (error) {
      return next(error);
    }
  });

  router.get('/api/top_played', async (req, res, next) => {
    try {
      return res.json(await getTopTracks('play'));
    } catch (error) {
      return next(error);
    }
  });

  router.get('/api/top_downloaded', async (req, res, next) => {
    try {
      return res.json(await getTopTracks('download'));
    } catch (error) {
      return next(error);
    }
  });

  async function recordMusicEvent(req, res, counter) {
    const filename = req.body && (req.body.filename || req.body.Filename || req.body.RelativePath);
    if (typeof filename !== 'string' || !filename.trim()) {
      return res.status(400).json({ error: 'filename is required' });
    }

    const relativePath = path.posix.normalize(filename);
    if (path.posix.isAbsolute(relativePath) || relativePath === '.' || relativePath === '..' || relativePath.startsWith('../')) {
      return res.status(400).json({ error: 'filename must identify a file inside the music library' });
    }

    try {
      const counts = await incrementTrackCounter(relativePath, counter);
      return res.json({ success: true, ...counts });
    } catch (error) {
      if (error.message === 'Track was not found in the music catalog') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Could not update music counters' });
    }
  }

  router.post('/api/recordMusicPlay', (req, res) => recordMusicEvent(req, res, 'play'));
  router.post('/api/recordMusicDownload', (req, res) => recordMusicEvent(req, res, 'download'));

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
    const url = `http://${config.servers.music}/api/file`;
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

  router.post('/api/updateMusicMetadata', async (req, res) => {
    const { session_id, email } = req.body || {};
    const filename = req.body && (req.body.filename || req.body.Filename || req.body.RelativePath);
    const metadata = req.body && (req.body.metadata || req.body);

    if (!session_id || !email) {
      return res.status(401).json({ error: 'A valid user session is required' });
    }

    const auth = await verifyAdminSession(session_id, email);
    if (!auth || !auth.success) {
      return res.status(401).json({ error: 'Invalid or expired user session' });
    }
    if (!auth.isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (typeof filename !== 'string' || !filename.trim()) {
      return res.status(400).json({ error: 'filename is required' });
    }

    const relativePath = path.posix.normalize(filename);
    if (path.posix.isAbsolute(relativePath) || relativePath === '.' || relativePath === '..' || relativePath.startsWith('../')) {
      return res.status(400).json({ error: 'filename must identify a file inside the music library' });
    }

    const tags = {};
    const fieldMap = {
      title: ['title', 'Title'],
      artist: ['artist', 'Artist', 'Author'],
      album: ['album', 'Album'],
      year: ['year', 'Year'],
      trackNumber: ['trackNumber', 'TrackNumber'],
      genre: ['genre', 'Genre'],
      bpm: ['bpm', 'BPM'],
      key: ['key', 'Key', 'MusicKey']
    };
    for (const [tag, keys] of Object.entries(fieldMap)) {
      const value = keys.map(key => metadata[key]).find(value => value !== undefined);
      if (value !== undefined) tags[tag] = value;
    }
    if (Object.keys(tags).length === 0) {
      return res.status(400).json({ error: 'No editable metadata fields were provided' });
    }

    try {
      const upstream = await axios.post(`http://${config.servers.music}/api/update`, {
        filename: relativePath,
        ...tags
      }, { timeout: 30000 });

      try {
        await updateTrackMetadata(relativePath, tags);
      } catch (error) {
        console.error('MP3 tags were updated, but the music catalog update failed:', error.message);
        return res.status(500).json({
          error: 'The file tags were updated, but the catalog could not be updated',
          fileUpdated: true,
          catalogUpdated: false
        });
      }

      return res.json({
        success: true,
        updated: upstream.data && upstream.data.updated ? upstream.data.updated : Object.keys(tags)
      });
    } catch (error) {
      console.error('Music metadata update failed:', error.message);
      return res.status(502).json({ error: 'Music server could not update the file metadata' });
    }
  });
  return router;
};
