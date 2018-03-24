'use strict';

const { flow, flatten, partition, curry, find, merge, map, isEqual } = require('lodash/fp');

const { path, pathEq, lensIndex, over, allPass, anyPass, pick, concat, filter, pathSatisfies } = require('ramda');

const { mergeDeviceUpdate } = require('../mergers');
const { isNotUndefined } = require('../../../util');
const { RouteTypeEnum, StatusEnum } = require('../../../enums');

/**
 * Merge erouter from DB with erouter just received from configuration
 *
 * @param {CorrespondenceDevice} dbDeviceCorrespondenceData
 * @param {CorrespondenceDevice} hwDeviceCorrespondenceData
 * @return {!CorrespondenceDevice}
 */
const mergeDbWithHw = (dbDeviceCorrespondenceData, hwDeviceCorrespondenceData) => {
  const newStatus = dbDeviceCorrespondenceData.identification.authorized ? StatusEnum.Active : StatusEnum.Unauthorized;

  return mergeDeviceUpdate(dbDeviceCorrespondenceData, {
    identification: {
      mac: hwDeviceCorrespondenceData.identification.mac,
      name: hwDeviceCorrespondenceData.identification.name,
      model: hwDeviceCorrespondenceData.identification.model,
      type: hwDeviceCorrespondenceData.identification.type,
      category: hwDeviceCorrespondenceData.identification.category,
      firmwareVersion: hwDeviceCorrespondenceData.identification.firmwareVersion,
      platformId: hwDeviceCorrespondenceData.identification.platformId,
      updated: Date.now(),
      ipAddress: hwDeviceCorrespondenceData.identification.ipAddress,
    },
    overview: {
      lastSeen: hwDeviceCorrespondenceData.overview.lastSeen,
      status: newStatus,
      gateway: hwDeviceCorrespondenceData.overview.gateway,
    },
    interfaces: hwDeviceCorrespondenceData.interfaces,
  });
};

/**
 * Merge Single Route.
 *
 * @sig mergeWithConfigRoutes :: CorrespondenceRoute[] -> CorrespondenceRoute -> CorrespondenceRoute
 * @function mergeWithConfigRoutes
 * @param {CorrespondenceRoute[]} configRoutes
 * @param {CorrespondenceRoute} allRoutesRoute
 * @returns {!CorrespondenceRoute}
 */
const mergeWithConfigRoutes = curry((configRoutes, allRoutesRoute) => {
  const relevant = find(allPass([
    pathEq(['destination'], path(['destination'], allRoutesRoute)),
    anyPass([
      pathEq(['gateway'], path(['gateway'], allRoutesRoute)),
      pathEq(['interface'], path(['interface'], allRoutesRoute)),
    ]),
  ]))(configRoutes);

  if (isNotUndefined(relevant)) {
    const relevantSubset = pick(['description', 'staticType', 'enabled'], relevant);
    return merge(allRoutesRoute, relevantSubset);
  }

  return allRoutesRoute;
});

/**
 * Merge Static & Dynamic route information.
 *
 * @sig mergeConfigAndAllHwRoutes :: CorrespondenceRoute[] -> CorrespondenceRoute[] -> CorrespondenceRoute[]
 * @function mergeConfigAndAllHwRoutes
 * @param {CorrespondenceRoute[]} allRoutes
 * @param {CorrespondenceRoute[]} configRoutes
 * @returns {CorrespondenceRoute[]}
 */
const mergeConfigAndAllHwRoutes = curry(
  (allRoutes, configRoutes) => concat(
    flow(
      partition(pathEq(['type'], RouteTypeEnum.Static)),
      over(lensIndex(0), map(mergeWithConfigRoutes(configRoutes))),
      flatten
    )(allRoutes),
    filter(allPass([
      pathSatisfies(isEqual(RouteTypeEnum.Static), ['type']),
      pathSatisfies(isEqual(false), ['enabled']),
    ]))(configRoutes)
  )
);

/**
 * Find and merge runtime configuration with static configuration
 *
 * @sig findAndMergeRuntimeServer :: Array.<Object> -> Object -> Object
 * @function findAndMergeRuntimeServer
 * @param {!Array.<Object>} runtimeServers
 * @param {!Object} configServer
 * @return {CorrespondenceDhcpServer}
 */
const findAndMergeRuntimeServer = curry((runtimeServers, configServer) => flow(
  find(pathEq(['name'], configServer.name)),
  merge(configServer)
)(runtimeServers));

/**
 * Merge runtime and static DHCP server information
 *
 * @sig mergeDhcpServers :: (Array.<Object>, Array.<Object>) -> Array.<CorrespondenceDhcpServer>
 * @param {!Array.<Object>} configServers
 * @param {!Array.<Object>} runtimeServers
 * @return {!Array.<CorrespondenceDhcpServer>}
 */
const mergeDhcpServers = (configServers, runtimeServers) => map(
  findAndMergeRuntimeServer(runtimeServers)
)(configServers);

module.exports = {
  mergeDbWithHw,
  mergeConfigAndAllHwRoutes,
  mergeDhcpServers,
};
