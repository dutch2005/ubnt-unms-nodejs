'use strict';

const boom = require('boom');
const { flow, curry } = require('lodash');
const { assoc, when, propEq } = require('ramda');

const config = require('../../../../config');

const isHostnameConfiguredCheck = (nms) => {
  if (nms && nms.hostname) {
    throw boom.forbidden('SSL domain has already been configured');
  }
  return nms;
};

const updateNmsWithHostname = curry((hostname, nms) => flow(
  when(propEq('devicePingAddress', nms.hostname), assoc('devicePingAddress', hostname)),
  assoc('hostname', hostname)
)(nms));

const extendTokenExpiry = (token) => {
  const exp = Date.now() + (token.extendedSessionTimeout ? config.extendedSessionTimeout : config.sessionTimeout);
  return assoc('exp', exp, token);
};


module.exports = {
  isHostnameConfiguredCheck,
  updateNmsWithHostname,
  extendTokenExpiry,
};
