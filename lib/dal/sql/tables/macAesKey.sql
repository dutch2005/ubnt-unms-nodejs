DROP TABLE IF EXISTS mac_aes_key;

DROP TYPE IF EXISTS macAesKeyExchangeStatusEnum;

CREATE TYPE macAesKeyExchangeStatusEnum AS ENUM (
    'pending',
    'used',
    'complete'
);

CREATE TABLE mac_aes_key (
  id UUID PRIMARY KEY NOT NULL,
  mac MACADDR NOT NULL,
  key CHAR(44) NOT NULL,
  exchange_status macAesKeyExchangeStatusEnum NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ip VARCHAR,
  model VARCHAR,
);

CREATE INDEX ON mac_aes_key(mac);
