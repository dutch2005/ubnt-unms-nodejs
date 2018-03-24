'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Either } = require('monet');
const { weave } = require('ramda-adjunct');

const { toDb: toDbDevice, fromDb: fromDbDevice } = require('../../transformers/device');
// TODO(michal.sedlak@ubnt.com): refactor, stop using erouter merger
const { mergeDbWithHw } = require('../../transformers/device/erouter/mergers');
const { merge: mergeM } = require('../../transformers');

const create = cmOlt => reader(
  ({ messageHub, DB }) => {
    const { messages } = messageHub;
    return Observable.fromEither(toDbDevice(cmOlt))
      .mergeMap(dbOlt => DB.olt.insert(dbOlt))
      .do(() => messageHub.publish(messages.deviceSaved(cmOlt, true)))
      .mapTo(cmOlt);
  }
);

const update = cmOlt => reader(
  ({ DB, messageHub }) => {
    const { messages } = messageHub;
    return Observable.fromEither(toDbDevice(cmOlt))
      .mergeMap(dbOlt => DB.olt.update(dbOlt))
      .do(() => messageHub.publish(messages.deviceSaved(cmOlt, false)))
      .mapTo(cmOlt);
  }
);

const createOrUpdate = cmOlt => reader(
  ({ DB, messageHub }) => {
    const deviceId = cmOlt.identification.id;

    return Observable.from(DB.olt.findById(deviceId))
      .mergeMap((dbOlt) => {
        const isNew = dbOlt === null;
        if (isNew) {
          return create(cmOlt).run({ DB, messageHub });
        }

        return Observable.fromEither(fromDbDevice({}, dbOlt))
          .mergeEither(mergeM(mergeDbWithHw, Either.of(cmOlt)))
          .mergeMap(weave(update, { DB, messageHub }));
      });
  }
);

const registerHandler = ({ deviceId, payload: device }) => reader(
  ({ DB, messageHub }) => {
    const { messages } = messageHub;

    return createOrUpdate(device).run({ DB, messageHub })
      .do(cmOlt => messageHub.publish(messages.deviceConnected(cmOlt)))
      .do(() => messageHub.publish(messages.oltConfigChangeEvent(deviceId)));
  }
);

module.exports = registerHandler;
