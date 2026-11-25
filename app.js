const express = require('express');
const cors = require('cors');
const config = require('./config');
const { createPools, validateSessionQuery } = require('./db');
const createUploadMiddleware = require('./middleware/upload');
const createAuthServices = require('./services/auth');
const createFileCatalog = require('./services/fileCatalog');
const createMusicCatalog = require('./services/musicCatalog');
const registerRoutes = require('./routes');

function createApp() {
  const app = express();
  const pools = createPools(config);
  const auth = createAuthServices({
    pool: pools.main,
    saltRounds: config.security.saltRounds,
    validateSessionQuery
  });
  const fileCatalog = createFileCatalog(config);
  const musicCatalog = createMusicCatalog(pools.music);

  app.use(cors({
    origin: config.cors.origins,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders
  }));
  app.use(express.json());

  registerRoutes(app, {
    config,
    pool: pools.rts,
    pool_main: pools.main,
    validateSessionQuery,
    upload: createUploadMiddleware(config),
    ...auth,
    ...fileCatalog,
    ...musicCatalog
  });

  app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_TYPES') {
      return res.status(422).json({ error: 'Only game files are allowed' });
    }
    return next(err);
  });

  return app;
}

module.exports = createApp;
