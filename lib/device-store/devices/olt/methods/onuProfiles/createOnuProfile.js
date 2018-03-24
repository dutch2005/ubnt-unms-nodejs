'use strict';

const Boom = require('boom');
const { Observable } = require('rxjs/Rx');
const { constant, max, add } = require('lodash/fp');
const { pipe, pathEq, filter, pathSatisfies, split, defaultTo, map, path, test, concat, assocPath } = require('ramda');
const { isNotEmpty } = require('ramda-adjunct');

const { OnuModeEnum } = require('../../../../../enums');
const { setOnuConfigRequest } = require('../../messages');

const nextProfileId = pipe(
  filter(pathSatisfies(test(/^profile-[0-9]+$/i), ['id'])),
  map(pipe(path(['id']), split('-'), path([1]), Number)),
  max,
  defaultTo(0),
  add(1),
  String,
  concat('profile-')
);

/**
 * Create ONU profile.
 *
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceOnuProfile} cmProfile
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function createOnuProfile(cmProfile) {
  return this.getOnuProfiles()
    .mergeMap((cmOnuProfiles) => {
      const isNameConflict = cmOnuProfiles.some(pathEq(['name'], cmProfile.name));

      if (isNameConflict) {
        return Observable.throw(Boom.conflict('Profile with given name already exists.'));
      }

      const profileId = nextProfileId(cmOnuProfiles);

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

module.exports = constant(createOnuProfile);

