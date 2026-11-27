const LIST_TRACKS_QUERY = `
  SELECT
    tracks.relative_path AS Filename,
    CONCAT(TRIM(TRAILING '/' FROM library.root), '/', tracks.relative_path) AS Path,
    tracks.relative_path AS RelativePath,
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

function createMusicCatalog(pool) {
  // The current catalog has one library root and stores track paths relative to it.
  async function listTracks() {
    const [tracks] = await pool.promise().query(LIST_TRACKS_QUERY);
    return tracks.map(({ MusicKey, ...track }) => ({ ...track, Key: MusicKey }));
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

    const setClause = updates.map(([column]) => `\`${column}\` = ?`).join(', ');
    const values = updates.map(([, value]) => value);
    values.push(relativePath);
    await pool.promise().query(
      `UPDATE tracks SET ${setClause} WHERE relative_path = ?`,
      values
    );
  }

  return { listTracks, updateTrackMetadata };
}

module.exports = createMusicCatalog;
