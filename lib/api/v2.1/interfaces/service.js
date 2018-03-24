'use strict';

const { Observable } = require('rxjs/Rx');
const Boom = require('boom');
const { partial, pathEq, pathSatisfies } = require('ramda');
const { weave } = require('ramda-adjunct');
const { Reader: reader, Maybe, Either } = require('monet');
const { getOr, curry, filter, flow, find, defaultTo, invokeArgs } = require('lodash/fp');

const { isInterfaceVisible } = require('../../../feature-detection/interfaces');
const { fromDb: fromDbDevice } = require('../../../transformers/device');
const { update: updateDiffStrategy } = require('../../../transformers/interfaces/diffs');
const { mergeHwAndDbLists, mergeInterfaceOspfConfig } = require('../../../transformers/interfaces/mergers');
const { merge, diff, diffRight } = require('../../../transformers');
const {
  fromDbList, toApiOverviewList, toApiConfig, fromApiConfig, fromApiOspfConfig,
} = require('../../../transformers/interfaces');
const { EntityEnum } = require('../../../enums');
const { entityExistsCheck, toMs } = require('../../../util');

/*
 * Interface list.
 */

const findInterface = curry((interfaceName, correspondenceList) => flow(
  find(pathEq(['identification', 'name'], interfaceName)),
  defaultTo(null),
  Maybe.fromNull,
  invokeArgs('toEither', [Boom.notFound(`Interface ${interfaceName} not found`)])
)(correspondenceList));

const getInterfaceList = deviceId => reader(
  ({ deviceStore, DB }) => getInterfaceList
    .loadData(deviceId)
    .run({ deviceStore, DB })
    .mergeEither(toApiOverviewList)
    .toPromise()
);

getInterfaceList.loadData = deviceId => reader(
  ({ deviceStore, DB }) => Observable.from(DB.device.findById(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeEither(fromDbDevice({ deviceStore }))
    .mergeMap((cmDevice) => {
      const commDevice = deviceStore.get(deviceId);
      const model = cmDevice.identification.model;
      const dbInterfaceList = getOr([], 'interfaces', cmDevice);
      const dbCorrespondence = fromDbList({}, dbInterfaceList);

      const interfaceList = commDevice !== null && commDevice.supports('getInterfaces')
        ? commDevice.getInterfaces().mergeEither(merge(mergeHwAndDbLists, dbCorrespondence))
        : Observable.fromEither(fromDbList({}, dbInterfaceList));

      return interfaceList.map(filter(pathSatisfies(isInterfaceVisible(model), ['identification', 'name'])));
    })
);

/*
 * Interface config.
 */

const getInterfaceConfig = (deviceId, interfaceName) => reader(
  ({ deviceStore, DB }) => getInterfaceList
    .loadData(deviceId)
    .run({ deviceStore, DB })
    .mergeEither(findInterface(interfaceName))
    .mergeEither(toApiConfig)
    .toPromise()
);

/**
 * Update interface config.
 */

const updateInterfaceConfig = (deviceId, interfaceName, apiInterfaceConfig) => reader(
  ({ deviceStore, DB }) => getInterfaceList
    .loadData(deviceId)
    .run({ deviceStore, DB })
    .mergeEither(findInterface(interfaceName))
    .mergeEither(diff(updateDiffStrategy, fromApiConfig({}, apiInterfaceConfig)))
    .mergeMap(updateInstructions => Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.updateInterface(interfaceName, updateInstructions))
      .mergeMap(() => getInterfaceConfig(deviceId, interfaceName).run(({ deviceStore, DB })))
    )
    .toPromise()
);

/*
 * Create VLAN interface.
 */

const createVlan = (deviceId, payload) => reader(
  ({ deviceStore, DB }) => {
    const interfaceName = `${payload.interface}.${payload.vlanId}`;
    const getInterface = partial(weave(getInterfaceConfig, { deviceStore, DB }), [deviceId, interfaceName]);

    return Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.createVlanInterface(payload))
      .mergeMap(() => Observable.defer(getInterface)
        .retryWhen(notifications => notifications.take(3).delay(toMs('second', 3)))
      )
      .toPromise();
  }
);

/*
 * Create PPPoE interface.
 */

const createPPPoE = (deviceId, payload) => reader(
  ({ deviceStore, DB }) => {
    const interfaceName = `${payload.interface}.pppoe${payload.pppoeId}`;
    const getInterface = partial(weave(getInterfaceConfig, { deviceStore, DB }), [deviceId, interfaceName]);

    return Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.createPPPoEInterface(payload))
      .mergeMap(() => Observable.defer(getInterface)
        .retryWhen(notifications => notifications.take(3).delay(toMs('second', 3)))
      )
      .toPromise();
  }
);

/*
 * Remove interface.
 */

const removeInterface = (deviceId, interfaceName) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.deleteInterface(interfaceName))
    .mapTo({ result: true, message: 'Interface removed.' })
    .toPromise()
);

/*
 * Block interface.
 */

const blockInterface = (deviceId, interfaceName, userId) => reader(
  ({ deviceStore, eventLog }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.blockInterface(interfaceName))
    .mergeMap(() => eventLog.logInterfaceBlocked({ deviceId, userId }, interfaceName))
    .mapTo({ result: true, message: 'Interface blocked' })
    .toPromise()
);

/*
 * Unblock interface.
 */

const unblockInterface = (deviceId, interfaceName, userId) => reader(
  ({ deviceStore, eventLog }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.unblockInterface(interfaceName))
    .mergeMap(() => eventLog.logInterfaceUnblocked({ deviceId, userId }, interfaceName))
    .mapTo({ result: true, message: 'Interface unblocked' })
    .toPromise()
);

/*
 * Update OSPF Config
 */

const setOspfConfig = (deviceId, interfaceName, apiOspfConfig) => reader(
  ({ deviceStore, DB }) => getInterfaceList
    .loadData(deviceId)
    .run({ deviceStore, DB })
    .mergeEither(findInterface(interfaceName))
    .mergeEither(cmInterfaceConfig =>
      merge(mergeInterfaceOspfConfig, fromApiOspfConfig(apiOspfConfig), cmInterfaceConfig)
        .chain(diffRight(updateDiffStrategy, Either.Right(cmInterfaceConfig)))
    )
    .mergeMap(updateInstructions => Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.updateInterface(interfaceName, updateInstructions))
    )
    .mapTo(apiOspfConfig)
    .toPromise()
);

/*
 * Delete OSPF Config
 */

const unsetOspfConfig = (deviceId, interfaceName) => reader(
  ({ deviceStore, DB }) => getInterfaceList
    .loadData(deviceId)
    .run({ deviceStore, DB })
    .mergeEither(findInterface(interfaceName))
    .mergeEither(cmInterfaceConfig =>
      merge(mergeInterfaceOspfConfig, Either.of({ ospfCapable: true, ospfConfig: null }), cmInterfaceConfig)
        .chain(diffRight(updateDiffStrategy, Either.Right(cmInterfaceConfig)))
    )
    .mergeMap(updateInstructions => Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.updateInterface(interfaceName, updateInstructions))
    )
    .mapTo({ result: true, message: 'OSPF removed' })
    .toPromise()
);

module.exports = {
  getInterfaceList,
  getInterfaceConfig,
  createVlan,
  createPPPoE,
  updateInterfaceConfig,
  removeInterface,
  blockInterface,
  unblockInterface,
  setOspfConfig,
  unsetOspfConfig,
};
