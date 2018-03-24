DROP TABLE IF EXISTS outage;

DROP TYPE IF EXISTS outageTypeEnum;

CREATE TYPE outageTypeEnum AS ENUM ('outage', 'quality');

CREATE TABLE outage
(
  id uuid PRIMARY KEY NOT NULL,
  start_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_timestamp TIMESTAMP WITH TIME ZONE,
  device JSONB NOT NULL DEFAULT '{}',
  site JSONB NOT NULL DEFAULT '{}',
  type outageTypeEnum NOT NULL DEFAULT 'outage'
);

CREATE INDEX ON outage((device->'id'));

CREATE INDEX ON outage((site->'id'));
