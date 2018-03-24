'use strict';

const { map, getOr, flow, values, reduce, flatten, isPlainObject, keys, toPairs, assoc, pipe } = require('lodash/fp');
const { evolve, when, isNil } = require('ramda');
const { renameKeys, stubObj } = require('ramda-adjunct');

const { MessageNameEnum } = require('../enums');

const parseMapping = flow(
  values,
  map(pipe(
    toPairs,
    map(([name, intfc]) => assoc('name', name, intfc))
  )),
  flatten,
  reduce((accumulator, hwInterface) => {
    const mapping = accumulator === null ? {} : accumulator;

    if (isPlainObject(hwInterface.pppoe)) {
      for (const pppoeId of keys(hwInterface.pppoe)) {
        mapping[`pppoe${pppoeId}`] = `${hwInterface.name}.pppoe${pppoeId}`;
      }
    }

    if (isPlainObject(hwInterface.vif)) {
      for (const [vlanId, vlan] of toPairs(hwInterface.vif)) {
        if (isPlainObject(vlan.pppoe)) {
          for (const pppoeId of keys(vlan.pppoe)) {
            mapping[`pppoe${pppoeId}`] = `${hwInterface.name}.${vlanId}.pppoe${pppoeId}`;
          }
        }
      }
    }

    return mapping;
  }, null),
  when(isNil, stubObj)
);

class NormalizeInterfacesMiddleware {
  constructor() {
    this.pppoeMap = {};
  }

  normalizeInterfaces(message) {
    return evolve({
      data: renameKeys(this.pppoeMap),
    }, message);
  }

  updateNameMapping(message) {
    const hwInterfaceConfig = getOr({}, ['data', 'interfaces'], message);

    this.pppoeMap = parseMapping(hwInterfaceConfig);
  }

  handleIncoming(message) {
    switch (message.name) {
      case MessageNameEnum.Interfaces:
        return this.normalizeInterfaces(message);
      case MessageNameEnum.GetConfig:
      case MessageNameEnum.GetInterfaces:
        this.updateNameMapping(message);
        break;
      default:
      // do nothing
    }

    return message;
  }
}

const createMiddleware = () => new NormalizeInterfacesMiddleware();

module.exports = createMiddleware;
