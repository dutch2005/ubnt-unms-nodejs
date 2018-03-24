DROP TABLE IF EXISTS device_metadata;

CREATE TABLE device_metadata (
  id UUID PRIMARY KEY NOT NULL,
  failed_message_decryption BOOLEAN NOT NULL DEFAULT FALSE,
  restart_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  alias VARCHAR(30),
  note TEXT,
);

CREATE INDEX ON device_metadata(id);
