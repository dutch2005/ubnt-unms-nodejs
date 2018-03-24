'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Either } = require('monet');
const { weave } = require('ramda-adjunct');

const { fromDb: fromDbDevice, toDb: toDbDevice } = require('../../transformers/device');
const { mergeDbWithHw } = require('../../transformers/device/aircube/mergers');
const { merge: mergeM } = require('../../transformers');

const create = cmAirCube => reader(
  ({ messageHub, DB }) => {
    const { messages } = messageHub;
    return Observable.fromEither(toDbDevice(cmAirCube))
      .mergeMap(dbAirCube => DB.airCube.insert(dbAirCube))
      .do(() => messageHub.publish(messages.deviceSaved(cmAirCube, true)))
      .mapTo(cmAirCube);
  }
);

const update = cmAirCube => reader(
  ({ DB, messageHub }) => {
    const { messages } = messageHub;
    return Observable.fromEither(toDbDevice(cmAirCube))
      .mergeMap(dbAirCube => DB.airCube.update(dbAirCube))
      .do(() => messageHub.publish(messages.deviceSaved(cmAirCube, false)))
      .mapTo(cmAirCube);
  }
);

const createOrUpdate = cmAirCube => reader(
  ({ DB, messageHub }) => {
    const deviceId = cmAirCube.identification.id;

    return Observable.from(DB.airCube.findById(deviceId))
      .mergeMap((dbAirCube) => {
        const isNew = dbAirCube === null;
        if (isNew) {
          return create(cmAirCube).run({ DB, messageHub });
        }

        return Observable.fromEither(fromDbDevice({}, dbAirCube))
          .mergeEither(mergeM(mergeDbWithHw, Either.of(cmAirCube)))
          .mergeMap(weave(update, { DB, messageHub }));
      });
  }
);

const registerHandler = ({ deviceId, payload: device }) => reader(
  ({ DB, messageHub }) => {
    const { messages } = messageHub;

    return createOrUpdate(device).run({ DB, messageHub })
      .do(cmAirCube => messageHub.publish(messages.deviceConnected(cmAirCube)))
      .do(() => messageHub.publish(messages.airCubeConfigChangeEvent(deviceId)));
  }
);

module.exports = registerHandler;
