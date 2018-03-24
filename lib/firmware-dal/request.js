'use strict';

const rp = require('request-promise-native');
const got = require('got');
const { Observable } = require('rxjs/Rx');

const fetchUBNTFirmwares = () => {
  const options = {
    uri: 'https://fw-update.ubnt.com/api/firmware',
    qs: {
      filter: 'eq~~channel~~release',
      limit: 10000,
    },
    headers: {
      'User-Agent': 'Request-Promise',
    },
    json: true,
  };

  return Observable.from(rp(options))
    .pluck('_embedded', 'firmware');
};

const downloadFirmware = url => got.stream(url);

module.exports = {
  fetchUBNTFirmwares,
  downloadFirmware,
};
