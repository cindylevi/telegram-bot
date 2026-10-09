CREATE TABLE usernames (
  user_id  INTEGER PRIMARY KEY,
  username TEXT    NOT NULL
);

CREATE INDEX usernames_username ON usernames (username);
