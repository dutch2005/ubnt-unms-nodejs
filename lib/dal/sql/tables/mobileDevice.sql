DROP TABLE IF EXISTS mobile_device;

DROP TYPE IF EXISTS mobileDevicePlatformEnum;

CREATE TYPE mobileDevicePlatformEnum AS ENUM ('outage', 'quality');

CREATE TABLE IF NOT EXISTS public.mobile_device(
  id uuid PRIMARY KEY NOT NULL,
  user_id uuid NOT NULL,
  name char(64) NOT NULL,
  platform mobileDevicePlatformEnum NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  token TEXT NOT NULL,
  deviceKey uuid NOT NULL
  CONSTRAINT c_unique_mobile_device UNIQUE (user_id, token)
);