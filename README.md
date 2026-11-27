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
`MUSIC_LIBRARY_ROOT` is the absolute library path on the music server; the
default is `/storage/Music`. The music playback endpoint adds this root to the
relative filename supplied by the browser before requesting the file.

`GET /api/list_music_page` queries the catalog in pages instead of returning
all tracks. It accepts `page` (default `1`), `pageSize` (default `100`, maximum
`200`), text filters `title`, `artist`, `genre`, `year`, `bpm`, and `key`, plus
`sortBy` and `sortOrder`. The response contains `items`, `page`, `pageSize`,
`total`, and `totalPages`. Each item includes `ModifiedAt`, the last time the
track was added to the database or modified. The existing `/api/list_music`
route remains available for clients that still expect the complete array.
`GET /api/status` returns the catalog size as `{ "totalSongs": number }`.
`/status` is also available when calling the API server directly.
`GET /api/top_played` and `GET /api/top_downloaded` each return up to ten
tracks with nonzero counts, ordered by the corresponding count. Their response
items contain track metadata only; the count is used for ranking but omitted.

`POST /api/updateMusicMetadata` accepts the track `filename`, metadata fields,
and the logged-in user's `session_id` and `email`. It verifies the session and
requires `user_type_id = 1` for admin access (`2` is a regular user). It then
forwards the tag changes to the music server's `POST /api/update`, and updates
the corresponding catalog row after the music server succeeds. Editable fields
include `title`, `artist`, `album`, `year`, `trackNumber`, `genre`, `bpm`, and
`key`. The music server's file endpoint is `GET /api/file`.

`POST /api/getUsers` requires `session_id` and `email` in the JSON body and
returns basic user fields (`userid`, `email`, `first_name`, `last_name`, and
`user_type_id`) plus `last_login_at`. It uses the same admin check and does not
return passwords.

The webpage can increment music usage counters with `POST /api/recordMusicPlay`
or `POST /api/recordMusicDownload`, each with `{ "filename": "relative/path.mp3" }`.
Music list results include `PlayCount` and `DownloadCount`.

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
