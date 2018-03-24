CREATE TYPE "userrole" as ENUM (
  'anonymous',
  'guest',
  'admin'
);

CREATE TABLE "user" (
  id UUID PRIMARY KEY NOT NULL,
  username VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR NOT NULL UNIQUE,
  password VARCHAR(60) NOT NULL,
  totp_auth_enabled BOOLEAN NOT NULL DEFAULT 0,
  totp_auth_secret VARCHAR,
  role userrole NOT NULL
);

CREATE TABLE "user_profile" (
  user_id UUID PRIMARY KEY NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  alerts BOOLEAN NOT NULL DEFAULT 0,
  presentation_mode BOOLEAN NOT NULL DEFAULT 0,
  force_password_change BOOLEAN NOT NULL DEFAULT 0,
  last_log_item_id UUID,
  table_config JSONB,
  last_news_seen_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
);
