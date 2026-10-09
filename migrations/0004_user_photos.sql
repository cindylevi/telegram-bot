CREATE TABLE user_photos (
  user_id    INTEGER PRIMARY KEY,
  file_id    TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE photo_requests (
  user_id      INTEGER PRIMARY KEY,
  requested_at INTEGER NOT NULL
);
