'use strict';

const { get, isUndefined } = require('lodash/fp');
const { assoc, dissoc } = require('ramda');

const { DB } = require('../../db');
const { allP } = require('../../util');
const { TimeFormatEnum, DateFormatEnum } = require('../../enums');


module.exports = {
  up() {
    const localeSettings = {
      longDateFormat: {
        LL: DateFormatEnum[0],
        LT: TimeFormatEnum[0],
      },
    };
    const nmsPromise = DB.nms.get();
    const localePromise = nmsPromise
      .then(get('locale'));

    return allP([nmsPromise, localePromise])
      .then(([nms, locale]) => (isUndefined(locale)
          ? assoc('local', localeSettings, nms)
          : nms
      ))
      .then(DB.nms.update);
  },
  down() {
    return DB.nms.get()
      .then(dissoc('locale'))
      .then(DB.nms.update);
  },
};
