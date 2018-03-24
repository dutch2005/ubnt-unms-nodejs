'use strict';

const { pipe, toUpper, slice, pathOr, __, unapply, identity, replace } = require('ramda');

const vendorList = require('./vendor-list.json');

const parseDeviceVendor = pipe(
  replace(/:/g, ''),
  toUpper,
  slice(0, 6),
  unapply(identity),
  pathOr(null, __, vendorList)
);

module.exports = {
  parseDeviceVendor,
};
