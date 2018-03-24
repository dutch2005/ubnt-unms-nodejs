'use strict';

const { renameKeys } = require('ramda-adjunct');

const { DB } = require('../../db');


module.exports = {
  up() {
    return DB.nms.get()
      .then(renameKeys({ googleMapApiKey: 'googleMapsApiKey' }))
      .then(DB.nms.update);
  },
  down() {
    return DB.nms.get()
      .then(renameKeys({ googleMapsApiKey: 'googleMapApiKey' }))
      .then(DB.nms.update);
  },
};
