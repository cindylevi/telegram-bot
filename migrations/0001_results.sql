CREATE TABLE results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  user_name   TEXT    NOT NULL,
  game        TEXT    NOT NULL,
  puzzle      TEXT    NOT NULL,
  score       REAL,
  display     TEXT    NOT NULL,
  day         TEXT    NOT NULL,
  message_id  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (chat_id, user_id, game, puzzle)
);

CREATE INDEX results_chat_day ON results (chat_id, day);
