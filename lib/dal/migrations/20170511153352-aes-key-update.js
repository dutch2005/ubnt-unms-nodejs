'use strict';

const { merge, slice, dissoc, defaultTo } = require('ramda');

const { DB } = require('../../db');

module.exports = {
  up() {
    return DB.nms.get()
      .then(nms => merge(nms, { aesKey: nms.aesKey + defaultTo('', nms.aesIv) }))
      .then(dissoc('aesIv'))
      .then(DB.nms.update)
    ;
  },
  down() {
    return DB.nms.get()
      .then(nms => merge(nms, { aesKey: slice(0, 32, nms.aesKey), aesIv: slice(32, 48, nms.aesKey) }))
      .then(DB.nms.update)
    ;
  },
};
