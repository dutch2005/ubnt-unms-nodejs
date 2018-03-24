'use strict';

const { pickBy, merge, pipe } = require('ramda');
const { isNotNull } = require('ramda-adjunct');

const mergeUserUpdate = (cmOldUser, cmNewUser) => pipe(
  pickBy(isNotNull),
  merge(cmOldUser)
)(cmNewUser);

module.exports = {
  mergeUserUpdate,
};
