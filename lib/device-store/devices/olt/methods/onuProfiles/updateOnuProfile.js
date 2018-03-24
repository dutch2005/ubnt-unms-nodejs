'use strict';

const Boom = require('boom');
const { Observable } = require('rxjs/Rx');
const { constant } = require('lodash/fp');
const { both, pathEq, complement, assocPath } = require('ramda');
const { isNotEmpty } = require('ramda-adjunct');

const { OnuModeEnum } = require('../../../../../enums');
const { setOnuConfigRequest } = require('../../messages');

/**
 * Update ONU profile.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceOnuProfile} cmProfile
 * @param {string} profileId
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function updateOnuProfile(cmProfile, profileId) {
  return this.getOnuProfiles()
    .mergeMap((cmOnuProfiles) => {
      const isProfileExists = cmOnuProfiles.some(pathEq(['id'], profileId));

      if (!isProfileExists) {
        return Observable.throw(Boom.notFound('Profile does not exists.'));
      }

      const isNameConflict = cmOnuProfiles.some(both(
        pathEq(['name'], cmProfile.name),
        complement(pathEq(['id'], profileId))
      ));

      if (isNameConflict) {
        return Observable.throw(Boom.conflict('Profile with given name already exists.'));
      }

      const basePath = ['onu-profiles', profileId];

      // delete ONU profile prior to updating - does nothing for insert
      const deleteData = assocPath(basePath, "''", {});

      // set data relevant for all cases
      let setData = assocPath(basePath, {
        'admin-password': cmProfile.adminPassword,
        mode: cmProfile.mode,
        name: cmProfile.name,
      }, {});

      // set bridge data if applicable (should always be done at present time)
      if (cmProfile.mode === OnuModeEnum.Bridge) {
        setData = assocPath([...basePath, 'bridge-mode', 'port', '1'], {
          'native-vlan': cmProfile.bridge.nativeVlan || '',
          'include-vlan': isNotEmpty(cmProfile.bridge.includeVlans) ? cmProfile.bridge.includeVlans : '',
        }, setData);
      }

      // TODO(michael.kuk@ubnt.com) Add router config setters - not implemented at the time of writing

      return this.connection.rpc(setOnuConfigRequest(setData, deleteData));
    });
}

module.exports = constant(updateOnuProfile);

