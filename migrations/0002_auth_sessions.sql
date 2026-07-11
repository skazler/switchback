-- Owner auth sessions (FLOWS §4). A passkey assertion mints an opaque token;
-- its SHA-256 hash is stored here and the raw token rides in an httpOnly
-- cookie. hooks.server.ts validates each request against this table.

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash  TEXT PRIMARY KEY,      -- sha-256(cookie token), base64url
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL          -- ISO; 90-day rolling
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
