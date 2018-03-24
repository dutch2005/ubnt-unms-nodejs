'use strict';

const {
  flatten, values, get, curry, flow, __, has, negate, map, memoize, assign, sortBy, reduce,
  first,
} = require('lodash/fp');
const { pathEq, both } = require('ramda');
const ip = require('ip');
const dns = require('dns');
const os = require('os');

const { parseInterfaceListAddresses } = require('../transformers/interfaces/parsers');

const DEFAULT_MASK = '255.255.255.0';

const createSubnetInfo = curry((address, mask) => ip.subnet(address, mask));

const isNotLoopback = negate(ip.isLoopback);

const ipToLong = memoize(ip.toLong);

/**
 * @param {Set} accumulator
 * @param {CorrespondenceDevice} cmDevice
 * @return {Set}
 */
const extractAddressesFromDevice = (accumulator, cmDevice) => {
  if (has('gateway', cmDevice) && ip.isV4Format(cmDevice.gateway)) {
    accumulator.add(`${cmDevice.gateway}/24`); // fake cidr
  }

  if (Array.isArray(cmDevice.interfaces)) {
    parseInterfaceListAddresses({}, cmDevice.interfaces)
      .forEach(address => accumulator.add(address));
  }

  return accumulator;
};

const fromHostname = hostname => new Promise((resolve, reject) => {
  dns.lookup(hostname, { family: 4, all: true }, (err, addresses) => {
    if (err) {
      reject(err);
    } else {
      const subnets = addresses
        .map(get('address'))
        .filter(isNotLoopback)
        .map(createSubnetInfo(__, DEFAULT_MASK));

      resolve(subnets);
    }
  });
});

const isValidInterfaceAddress = both(pathEq(['family'], 'IPv4'), pathEq(['internal'], false));

const fromPhysicalInterfaces = () => flatten(values(os.networkInterfaces()))
  .filter(isValidInterfaceAddress)
  .map(interfaceInfo => ip.subnet(interfaceInfo.address, interfaceInfo.netmask));

const fromDevices = (cmDevicesList) => {
  const addressSet = cmDevicesList.reduce(extractAddressesFromDevice, new Set());

  return Array.from(addressSet).map(ip.cidrSubnet);
};

/**
 * @function collapseSubnets
 * @param {Subnet[]}
 * @return {Subnet[]}
 */
const collapseSubnets = flow(
  map(subnet => assign(subnet, { from: ipToLong(subnet.firstAddress), to: ipToLong(subnet.lastAddress) })),
  sortBy('from'),
  reduce((collapsed, subnet) => {
    if (collapsed === null) { return [subnet] }

    const top = first(collapsed);
    // only collapse if it's exact subnet, don't collapse overlapping subnets
    if (subnet.from <= top.to && subnet.to <= top.to) {
      return collapsed;
    }

    // one subnet is just an extension of another
    if (subnet.from === top.from && subnet.to > top.to) {
      collapsed[0] = subnet; // eslint-disable-line no-param-reassign
      return collapsed;
    }

    collapsed.unshift(subnet);

    return collapsed;
  }, null)
);

module.exports = {
  fromHostname,
  fromPhysicalInterfaces,
  fromDevices,
  collapseSubnets,
};
