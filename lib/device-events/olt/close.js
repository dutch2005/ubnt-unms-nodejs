'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');
const { isNotNull } = require('ramda-adjunct');

require('../../util/observable');
const { deviceDisconnected: deviceDisconnectedAp } = require('../../transformers/device/ap');
const { fromDb, toDb } = require('../../transformers/device');
const { fromDb: fromDbDeviceMetadata } = require('../../transformers/device/metadata');
const { merge: mergeM } = require('../../transformers');
const { mergeMetadata } = require('../../transformers/device/mergers');
const { rejectP, resolveP } = require('../../util');


const closeHandler = ({ deviceId }) => reader(
  ({ DB, messageHub, dal }) => {
    const { messages } = messageHub;

    const onus$ = Observable.from(DB.onu.findAllIdsByOltId(deviceId))
      .mergeAll() // flatten the array
      .mergeMap(onuId => DB.onu.findById(onuId));

    return Observable.from(DB.olt.findById(deviceId))
      .merge(onus$)
      .filter(isNotNull)
      .mergeEither(fromDb({}))
      .mergeMap(cmDevice => Observable.from(
        dal.deviceMetadataRepository
          .findById(cmDevice.identification.id)
          .then(dbDeviceMetadata => mergeM(mergeMetadata, fromDbDeviceMetadata({}, dbDeviceMetadata), cmDevice)
            .cata(rejectP, resolveP))
      ))
      .map(deviceDisconnectedAp(Date.now()))
      .tapO(cmDevice => Observable.fromEither(toDb(cmDevice))
        .mergeMap(dbDevice => DB.device.update(dbDevice)))
      .do(cmDevice => messageHub.publish(messages.deviceDisconnected(cmDevice)));
  }
);

module.exports = closeHandler;
