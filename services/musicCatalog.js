const LIST_TRACKS_QUERY = `
  SELECT
    tracks.relative_path AS Filename,
    CONCAT(TRIM(TRAILING '/' FROM library.root), '/', tracks.relative_path) AS Path,
    tracks.relative_path AS RelativePath,
    tracks.modified_at AS modified_at,
    tracks.modified_at AS ModifiedAt,
    COALESCE(NULLIF(tracks.recording_date, ''), 'Unknown') AS Year,
    COALESCE(NULLIF(tracks.title, ''), 'Unknown') AS Title,
    COALESCE(NULLIF(tracks.artist, ''), NULLIF(tracks.album_artist, ''), 'Unknown') AS Author,
    COALESCE(NULLIF(tracks.artist, ''), NULLIF(tracks.album_artist, ''), 'Unknown') AS Artist,
    COALESCE(NULLIF(tracks.album, ''), 'Unknown') AS Album,
    COALESCE(NULLIF(tracks.genre, ''), 'Unknown') AS Genre,
    COALESCE(NULLIF(tracks.bpm, ''), 'Unknown') AS BPM,
    COALESCE(NULLIF(tracks.musical_key, ''), 'Unknown') AS MusicKey,
    ROUND(tracks.duration_seconds * 1000) AS Length,
    tracks.size_bytes AS SizeBytes
  FROM tracks
  CROSS JOIN (SELECT root FROM library ORDER BY id LIMIT 1) AS library
  ORDER BY tracks.title
`;

const MUSIC_FILTERS = {
  title: 'tracks.title',
  artist: "COALESCE(NULLIF(tracks.artist, ''), NULLIF(tracks.album_artist, ''), 'Unknown')",
  genre: 'tracks.genre',
  year: 'tracks.recording_date',
  bpm: 'tracks.bpm',
  key: 'tracks.musical_key'
};

const MUSIC_SORTS = {
  modified: 'tracks.modified_at',
  title: 'tracks.title',
  artist: "COALESCE(NULLIF(tracks.artist, ''), NULLIF(tracks.album_artist, ''), 'Unknown')",
  genre: 'tracks.genre',
  year: 'tracks.recording_date',
  bpm: 'tracks.bpm',
  key: 'tracks.musical_key'
};

function createMusicCatalog(pool) {
  // The current catalog has one library root and stores track paths relative to it.
  async function listTracks() {
    const [tracks] = await pool.promise().query(LIST_TRACKS_QUERY);
    return tracks.map(({ MusicKey, ...track }) => ({ ...track, Key: MusicKey }));
  }

  async function listTracksPage({ page = 1, pageSize = 100, filters = {}, sortBy = 'modified', sortOrder = 'asc' } = {}) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safePageSize = Math.min(200, Math.max(1, Math.floor(Number(pageSize) || 100)));
    const safeSort = MUSIC_SORTS[sortBy] ? sortBy : 'modified';
    const direction = String(sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const conditions = [];
    const values = [];

    for (const [filter, column] of Object.entries(MUSIC_FILTERS)) {
      const term = filters[filter];
      if (typeof term === 'string' && term.trim()) {
        conditions.push(`${column} LIKE ?`);
        values.push(`%${term.trim().slice(0, 100)}%`);
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRows] = await pool.promise().query(
      `SELECT COUNT(*) AS total FROM tracks ${whereClause}`,
      values
    );
    const total = Number(countRows[0].total);

    const pageQuery = `${LIST_TRACKS_QUERY.replace('ORDER BY tracks.title', '')}
      ${whereClause}
      ORDER BY ${MUSIC_SORTS[safeSort]} ${direction}, tracks.relative_path ASC
      LIMIT ? OFFSET ?`;
    const offset = (safePage - 1) * safePageSize;
    const [tracks] = await pool.promise().query(pageQuery, [...values, safePageSize, offset]);

    return {
      items: tracks.map(({ MusicKey, ...track }) => ({ ...track, Key: MusicKey })),
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize)
    };
  }

  async function updateTrackMetadata(relativePath, metadata) {
    const columns = {
      title: metadata.title,
      artist: metadata.artist,
      album_artist: metadata.artist,
      album: metadata.album,
      recording_date: metadata.year,
      genre: metadata.genre,
      bpm: metadata.bpm,
      musical_key: metadata.key
    };
    const updates = Object.entries(columns).filter(([, value]) => value !== undefined);
    if (updates.length === 0) return;

    const [tracks] = await pool.promise().query(
      'SELECT 1 FROM tracks WHERE relative_path = ? LIMIT 1',
      [relativePath]
    );
    if (tracks.length === 0) throw new Error('Track was not found in the music catalog');

    const setClause = [
      ...updates.map(([column]) => `\`${column}\` = ?`),
      '`modified_at` = CURRENT_TIMESTAMP'
    ].join(', ');
    const values = updates.map(([, value]) => value);
    values.push(relativePath);
    await pool.promise().query(
      `UPDATE tracks SET ${setClause} WHERE relative_path = ?`,
      values
    );
  }

  return { listTracks, listTracksPage, updateTrackMetadata };
}

module.exports = createMusicCatalog;
