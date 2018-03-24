DROP TABLE IF EXISTS link;

DROP TYPE IF EXISTS DataLinkOriginEnum;

CREATE TYPE DataLinkOriginEnum AS ENUM (
    'unms',
    'manual'
);

CREATE TABLE data_link (
  id UUID PRIMARY KEY NOT NULL,
  device_id_from UUID NOT NULL,
  interface_name_from VARCHAR(50) NOT NULL,
  device_id_to UUID NOT NULL,
  interface_name_to VARCHAR(50) NOT NULL,
  origin DataLinkOriginEnum NOT NULL
);

CREATE INDEX ON data_link(id);

CREATE UNIQUE INDEX unq_i_data_link ON data_link(
  greatest(device_id_from || interface_name_from, device_id_to || interface_name_to),
  least(device_id_from || interface_name_from, device_id_to ||interface_name_to)
);
