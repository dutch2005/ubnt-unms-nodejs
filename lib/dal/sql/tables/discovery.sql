DROP TABLE IF EXISTS discovery_device;
DROP TABLE IF EXISTS discovery_result;

DROP OPERATOR CLASS IF EXISTS _uuid_ops USING gin CASCADE;

DROP TYPE IF EXISTS discoveryConnectStatusEnum;
DROP TYPE IF EXISTS discoveryConnectProgressEnum;
DROP TYPE IF EXISTS discoveryAuthenticationStatusEnum;
DROP TYPE IF EXISTS discoveryMethodEnum;
DROP TYPE IF EXISTS discoveryResultStatusEnum;

CREATE OPERATOR CLASS _uuid_ops DEFAULT FOR TYPE _uuid USING gin AS
    OPERATOR 1 &&(anyarray, anyarray),
    OPERATOR 2 @>(anyarray, anyarray),
    OPERATOR 3 <@(anyarray, anyarray),
    OPERATOR 4 =(anyarray, anyarray),
    FUNCTION 1 uuid_cmp(uuid, uuid),
    FUNCTION 2 ginarrayextract(anyarray, internal, internal),
    FUNCTION 3 ginqueryarrayextract(anyarray, internal, smallint, internal, internal, internal, internal),
    FUNCTION 4 ginarrayconsistent(internal, smallint, anyarray, integer, internal, internal, internal, internal),
    STORAGE uuid;

CREATE TYPE discoveryConnectStatusEnum AS ENUM (
    'connected',
    'pending',
    'unconnected'
);

CREATE TYPE discoveryConnectProgressEnum AS ENUM (
    'failed',
    'firmware-upgrade',
    'setting-connection-string',
    'waiting'
);

CREATE TYPE discoveryAuthenticationStatusEnum AS ENUM (
    'success',
    'failed',
    'in-progress',
    'canceled'
);

CREATE TYPE discoveryMethodEnum AS ENUM (
    'import',
    'ip-range'
);

CREATE TYPE discoveryResultStatusEnum AS ENUM (
    'success',
    'failed',
    'in-progress',
    'canceled'
);

CREATE TABLE discovery_result (
  id UUID PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL UNIQUE,
  method discoveryMethodEnum NOT NULL,
  ip_range_input TEXT,
  ip_range_parsed JSONB,
  ip_list VARCHAR[],
  status discoveryResultStatusEnum NOT NULL,
  error TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE discovery_device (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  result_id UUID,
  possible_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  connect_status discoveryConnectStatusEnum NOT NULL,
  connect_progress discoveryConnectProgressEnum,
  connect_error TEXT,
  firmware_version VARCHAR NOT NULL,
  model VARCHAR NOT NULL,
  "name" VARCHAR,
  mac VARCHAR NOT NULL,
  ip VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  auth_status discoveryAuthenticationStatusEnum,
  auth_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ( id, user_id ),
  FOREIGN KEY ( result_id ) REFERENCES discovery_result ON DELETE SET NULL
);

CREATE INDEX ON discovery_device(site_id);
CREATE INDEX ON discovery_device(user_id);
CREATE INDEX ON discovery_device USING gin (possible_ids);
CREATE INDEX ON discovery_result(user_id);
