'use strict';

const { curry, assocPath, pathEq, map } = require('ramda');

const mergeOnuCount = curry((onus, profiles) => map(
  (profile) => {
    const onusInProfile = onus.filter(pathEq(['onu', 'profile'], profile.id));

    return assocPath(['onuCount'], onusInProfile.length, profile);
  }
)(profiles));

module.exports = {
  mergeOnuCount,
};
