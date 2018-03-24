'use strict';

const { NmsUpdateStatusEnum } = require('./enums');

const model = {
  server: {
    https: null,
  },
  nmsUpdate: {
    status: NmsUpdateStatusEnum.Ready,
    lastActiveTimestamp: null,
  },
};

module.exports = model;
