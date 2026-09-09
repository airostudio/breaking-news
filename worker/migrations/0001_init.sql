-- BNO (Breaking News Outlet) initial schema
-- IDs are TEXT UUIDs (generated with crypto.randomUUID() in application code),
-- used consistently across all tables for simplicity of cross-referencing.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('contributor', 'outlet', 'editor', 'admin')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE submissions (
  id                          TEXT PRIMARY KEY,
  contributor_id              TEXT NOT NULL REFERENCES users(id),
  headline                    TEXT NOT NULL,
  description                 TEXT NOT NULL DEFAULT '',
  location_text               TEXT,
  lat                         REAL,
  lng                         REAL,
  captured_at                 TEXT,
  media_type                  TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  object_key                  TEXT NOT NULL,
  thumbnail_key               TEXT,
  contributor_contact_method  TEXT,
  contributor_contact_value   TEXT,
  tags_json                   TEXT NOT NULL DEFAULT '[]',
  status                      TEXT NOT NULL DEFAULT 'pending_verification'
                                CHECK (status IN ('pending_verification', 'verified', 'rejected', 'listed', 'sold')),
  verification_score          INTEGER,
  created_at                  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_submissions_contributor_id ON submissions(contributor_id);
CREATE INDEX idx_submissions_status ON submissions(status);

CREATE TABLE verification_notes (
  id            TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  author        TEXT NOT NULL,
  note          TEXT NOT NULL,
  source_type   TEXT NOT NULL CHECK (source_type IN ('on_ground_contact', 'witness', 'wire_service', 'cross_reference', 'other')),
  corroborates  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_verification_notes_submission_id ON verification_notes(submission_id);

CREATE TABLE listings (
  id                  TEXT PRIMARY KEY,
  submission_id       TEXT NOT NULL UNIQUE REFERENCES submissions(id),
  listing_type        TEXT NOT NULL CHECK (listing_type IN ('buy_now', 'auction', 'both')),
  buy_now_price_cents INTEGER,
  starting_bid_cents  INTEGER,
  auction_ends_at     TEXT,
  status              TEXT NOT NULL DEFAULT 'listed'
                        CHECK (status IN ('listed', 'sold', 'closed', 'cancelled')),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_listings_status ON listings(status);

CREATE TABLE bids (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT NOT NULL REFERENCES listings(id),
  outlet_id   TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_bids_listing_id ON bids(listing_id);

CREATE TABLE transactions (
  id                    TEXT PRIMARY KEY,
  listing_id            TEXT NOT NULL REFERENCES listings(id),
  buyer_outlet_id       TEXT NOT NULL REFERENCES users(id),
  amount_cents          INTEGER NOT NULL,
  uploader_share_cents  INTEGER NOT NULL,
  bno_share_cents       INTEGER NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_transactions_listing_id ON transactions(listing_id);
