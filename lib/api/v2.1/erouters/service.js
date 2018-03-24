'use strict';

const { Observable } = require('rxjs/Rx');
const Boom = require('boom');
const { Reader: reader } = require('monet');
const { isNotNull, isNotNil, isNotEmpty } = require('ramda-adjunct');
const {
  when, isNil, find, pathEq, path, assocPath, merge, pathSatisfies, filter, allPass, map, flatten, pipe,
  anyPass, over, insert, lensPath, view,
} = require('ramda');
const { tap, set, negate } = require('lodash/fp');

const { resolveP, rejectP, allP, entityExistsCheck } = require('../../../util');
const { EntityEnum } = require('../../../enums');

const { parseDbDeviceSiteId } = require('../../../transformers/device/parsers');
const { fromDb: fromDbDevice, toApiErouterStatusDetail } = require('../../../transformers/device');
const { mergeMetadata } = require('../../../transformers/device/mergers');
const {
  toApiRouteList, fromApiRoute, fromApiDhcpServer, toApiDhcpServer, toApiDhcpServersList, toApiOspfAreasList,
  toApiOspfConfig, fromApiOspfArea, toApiDHCPLeasesList, fromApiDHCPLease, fromApiOspfConfig,
} = require('../../../transformers/device/erouter');

const { merge: mergeM } = require('../../../transformers');
const { fromDb: fromDbDeviceMetadata } = require('../../../transformers/device/metadata');

const throwNotFound = () => { throw Boom.notFound() };
const throwConflict = () => { throw Boom.conflict() };
const staticLeasesLens = lensPath(['staticLeases']);

/*
 * Erouter detail.
 */

const erouterDetail = erouterId => reader(
  ({ DB, deviceStore, firmwareDal, dal }) => {
    const dbErouterPromise = DB.erouter.findById(erouterId)
      .then(tap(entityExistsCheck(EntityEnum.Erouter)));
    const dbSitePromise = dbErouterPromise
      .then(parseDbDeviceSiteId)
      .then(when(isNotNull, DB.site.findById));
    const dbDeviceMetadataPromise = dal.deviceMetadataRepository.findById(erouterId);

    return allP([dbSitePromise, dbErouterPromise, dbDeviceMetadataPromise])
      .then(([dbSite, dbErouter, dbDeviceMetadata]) =>
        fromDbDevice({ firmwareDal, deviceStore, dbSite }, dbErouter)
          .chain(mergeM(mergeMetadata, fromDbDeviceMetadata({}, dbDeviceMetadata)))
          .chain(toApiErouterStatusDetail)
          .cata(rejectP, resolveP));
  }
);

/**
 * Routes.
 */

const routeList = deviceId => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.getRoutes())
    .mergeEither(toApiRouteList)
    .toPromise()
);

const routeCreate = (deviceId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiRoute(payload))
      .mergeMap(cmRoute => commDevice.createRoute(cmRoute))
    )
    .mapTo(payload)
    .toPromise()
);

const routeUpdate = (deviceId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiRoute(payload))
      .mergeMap(cmRoute => commDevice.updateRoute(cmRoute))
    )
    .mapTo(payload)
    .toPromise()
);

const routeBlock = (deviceId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiRoute(payload))
      .mergeMap(cmRoute => commDevice.blockRoute(cmRoute))
    )
    .mapTo({ result: true, message: 'Route blocked' })
    .toPromise()
);

const routeUnblock = (deviceId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiRoute(payload))
      .mergeMap(cmRoute => commDevice.unblockRoute(cmRoute))
    )
    .mapTo({ result: true, message: 'Route unblocked' })
    .toPromise()
);

const routeDelete = (deviceId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiRoute(payload))
      .mergeMap(cmRoute => commDevice.deleteRoute(cmRoute))
    )
    .mapTo({ result: true, message: 'Route deleted' })
    .toPromise()
);

/**
 * OSPF
 */

const ospfAreasList = deviceId => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.getOspfAreas())
    .mergeEither(toApiOspfAreasList)
    .toPromise()
);

const createOspfArea = (deviceId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiOspfArea(payload))
      .mergeMap(cmOspfArea => commDevice.upsertOspfArea(cmOspfArea))
    )
    .mapTo(payload)
    .toPromise()
);

const updateOspfArea = (deviceId, areaId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiOspfArea(payload))
      .map(set(['id'], areaId))
      .mergeMap(cmOspfArea => commDevice.upsertOspfArea(cmOspfArea))
    )
    .mapTo(payload)
    .toPromise()
);

const deleteOspfArea = (deviceId, areaId) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.deleteOspfArea(areaId))
    .mapTo({ result: true, message: 'Ospf area deleted' })
    .toPromise()
);

const getOspfConfig = deviceId => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.getOspfConfig())
    .mergeEither(toApiOspfConfig)
    .toPromise()
);

const setOspfConfig = (deviceId, payload) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiOspfConfig(payload))
      .mergeMap(cmOspfConfig => commDevice.setOspfConfig(cmOspfConfig))
    )
    .mapTo(payload)
    .toPromise()
);

/*
 * DHCP
 */

const getDHCPServersList = deviceId => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.getDHCPServers())
    .mergeEither(toApiDhcpServersList)
    .toPromise()
);

const ensureServerExists = (deviceId, serverName) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.getDHCPServers())
    .map(find(pathEq(['name'], serverName)))
    .do(when(isNil, throwNotFound))
);

const getDHCPServer = (deviceId, serverName) => reader(
  ({ deviceStore }) => ensureServerExists(deviceId, serverName)
    .run({ deviceStore })
    .mergeEither(toApiDhcpServer)
    .toPromise()
);

const updateDHCPServer = (deviceId, serverName, apiDHCPServer) => reader(
  ({ deviceStore }) => ensureServerExists(deviceId, serverName)
    .run({ deviceStore })
    .map(assocPath(['name'], serverName))
    .mergeEither(mergeM(merge, fromApiDhcpServer(apiDHCPServer)))
    .mergeMap(cmDhcpServer => Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.upsertDHCPServer(cmDhcpServer))
    )
    .mapTo(apiDHCPServer)
    .toPromise()
);

const createDHCPServer = (deviceId, apiDHCPServer) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => commDevice.getDHCPServers()
      .map(find(pathEq(['name'], apiDHCPServer.name)))
      .do(when(isNotNil, throwConflict))
      .mergeEither(() => fromApiDhcpServer(apiDHCPServer))
      .mergeMap(cmDhcpServer => commDevice.upsertDHCPServer(cmDhcpServer))
    )
    .mapTo(apiDHCPServer)
    .toPromise()
);

const deleteDHCPServer = (deviceId, serverName) => reader(
  ({ deviceStore }) => ensureServerExists(deviceId, serverName)
    .run({ deviceStore })
    .mergeMap(() => Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.deleteDHCPServer(serverName))
    )
    .mapTo({ result: true, message: 'DHCP server deleted' })
    .toPromise()
);

const blockDHCPServer = (deviceId, serverName) => reader(
  ({ deviceStore }) => ensureServerExists(deviceId, serverName)
    .run({ deviceStore })
    .mergeMap(cmDhcpServer => Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.blockDHCPServer(cmDhcpServer))
    )
    .mapTo({ result: true, message: 'DHCP server blocked' })
    .toPromise()
);

const unblockDHCPServer = (deviceId, serverName) => reader(
  ({ deviceStore }) => ensureServerExists(deviceId, serverName)
    .run({ deviceStore })
    .mergeMap(cmDhcpServer => Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.unblockDHCPServer(cmDhcpServer))
    )
    .mapTo({ result: true, message: 'DHCP server blocked' })
    .toPromise()
);

const getDHCPLeases = deviceId => reader(
  ({ deviceStore }) => getDHCPLeases.loadData(deviceId)
    .run({ deviceStore })
    .mergeEither(toApiDHCPLeasesList)
    .toPromise()
);

getDHCPLeases.loadData = deviceId => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap((commDevice) => {
      const static$ = commDevice.getDHCPServers()
        .map(filter(pathSatisfies(allPass([isNotNil, isNotEmpty]), ['staticLeases'])))
        .map(map(path(['staticLeases'])))
        .map(flatten);

      const dynamic$ = commDevice.getDHCPLeases();

      return Observable.forkJoin(static$, dynamic$)
        .map(flatten);
    })
);

const DHCPLeaseExists = (deviceId, cmDhcpLease) => reader(
  ({ deviceStore }) => ensureServerExists(deviceId, cmDhcpLease.serverName)
    .run({ deviceStore })
    .do(pipe(
      path(['staticLeases']),
      find(anyPass([
        pathEq(['id'], cmDhcpLease.id),
        pathEq(['macAddress'], cmDhcpLease.macAddress),
        pathEq(['ipAddress'], cmDhcpLease.ipAddress),
      ])),
      when(isNotNil, throwConflict)
    ))
);

const createDHCPLease = (deviceId, apiDhcpLease) => reader(
  ({ deviceStore }) => Observable.of(deviceStore.get(deviceId))
    .do(entityExistsCheck(EntityEnum.Device))
    .mergeMap(commDevice => Observable.fromEither(fromApiDHCPLease(apiDhcpLease))
      .mergeMap(cmDhcpLease => DHCPLeaseExists(deviceId, cmDhcpLease)
        .run({ deviceStore })
        .map(over(staticLeasesLens, insert(-1, cmDhcpLease)))
        .mergeMap(cmDhcpServer => commDevice.upsertDHCPServer(cmDhcpServer))
      )
    )
    .mapTo(apiDhcpLease)
    .toPromise()
);

const deleteDHCPLease = (deviceId, serverName, leaseId) => reader(
  ({ deviceStore }) => ensureServerExists(deviceId, serverName)
    .run({ deviceStore })
    .do(pipe(
      view(staticLeasesLens),
      find(pathEq(['id'], leaseId)),
      when(isNil, throwNotFound)
    ))
    .map(over(staticLeasesLens, filter(negate(pathEq(['id'], leaseId)))))
    .mergeMap(cmDhcpServer => Observable.of(deviceStore.get(deviceId))
      .do(entityExistsCheck(EntityEnum.Device))
      .mergeMap(commDevice => commDevice.upsertDHCPServer(cmDhcpServer))
    )
    .mapTo({ result: true, message: 'Lease deleted.' })
    .toPromise()
);

/*
 * updateDHCPLease can be speeded up by creating custom logic
 * as opposed to reusing create and delete functions.
 *
 * Currently there are 2 commit operations on the device
 * which is impacting performance noticeably.
 * <michael.kuk@ubnt.com>
 */
const updateDHCPLease = (deviceId, serverName, leaseId, apiDhcpLease) => reader(
  ({ deviceStore }) => Observable.fromPromise(deleteDHCPLease(deviceId, serverName, leaseId).run({ deviceStore }))
    .mergeMap(() => createDHCPLease(deviceId, apiDhcpLease).run({ deviceStore }))
    .mapTo(apiDhcpLease)
    .toPromise()
);

module.exports = {
  erouterDetail,
  routeList,
  routeCreate,
  routeUpdate,
  routeBlock,
  routeUnblock,
  routeDelete,
  ospfAreasList,
  getOspfConfig,
  setOspfConfig,
  createOspfArea,
  updateOspfArea,
  deleteOspfArea,
  getDHCPServersList,
  getDHCPServer,
  createDHCPServer,
  updateDHCPServer,
  deleteDHCPServer,
  blockDHCPServer,
  unblockDHCPServer,
  getDHCPLeases,
  createDHCPLease,
  deleteDHCPLease,
  updateDHCPLease,
};
