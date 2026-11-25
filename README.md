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

SELECT 
	ft.title,
    CONCAT(u.first_name, ' ',u.last_name) AS "user",
    fp.date_posted
FROM forum_category fc 
JOIN forum_topics ft ON ft.cat_id = fc.cat_id 
JOIN forum_posts fp ON fp.topic_id = ft.topic_id 
JOIN USERS u ON u.userid = fp.user_id; 
