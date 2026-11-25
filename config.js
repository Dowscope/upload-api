const path = require('path');
require('dotenv').config();

const envNumber = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
};

const envList = (name, fallback) =>
  (process.env[name] || fallback).split(',').map(value => value.trim()).filter(Boolean);

const envPath = (name, fallback) => {
  const value = process.env[name] || fallback;
  return path.isAbsolute(value) ? value : path.resolve(__dirname, value);
};

const config = {
  database: {
    host: process.env.DB_HOST || '192.168.1.14',
    user: process.env.DB_USER || 'dbuser',
    password: process.env.DB_PASSWORD || '',
    rtsDatabase: process.env.DB_RTS_DATABASE || 'RTS',
    mainDatabase: process.env.DB_MAIN_DATABASE || 'MAINSITE',
    musicDatabase: process.env.DB_MUSIC_DATABASE || 'music_catalog'
  },
  servers: {
    music: process.env.MUSIC_SERVER || '192.168.1.101',
    rts: process.env.RTS_SERVER || '192.168.1.113'
  },
  security: {
    saltRounds: envNumber('BCRYPT_SALT_ROUNDS', 10),
    sessionLengthDays: envNumber('SESSION_LENGTH_DAYS', 7)
  },
  api: {
    port: envNumber('API_PORT', 55000)
  },
  cors: {
    origins: envList('CORS_ORIGINS', [
      'http://localhost:55000',
      'http://localhost:8080',
      'http://dowscopemedia.ca'
    ].join(',')),
    methods: envList('CORS_METHODS', 'GET,POST'),
    allowedHeaders: envList('CORS_ALLOWED_HEADERS', 'Content-Type,Authorization')
  },
  files: {
    uploadDir: envPath('UPLOAD_DIR', 'uploads'),
    fileList: envPath('FILE_LIST_PATH', 'fileList.json'),
    musicRecordDir: envPath('MUSIC_RECORD_DIR', '/store/Music/Records')
  }
};

if (!config.database.password) {
  throw new Error('DB_PASSWORD is required. Set it in .env or the process environment.');
}

module.exports = config;
