DROP TABLE IF EXISTS log;

DROP TYPE IF EXISTS logLevelEnum;

CREATE TYPE logLevelEnum AS ENUM ('info', 'warning', 'error');

CREATE TYPE logTypeEnum AS ENUM (
    'other',
    'device-appear',
    'device-disappear',
    'device-reappear',
    'device-outage',
    'device-upgrade-start',
    'device-upgrade-success',
    'device-upgrade-failed',
    'device-upgrade-cancel',
    'device-ram-over-limit',
    'device-cpu-over-limit',
    'device-authorize',
    'device-move',
    'device-backup-create',
    'device-backup-apply',
    'device-restart',
    'device-delete',
    'device-automatic-backup-create',
    'user-login',
    'user-login-fail',
    'event-notification-fail',
    'email-dispatch-fail
);

CREATE TABLE log
(
  id uuid PRIMARY KEY NOT NULL,
  level logLevelEnum NOT NULL DEFAULT 'info',
  type logTypeEnum NOT NULL DEFAULT 'other',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message TEXT NOT NULL,
  "user" JSONB NOT NULL DEFAULT '{}',
  token TEXT,
  remote_address VARCHAR,
  site JSONB NOT NULL DEFAULT '{}',
  device JSONB NOT NULL DEFAULT '{}',
  tags VARCHAR[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
  mail_notification_emails VARCHAR[],
  mail_notification_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX ON log((device->'id'));

CREATE INDEX ON log(type);
