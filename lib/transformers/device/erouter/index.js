'use strict';

const { toCorrespondence, fromCorrespondence } = require('../../index');
const {
  safeParseHwOspfAreas, safeParseHwOspfConfig, safeParseApiOspfConfig, safeParseApiRoute,
  safeParseApiOspfArea, safeParseConfigHwRoutes, safeParseAllHwRoutes, safeParseApiDhcpServer,
  safeParseHwDhcpServers, safeParseRuntimeHwDhcpServerList, safeParseHwDynamicDHCPLeasesList,
  safeParseApiDHCPLease, parseAllHwRoutes, safeParseApiSystem, safeParseApiServices,
} = require('./parsers');
const {
  safeToApiOspfAreasList, safeToApiOspfConfig, safeToApiRouteList, safeToApiRoute, safeToApiDhcpServerList,
  safeToApiDhcpServer, safeToApiDHCPLeasesList, safeToApiSystem, safeToApiServices,
} = require('./mappers');
const { mergeConfigAndAllHwRoutes, mergeDhcpServers } = require('./mergers');

// ospfAreasFromHw :: HwOspfAreas -> Either.<Object>
//    HwOspfAreas = Array.<Object>
const fromHwOspfAreas = toCorrespondence(safeParseHwOspfAreas, {});

// ospfConfigFromHw ::HwOspfConfig -> Either.<Object>
//    HwOspfConfig = Object
const fromHwOspfConfig = toCorrespondence(safeParseHwOspfConfig, {});

// ospfAreasListToApi :: CorrespondenceOspfAreas -> Either.<Array.<Object>>
//    CorrespondenceOspfAreas = Array.<Object>
const toApiOspfAreasList = fromCorrespondence(safeToApiOspfAreasList);

// ospfConfigToApi :: CorrespondenceOspfConfig -> Either.<Object>
//    CorrespondenceOspfConfig = Object
const toApiOspfConfig = fromCorrespondence(safeToApiOspfConfig);

// fromApiOspfConfig :: apiOspfConfig -> Either.<Object>
//    apiOspfConfig = Object
const fromApiOspfConfig = toCorrespondence(safeParseApiOspfConfig, {});

// fromApiOspfArea :: apiOspfArea -> Either.<Object>
//    apiOspfArea = Object
const fromApiOspfArea = toCorrespondence(safeParseApiOspfArea, {});

// fromConfigHwRoutes :: HwConfigRoutes -> Either.<Object>
//    HwConfigRoutes  = Object
const fromConfigHwRoutes = toCorrespondence(safeParseConfigHwRoutes, {});

// fromAllHwRoutes :: HwRoutes -> Either.<Object>
//    HwRoutes =  Object
const fromAllHwRoutes = toCorrespondence(safeParseAllHwRoutes, {});

// fromAllHwRoutesUnsafe :: HwRoutes -> Object
//    HwRoutes =  Object
const fromAllHwRoutesUnsafe = toCorrespondence(parseAllHwRoutes, {});

// fromApiRoute :: ApiRoute -> Either.<Object>
const fromApiRoute = toCorrespondence(safeParseApiRoute, {});

// toApiRoute :: Array.<CorrespondenceRoute> -> Either<Array.<Object>>
const toApiRouteList = fromCorrespondence(safeToApiRouteList);

// toApiRoute :: CorrespondenceRoute -> Either<Object>
const toApiRoute = fromCorrespondence(safeToApiRoute);

// fromHwDhcpServers :: Object -> Either.<CorrespondenceDhcpServer[]>
const fromHwDhcpServers = toCorrespondence(safeParseHwDhcpServers, {});

// fromApiDhcpServer :: Object -> Either.<CorrespondenceDhcpServer>
const fromApiDhcpServer = toCorrespondence(safeParseApiDhcpServer, {});

// fromHwRuntimeDhcpServers :: Object -> Array.<Object>
const fromHwRuntimeDhcpServers = toCorrespondence(safeParseRuntimeHwDhcpServerList, {});

// toApiDhcpServersList :: CorrespondenceDhcpServer[] -> Either.<Obejct[]>
const toApiDhcpServersList = fromCorrespondence(safeToApiDhcpServerList);

// toApiDhcpServer :: CorrespondenceDhcpServer -> Either.<Object>
const toApiDhcpServer = fromCorrespondence(safeToApiDhcpServer);

// fromHwDHCPLeasesList :: Object -> Either.<CorrespondenceDhcpLeases[]>
const fromHwDHCPLeasesList = toCorrespondence(safeParseHwDynamicDHCPLeasesList, {});

// toApiDHCPLeasesList :: CorrespondenceDhcpLeases[] -> Either.<Object[]>
const toApiDHCPLeasesList = fromCorrespondence(safeToApiDHCPLeasesList);

// fromApiSystem :: Object -> Either.<CorrespondenceVyattaSystem>
const fromApiSystem = toCorrespondence(safeParseApiSystem, {});

// toApiSystem :: CorrespondenceVyattaSystem -> Either.<Object>
const toApiSystem = fromCorrespondence(safeToApiSystem);

// fromApiServices :: Object -> Either.<CorrespondenceServices>
const fromApiServices = toCorrespondence(safeParseApiServices, {});

// toApiServices :: CorrespondenceServices -> Either.<Object>
const toApiServices = fromCorrespondence(safeToApiServices);

// fromApiDHCPLease :: Object -> Either.<Object>
const fromApiDHCPLease = toCorrespondence(safeParseApiDHCPLease, {});

module.exports = {
  fromHwOspfAreas,
  toApiOspfAreasList,

  fromHwOspfConfig,
  toApiOspfConfig,

  fromApiOspfConfig,
  fromApiOspfArea,

  fromConfigHwRoutes,
  fromAllHwRoutes,
  fromAllHwRoutesUnsafe,

  fromApiRoute,
  toApiRoute,
  toApiRouteList,

  mergeConfigAndAllHwRoutes,
  mergeDhcpServers,

  fromHwDhcpServers,
  fromApiDhcpServer,
  fromHwRuntimeDhcpServers,
  toApiDhcpServersList,
  toApiDhcpServer,

  fromHwDHCPLeasesList,
  toApiDHCPLeasesList,

  fromApiDHCPLease,

  fromApiSystem,
  toApiSystem,

  fromApiServices,
  toApiServices,
};
