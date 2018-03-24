'use strict';

// TODO(michal.sedlak@ubnt.com): DEPRECATED, DO NOT USE
// NOTE: this is here for compatibility reason, should be removed when we rewrite tasks

const { Observable } = require('rxjs/Rx');
const { __, merge, getOr } = require('lodash/fp');
const { Reader: reader } = require('monet');

const { fromDb: fromDbDevice, toDb: toDbDevice } = require('../transformers/device');
const { entityExistsCheck } = require('../util');
const { EntityEnum } = require('../enums');

const updateUpgradeStatus = (deviceId, upgradeStatus) => reader(
  ({ DB }) => Observable.from(DB.device.findById(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeEither(fromDbDevice({}))
    .map(merge(__, {
      upgrade: {
        status: getOr(null, 'status', upgradeStatus),
        error: getOr(null, 'error', upgradeStatus),
        expectedDuration: getOr(null, 'expectedDuration', upgradeStatus),
        firmware: getOr(null, 'firmware', upgradeStatus),
        changedAt: Date.now(),
      },
    }))
    .mergeEither(toDbDevice)
    .mergeMap(dbDevice => DB.device.update(dbDevice))
);

module.exports = {
  updateUpgradeStatus,
};
