'use strict';

const { Observable } = require('rxjs/Rx');
const { has } = require('lodash/fp');
const { Reader: reader, Either } = require('monet');
const { isNotNull } = require('ramda-adjunct');

require('../../util/observable');
const { fromDb: fromDbDevice, toDb: toDbDevice } = require('../../transformers/device');
const { fromDbList: fromDbInterfaces, toDbInterfaceList } = require('../../transformers/interfaces');
const { mergeInterfaces } = require('../../transformers/device/mergers');
const { mergeDeviceUpdate } = require('../../transformers/device/mergers');
const { merge: mergeM } = require('../../transformers');


const parseInterfaces = hasInterfaces => cmDevice => (hasInterfaces
  ? mergeM(mergeInterfaces, fromDbInterfaces({ dbDevice: cmDevice }, cmDevice.interfaces), cmDevice)
  : Either.of(cmDevice));

const mapInterfaces = hasInterfaces => cmDevice => (hasInterfaces
  ? mergeM(mergeInterfaces, toDbInterfaceList(cmDevice.interfaces), cmDevice)
  : Either.of(cmDevice));

const updateHandler = ({ deviceId, payload: cmDeviceUpdate }) => reader(
  ({ DB }) => Observable.from(DB.device.findById(deviceId))
    .filter(isNotNull)
    .mergeEither((dbDevice) => {
      // determine if interfaces are also to be updated
      const hasInterfaces = has('interfaces', cmDeviceUpdate);

      return fromDbDevice({}, dbDevice)
        // conditionally parse interfaces
        .chain(parseInterfaces(hasInterfaces))
        .chain(mergeM(mergeDeviceUpdate, Either.of(cmDeviceUpdate)))
        .chain(mapInterfaces(hasInterfaces))
        .chain(toDbDevice);
    })
    .mergeMap(dbDevice => DB.device.update(dbDevice))
);

module.exports = updateHandler;
