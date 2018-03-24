'use strict';

const Boom = require('boom');
const { Observable } = require('rxjs/Rx');
const { constant } = require('lodash/fp');
const { assocPath, pathEq } = require('ramda');

const { setOnuConfigRequest } = require('../../messages');

/**
 * Delete onu profile if it's not used.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {string} profileId
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function deleteOnuProfile(profileId) {
  return this.getOnuConfigList()
    .mergeMap((cmOnuConfigList) => {
      const profileIsUsed = cmOnuConfigList.some(pathEq(['profile'], profileId));
      if (profileIsUsed) {
        return Observable.throw(Boom.preconditionFailed('Profile is being used'));
      }

      return this.getOnuProfiles();
    })
    .mergeMap((cmOnuProfiles) => {
      const profileExists = cmOnuProfiles.some(pathEq(['id'], profileId));
      if (!profileExists) {
        return Observable.throw(Boom.notFound('Profile not found'));
      }

      const deleteData = assocPath(['onu-profiles', profileId], "''", {});

      return this.connection.rpc(setOnuConfigRequest(null, deleteData));
    });
}

module.exports = constant(deleteOnuProfile);

