'use strict';

const { get, isUndefined } = require('lodash/fp');
const { assoc, dissoc } = require('ramda');

const { DB } = require('../../db');
const { allP, toMs } = require('../../util');


module.exports = {
  up() {
    const outagesSettings = {
      defaultGracePeriod: toMs('second', 30),
      upgradeGracePeriod: toMs('minute', 5),
      restartGracePeriod: toMs('minute', 5),
    };
    const nmsPromise = DB.nms.get();
    const outagesPromise = nmsPromise
      .then(get('outages'));

    return allP([nmsPromise, outagesPromise])
      .then(([nms, outages]) => (isUndefined(outages)
          ? assoc('outages', outagesSettings, nms)
          : nms
      ))
      .then(DB.nms.update);
  },
  down() {
    return DB.nms.get()
      .then(dissoc('outages'))
      .then(DB.nms.update);
  },
};
