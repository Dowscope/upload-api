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
The music catalog database is selected with `DB_MUSIC_DATABASE`.

## Website deployment webhook

`POST /updatesite` deploys the configured Vue repository when GitHub sends a
push event for the configured branch. Set these values in the API's `.env`:

- `SITE_REPOSITORY_URL`: clone URL for the website repository.
- `SITE_REPOSITORY_BRANCH`: branch to deploy (defaults to `main`).
- `SITE_WEBHOOK_SECRET`: a long random secret shared with the GitHub webhook.
- `SITE_WEB_ROOT`: destination directory (defaults to
  `/var/www/dowscopemedia.ca/public_html`).
- `SITE_BUILD_OUTPUT`: build output directory relative to the repository
  (defaults to `dist`).

The webhook responds with HTTP 202 while deployment runs in the background,
so GitHub does not time out while dependencies install and the site builds.
Check the API service logs for completion or failure. The repository must have
a `package-lock.json` and a `build` npm script. The server needs Git, Node.js/npm,
and `rsync`. The API service account needs
permission to write the web root; for a systemd service, set `User=` and
`Group=` in `myapi.service` to an account that can write there, then reload and
restart the unit. A failed clone, install, or build leaves the current site
files untouched. Successful deployments mirror the build output, removing
stale files from the destination.

In GitHub, add a repository webhook with the API's public URL ending in
`/updatesite`, content type `application/json`, the same secret, and the
`Just the push event` option. Configure TLS on the public endpoint. GitHub's
initial delivery can be used to verify the deployment; pushes to other branches
are acknowledged and ignored.

## Code layout

- `index.js` starts the server.
- `app.js` configures Express middleware and wires dependencies together.
- `config.js`, `db.js`, and `middleware/` handle configuration, database pools,
  and upload handling.
- `services/` contains reusable authentication and file catalog logic.
- `routes/` separates uploads and music, RTS, holidays, users, files, and forum
  endpoints.
