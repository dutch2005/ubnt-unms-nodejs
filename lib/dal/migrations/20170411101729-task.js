'use strict';

const upQueries = [
  `
  DROP TABLE IF EXISTS task;
  `,
  `
  DROP TYPE IF EXISTS taskStatus;
  `,
  `
  DROP TYPE IF EXISTS taskType;
  `,
  `
  CREATE TYPE taskType AS ENUM (
      'firmware-upgrade'
  );
  `,
  `
  CREATE TYPE taskStatus AS ENUM (
    'success',
    'failed',
    'in-progress',
    'canceled',
    'queued'
  );
  `,
  `
  CREATE TABLE task (
    id UUID PRIMARY KEY NOT NULL,
    batch_id UUID NOT NULL,
    "type" taskType NOT NULL,
    payload JSONB,
    progress REAL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status taskStatus NOT NULL,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  `,
  `
  CREATE INDEX ON task(batch_id);
  `,
  `
  CREATE INDEX ON task("type");
  `,
  `
  CREATE INDEX ON task(progress, start_time, end_time);
  `,
  `
  CREATE INDEX ON task(end_time);
  `,
  `
  CREATE INDEX ON task(status);
  `,
  `
  CREATE INDEX ON task(created_at);
  `,
];

const downQueries = [
  `
  DROP TABLE IF EXISTS task;
  `,
  `
  DROP TYPE IF EXISTS taskStatus;
  `,
  `
  DROP TYPE IF EXISTS taskType;
  `,
];

module.exports = {
  up(queryInterface) {
    return upQueries.reduce((acc, query) => acc.then(() => queryInterface.sequelize.query(query)), Promise.resolve());
  },
  down(queryInterface) {
    return downQueries.reduce((acc, query) => acc.then(() => queryInterface.sequelize.query(query)), Promise.resolve());
  },
};
