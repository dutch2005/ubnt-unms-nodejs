'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Either } = require('monet');
const { weave } = require('ramda-adjunct');

const { toDb: toDbDevice, fromDb: fromDbDevice } = require('../../transformers/device');
const { mergeDbWithHw } = require('../../transformers/device/erouter/mergers');
const { merge: mergeM } = require('../../transformers');

const create = cmErouter => reader(
  ({ messageHub, DB }) => {
    const { messages } = messageHub;
    return Observable.fromEither(toDbDevice(cmErouter))
      .mergeMap(dbErouter => DB.erouter.insert(dbErouter))
      .do(() => messageHub.publish(messages.deviceSaved(cmErouter, true)))
      .mapTo(cmErouter);
  }
);

const update = cmErouter => reader(
  ({ DB, messageHub }) => {
    const { messages } = messageHub;
    return Observable.fromEither(toDbDevice(cmErouter))
      .mergeMap(dbErouter => DB.erouter.update(dbErouter))
      .do(() => messageHub.publish(messages.deviceSaved(cmErouter, false)))
      .mapTo(cmErouter);
  }
);

const createOrUpdate = cmErouter => reader(
  ({ DB, messageHub }) => {
    const deviceId = cmErouter.identification.id;

    return Observable.from(DB.erouter.findById(deviceId))
      .mergeMap((dbErouter) => {
        const isNew = dbErouter === null;
        if (isNew) {
          return create(cmErouter).run({ DB, messageHub });
        }

        return Observable.fromEither(fromDbDevice({}, dbErouter))
          .mergeEither(mergeM(mergeDbWithHw, Either.of(cmErouter)))
          .mergeMap(weave(update, { DB, messageHub }));
      });
  }
);

const registerHandler = ({ deviceId, payload: device }) => reader(
  ({ DB, messageHub }) => {
    const { messages } = messageHub;

    return createOrUpdate(device).run({ DB, messageHub })
      .do(cmErouter => messageHub.publish(messages.deviceConnected(cmErouter)))
      .do(() => messageHub.publish(messages.erouterConfigChangeEvent(deviceId)));
  }
);

module.exports = registerHandler;
