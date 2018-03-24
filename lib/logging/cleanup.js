'use strict';

const config = require('../../config');
const { cleanFiles } = require('../util');

function cleanLogsDir() {
  const { dir, downloadDir, ttl, downloadTtl } = config.logs;
  return Promise.resolve()
    .then(() => cleanFiles(ttl, dir))
    .then(() => cleanFiles(downloadTtl, downloadDir));
}

module.exports = {
  cleanLogsDir,
};
