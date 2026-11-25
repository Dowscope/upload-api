# upload-api

## Configuration

The API loads configuration from a `.env` file in the project directory using
`dotenv`. Copy `.env.example` to `.env` and change the values for your
environment. `DB_PASSWORD` is required. Keep `.env` private; `.env.example` is
safe to commit and documents every configurable setting.

```sh
cp .env.example .env
npm install
npm start
```

Comma-separated CORS settings accept multiple values. Relative file paths are
resolved from the project directory. Environment variables supplied by the
process manager override values loaded from `.env`.

## Code layout

- `index.js` starts the server.
- `app.js` configures Express middleware and wires dependencies together.
- `config.js`, `db.js`, and `middleware/` handle configuration, database pools,
  and upload handling.
- `services/` contains reusable authentication and file catalog logic.
- `routes/` separates uploads and music, RTS, holidays, users, files, and forum
  endpoints.
