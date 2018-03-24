'use strict';

const { assign } = require('lodash/fp');
const rp = require('request-promise-native');

const { toMs } = require('../../util');

const REQUEST_TIMEOUT = toMs('seconds', 5);

const createInstance = (config = {}) => rp.defaults(assign(config, {
  followAllRedirects: true,
  strictSSL: false,
  jar: true,
  timeout: REQUEST_TIMEOUT,
  headers: { 'User-Agent': 'UNMS' },
}));

const createConnection = ({ host, port = 443, username, password }) => {
  const connection = createInstance({
    baseUrl: `https://${host}:${port}`,
  });

  connection.credentials = { username, password };

  return connection;
};

module.exports = { createInstance, createConnection };
