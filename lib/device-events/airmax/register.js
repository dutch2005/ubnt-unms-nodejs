'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Either } = require('monet');
const { weave } = require('ramda-adjunct');

const { fromDb: fromDbDevice } = require('../../transformers/device');
const { mergeDbWithHw } = require('../../transformers/device/airmax/mergers');
const { merge: mergeM } = require('../../transformers');
const { toDbAirMax } = require('./utils');

const create = cmAirMax => reader(
  ({ messageHub, DB }) => {
    const { messages } = messageHub;
    return Observable.fromEither(toDbAirMax(cmAirMax))
      .mergeMap(dbAirMax => DB.airMax.insert(dbAirMax))
      .do(() => messageHub.publish(messages.deviceSaved(cmAirMax, true)))
      .mapTo(cmAirMax);
  }
);

const update = cmAirMax => reader(
  ({ DB, messageHub }) => {
    const { messages } = messageHub;
    return Observable.fromEither(toDbAirMax(cmAirMax))
      .mergeMap(dbAirMax => DB.airMax.update(dbAirMax))
      .do(() => messageHub.publish(messages.deviceSaved(cmAirMax, false)))
      .mapTo(cmAirMax);
  }
);

const createOrUpdate = cmAirMax => reader(
  ({ DB, messageHub }) => {
    const deviceId = cmAirMax.identification.id;

    return Observable.from(DB.airMax.findById(deviceId))
      .mergeMap((dbAirMax) => {
        const isNew = dbAirMax === null;
        if (isNew) {
          return create(cmAirMax).run({ DB, messageHub });
        }

        return Observable.fromEither(fromDbDevice({}, dbAirMax))
          .mergeEither(mergeM(mergeDbWithHw, Either.of(cmAirMax)))
          .mergeMap(weave(update, { DB, messageHub }));
      });
  }
);

const registerHandler = ({ deviceId, payload: device }) => reader(
  ({ DB, messageHub }) => {
    const { messages } = messageHub;

    return createOrUpdate(device).run({ DB, messageHub })
      .do(cmAirMax => messageHub.publish(messages.deviceConnected(cmAirMax)))
      .do(() => messageHub.publish(messages.airMaxConfigChangeEvent(deviceId)));
  }
);

module.exports = registerHandler;
