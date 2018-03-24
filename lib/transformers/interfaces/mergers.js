'use strict';

const joi = require('joi');
const { pathEq, assocPath, over, lensPath, lensIndex, always, findIndex } = require('ramda');
const {
  flow, map, curry, spread, keyBy, has, isNull, negate, __, get, partition, some, mergeWith,
} = require('lodash/fp');

const { isPPPoEInterfaceType } = require('./utils');
const { IpAddressTypeEnum } = require('../../enums');

const mergeUtil = mergeWith((objValue, srcValue) => {
  if (Array.isArray(srcValue)) {
    return srcValue;
  }
  return undefined;
});

// isInTarget :: Array -> Object
const isInTarget = curry(
  (correspondenceMap, correspondence) => has(correspondence.identification.name, correspondenceMap)
);

// resetStatistics :: Object -> CorrespondenceData
//     CorrespondenceData = Object
const resetStatistics = correspondence => flow(
  assocPath(['statistics', 'rxrate'], 0),
  assocPath(['statistics', 'txrate'], 0),
  assocPath(['status', 'plugged'], false),
  over(lensPath(['vlans']), map(resetStatistics))
)(correspondence);

// partWith :: Array -> Object -> Array
const pairWith = curry((correspondenceMap, correspondence) => {
  const counterpart = correspondenceMap[correspondence.identification.name];
  return [correspondence, counterpart];
});

const cidrValidationRule = joi.string().ip({ version: ['ipv4'], cidr: 'required' }).required();
const isValidCidrV4 = cidr => isNull(joi.validate(cidr, cidrValidationRule).error);

// mergeIpAddresses :: Object -> Object -> Array
const mergeIpAddresses = curry((hwCorrespondence, dbCorrespondence) => {
  const { addresses: hwAddresses } = hwCorrespondence;
  const { addresses: dbAddresses } = dbCorrespondence;

  // merging ip addresses on PPPoE interface type
  if (
    isPPPoEInterfaceType(hwCorrespondence.identification.type) &&
    isPPPoEInterfaceType(dbCorrespondence.identification.type)
  ) {
    return dbCorrespondence.addresses.map(({ cidr }) => ({ type: IpAddressTypeEnum.Static, cidr }));
  }

  // merging addresses on the rest of interface types
  const [hwStaticAddresses, hwNonStaticAddresses] = partition({ type: IpAddressTypeEnum.Static }, hwAddresses);
  const hwStaticAddressMap = keyBy('cidr', hwStaticAddresses);
  const hasHwDhcpAddress = some({ type: IpAddressTypeEnum.Dhcp }, hwNonStaticAddresses);
  const hasHwDhcpV6Address = some({ type: IpAddressTypeEnum.DhcpV6 }, hwNonStaticAddresses);
  const isNotCidrInHwStaticAddresses = negate(has(__, hwStaticAddressMap));

  const dbDhcpAddresses = [];
  const dbDhcpV6Addresses = [];
  let isDbDhcpAddressFound = !hasHwDhcpAddress;
  let isDbDhcpV6AddressFound = !hasHwDhcpV6Address;

  // warning: this algorithm contains mutations.
  dbAddresses.forEach(({ cidr }) => {
    if (isNotCidrInHwStaticAddresses(cidr) && isValidCidrV4(cidr) && !isDbDhcpAddressFound) {
      dbDhcpAddresses.push({ type: IpAddressTypeEnum.Dhcp, cidr });
      isDbDhcpAddressFound = true;
    } else if (isNotCidrInHwStaticAddresses(cidr) && !isDbDhcpV6AddressFound) {
      dbDhcpV6Addresses.push({ type: IpAddressTypeEnum.DhcpV6, cidr });
      isDbDhcpV6AddressFound = true;
    }
  });

  //  dhcp/DhcpV6 addresses without data from DB, this could happen after adding Dhcp address via API.
  if (!isDbDhcpAddressFound) {
    dbDhcpAddresses.push({ type: IpAddressTypeEnum.Dhcp, cidr: null });
    isDbDhcpAddressFound = true;
  }
  if (!isDbDhcpV6AddressFound) {
    dbDhcpV6Addresses.push({ type: IpAddressTypeEnum.DhcpV6, cidr: null });
    isDbDhcpV6AddressFound = true;
  }

  return [...hwStaticAddresses, ...dbDhcpAddresses, ...dbDhcpV6Addresses];
});

// merge :: Auxiliaries -> Object -> Object -> Object
//     Auxiliaries = Object
const mergeHwWithDb = curry((hwCorrespondence, dbCorrespondence) => mergeUtil(dbCorrespondence, {
  identification: {
    description: hwCorrespondence.identification.description,
    position: hwCorrespondence.identification.position,
  },
  status: {
    autoneg: hwCorrespondence.status.autoneg,
  },
  enabled: hwCorrespondence.enabled,
  speed: hwCorrespondence.speed,
  mtu: hwCorrespondence.mtu,
  poe: hwCorrespondence.poe,
  proxyARP: hwCorrespondence.proxyARP,
  addresses: mergeIpAddresses(hwCorrespondence, dbCorrespondence),
  switch: hwCorrespondence.switch,
  pon: hwCorrespondence.pon,
  bridge: hwCorrespondence.bridge,
  bridgeGroup: hwCorrespondence.bridgeGroup,
  pppoe: hwCorrespondence.pppoe,
  vlan: hwCorrespondence.vlan,
  ospf: hwCorrespondence.ospf,
}));

// mergeHwAndDbLists :: (Array, Array) -> Array
const mergeHwAndDbLists = (hwCorrespondenceList, dbCorrespondenceList) => {
  // mapify the sets for optimized access.
  const dbCorrespondenceMap = keyBy(get(['identification', 'name']), dbCorrespondenceList);

  const [hwInDb, hwNotInDb] = partition(isInTarget(dbCorrespondenceMap), hwCorrespondenceList);

  const mergedInDb = map(flow(pairWith(dbCorrespondenceMap), spread(mergeHwWithDb)), hwInDb);

  // concat the logical sets to the whole.
  return [...mergedInDb, ...hwNotInDb];
};

// merges ospf config into interface
// mergeInterfaceOspfConfig :: (Object, Object) -> Object
const mergeInterfaceOspfConfig = (cmInterfaceData, cmInterfaceOspfConfigData) =>
  assocPath(['ospf'], cmInterfaceOspfConfigData, cmInterfaceData);

// replaces one interface in list by another (if found)
// replaceInterfaceInList :: (Array.<Correspondence>, Correspondence) -> Array.<Correspondence>
const replaceInterfaceInList = (correspondenceList, correspondence) => {
  const interfaceIndex = findIndex(
    pathEq(['identification', 'name'], correspondence.identification.name),
    correspondenceList
  );

  // not found, return original array
  if (interfaceIndex === -1) { return correspondenceList }

  return over(lensIndex(interfaceIndex), always(correspondence), correspondenceList);
};


module.exports = {
  mergeHwAndDbLists,
  mergeInterfaceOspfConfig,
  replaceInterfaceInList,
};
