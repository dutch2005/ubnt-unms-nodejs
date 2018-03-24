'use strict';

const { assoc, dissoc } = require('ramda');

const { DB } = require('../../db');

module.exports = {
  up() {
    return DB.nms.get()
      .then(dissoc('sslDomain'))
      .then(DB.nms.update);
  },
  down() {
    return DB.nms.get()
      .then(nms => assoc('sslDomain', nms.hostname, nms))
      .then(DB.nms.update);
  },
};
