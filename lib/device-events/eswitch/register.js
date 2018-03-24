'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Either } = require('monet');
const { weave } = require('ramda-adjunct');

const { fromDb: fromDbDevice, toDb: toDbDevice } = require('../../transformers/device');
const { mergeDbWithHw } = require('../../transformers/device/eswitch/mergers');
const { merge: mergeM } = require('../../transformers');

const create = cmEswitch => reader(
  ({ messageHub, DB }) => {
    const { messages } = messageHub;
    return Observable.fromEither(toDbDevice(cmEswitch))
      .mergeMap(dbEswitch => DB.eswitch.insert(dbEswitch))
      .do(() => messageHub.publish(messages.deviceSaved(cmEswitch, true)))
      .mapTo(cmEswitch);
  }
);

const update = cmEswitch => reader(
  ({ DB, messageHub }) => {
    const { messages } = messageHub;
    return Observable.fromEither(toDbDevice(cmEswitch))
      .mergeMap(dbEswitch => DB.eswitch.update(dbEswitch))
      .do(() => messageHub.publish(messages.deviceSaved(cmEswitch, false)))
      .mapTo(cmEswitch);
  }
);

const createOrUpdate = cmEswitch => reader(
  ({ DB, messageHub }) => {
    const deviceId = cmEswitch.identification.id;

    return Observable.from(DB.eswitch.findById(deviceId))
      .mergeMap((dbEswitch) => {
        const isNew = dbEswitch === null;
        if (isNew) {
          return create(cmEswitch).run({ DB, messageHub });
        }

        return Observable.fromEither(fromDbDevice({}, dbEswitch))
          .mergeEither(mergeM(mergeDbWithHw, Either.of(cmEswitch)))
          .mergeMap(weave(update, { DB, messageHub }));
      });
  }
);

const registerHandler = ({ deviceId, payload: device }) => reader(
  ({ DB, messageHub }) => {
    const { messages } = messageHub;

    return createOrUpdate(device).run({ DB, messageHub })
      .do(cmEswitch => messageHub.publish(messages.deviceConnected(cmEswitch)))
      .do(() => messageHub.publish(messages.eswitchConfigChangeEvent(deviceId)));
  }
);

module.exports = registerHandler;
