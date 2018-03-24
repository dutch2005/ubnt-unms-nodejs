'use strict';

const { fromCorrespondence } = require('../../index');

const { safeToApiStationsList } = require('./mappers');

const toApiStationsList = fromCorrespondence(safeToApiStationsList);

module.exports = {
  toApiStationsList,
};
