'use strict';

const { Observable } = require('rxjs/Rx');
const { test, anyPass } = require('ramda');
const { isNotNil } = require('ramda-adjunct');
const { isNil, flow } = require('lodash/fp');
const { Reader: reader } = require('monet');

const { UnknownDeviceError, DeviceInvalidError, NotImplementedError } = require('../errors');
const { sysInfoRequest } = require('../backends/ubridge/messages');
const { parseDeviceDescription } = require('../../transformers/device/model/parsers');
const {
  isOltDeviceType, isErouterDeviceType, isEswitchDeviceType, isAirMaxDeviceType, isAirCubeDeviceType,
} = require('../../feature-detection/common');

// device specific bootstrap code
const bootstrapErouter = require('./erouter/bootstrap');
const bootstrapEswitch = require('./eswitch/bootstrap');
const bootstrapOlt = require('./olt/bootstrap');
const bootstrapAirMax = require('./airmax/bootstrap');
const bootstrapAirCube = require('./aircube/bootstrap');

// device type detection
const isErouter = anyPass([isErouterDeviceType, test(/^ER/)]);
const isEswitch = anyPass([isEswitchDeviceType]);
const isOlt = anyPass([isOltDeviceType, test(/^UF/)]);
const isAirCube = anyPass([isAirCubeDeviceType]);
const isAirMax = anyPass([isAirMaxDeviceType, flow(parseDeviceDescription, isAirMaxDeviceType)]);

const proxyHandler = {
  get: (commDevice, prop) => {
    const value = commDevice[prop];
    if (isNil(value) && commDevice.KNOWN_METHODS.has(prop)) {
      return () => Observable.throw(new NotImplementedError(`${prop} is not implemented`));
    }

    return commDevice[prop];
  },
  has: (commDevice, prop) => isNotNil(commDevice[prop]),
};

const createDeviceProxy = commDevice => new Proxy(commDevice, proxyHandler);

const ensureValidCommDevice = (commDevice) => {
  if (commDevice.deviceId === null) {
    throw new DeviceInvalidError('Device is missing deviceId');
  }
};

const bootstrap = connection => reader(
  ({ messageHub, periodicActions }) => connection.rpc(sysInfoRequest())
    .mergeMap((sysInfo) => {
      const model = sysInfo.model;

      connection.log(`model: ${sysInfo.model} mac: ${sysInfo.data.mac} version: ${sysInfo.data.version}`);

      if (isErouter(model)) {
        return bootstrapErouter(connection, sysInfo).run({ messageHub, periodicActions });
      } else if (isEswitch(model)) {
        return bootstrapEswitch(connection, sysInfo).run({ messageHub, periodicActions });
      } else if (isOlt(model)) {
        return bootstrapOlt(connection, sysInfo).run({ messageHub, periodicActions });
      } else if (isAirMax(model)) {
        return bootstrapAirMax(connection, sysInfo).run({ messageHub, periodicActions });
      } else if (isAirCube(model)) {
        return bootstrapAirCube(connection, sysInfo).run({ messageHub, periodicActions });
      }

      return Observable.throw(new UnknownDeviceError(model));
    })
    .do(ensureValidCommDevice)
    .map(createDeviceProxy)
    .do((commDevice) => {
      const messages = messageHub.messages;
      return messageHub.publish(messages.deviceConnectionSuccess(commDevice.deviceId));
    })
);

module.exports = bootstrap;
