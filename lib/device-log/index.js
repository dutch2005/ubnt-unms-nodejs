'use strict';

const { union, isEmpty, curry } = require('lodash');
const { pathSatisfies, isNil } = require('ramda');
const { isNotNil } = require('ramda-adjunct');

const { getDeviceLogSettings } = require('../settings');
const { logDeviceEvent } = require('../event-log');
const { LogTypeEnum, LogLevelEnum } = require('../enums');
const { allP } = require('../util');

const getOutageLog = store => store.get('outageLog', []);
const cleanOutageLog = store => store.unset('outageLog');

const isDeviceConnected = curry((store, deviceId) => !store.get(['outages', deviceId]));

const getDeviceIds = store => union(Object.keys(store.get('deviceLog', {})), Object.keys(store.get('outages', {})));
const getDeviceProperties = (store, deviceId) => store.get(['deviceLog', deviceId], {});
const getDevicePropertyNames = (store, deviceId) => Object.keys(store.get(['deviceLog', deviceId], {}));
const getDeviceProperty = (store, deviceId, propertyName) => store.get(['deviceLog', deviceId, propertyName]);
const setDeviceProperty = (store, deviceId, propertyName, value) =>
  store.set(['deviceLog', deviceId, propertyName], value);

const markDevicePropertyLogged = (store, deviceId, propertyName) =>
  store.set(['deviceLog', deviceId, propertyName, 'isLogged'], true);


const shouldLogProperty = (property, { limit, interval }, time) =>
  property
  && !property.isLogged
  && property.value > limit
  && (time - property.startTimestamp > interval);

const createDeviceLogMessage = (deviceName, propertyConfig) =>
  `${propertyConfig.name} on device '${deviceName}' has been over ${propertyConfig.limit}%`
  + ` for over ${propertyConfig.interval / 1000} seconds.`;

const createStateString = (state, propertyConfigs) => Object.keys(state).map(propertyName =>
  `${propertyConfigs[propertyName].name}: ${state[propertyName].value}${propertyConfigs[propertyName].unit}`
).join(', ');

const createOutageLogMessage = (deviceName, deviceType, lastState, gracePeriod, propertyConfigs) =>
  `${deviceType.toUpperCase()}: ${deviceName} has been disconnected for over ${gracePeriod / 1000} seconds.`
  + `${isEmpty(lastState)
       ? ' Last state is unknown.'
       : ` Last known state: [${createStateString(lastState, propertyConfigs)}].`
    }`;

function logPropertyIfEligible(store, deviceId, propertyName, propertyConfig, time) {
  const property = getDeviceProperty(store, deviceId, propertyName);
  if (!shouldLogProperty(property, propertyConfig, time)) {
    return Promise.resolve(property); // don't log
  }
  const message = createDeviceLogMessage(property.device.name, propertyConfig);
  markDevicePropertyLogged(store, deviceId, propertyName);
  return logDeviceEvent(message, propertyConfig.level, propertyConfig.logType, time, property.device);
}

function markDeviceStateLogged(store, deviceId) {
  const propertyNames = getDevicePropertyNames(store, deviceId);
  propertyNames.forEach(propertyName => markDevicePropertyLogged(store, deviceId, propertyName));
}

const logOutage = curry((store, outageLogEntry) => {
  const {
    time, gracePeriod, deviceIdentification, deviceIdentification: { id, name, type }, deviceMetadata,
  } = outageLogEntry;

  const settings = getDeviceLogSettings();
  const properties = getDeviceProperties(store, id);
  const message = createOutageLogMessage(
    isNil(deviceMetadata.alias) ? name : deviceMetadata.alias,
    type,
    properties,
    gracePeriod,
    settings
  );

  markDeviceStateLogged(store, id);
  return logDeviceEvent(message, LogLevelEnum.Error, LogTypeEnum.DeviceOutage, time, deviceIdentification);
});

function updateDeviceState(store, device, time, properties) {
  const settings = getDeviceLogSettings();

  Object.keys(properties).forEach((propertyName) => {
    const currentState = getDeviceProperty(store, device.id, propertyName);
    if (currentState && currentState.lastTime > time) return;
    const { limit } = settings[propertyName];
    setDeviceProperty(store, device.id, propertyName, {
      value: properties[propertyName],
      startTimestamp: currentState && currentState.value > limit ? currentState.startTimestamp : time,
      lastTime: time,
      isLogged: currentState && currentState.value > limit ? currentState.isLogged : false,
      device: device.identification,
    });
  });
}

function logDeviceState(store, settings, deviceId, time) {
  const propertyNames = getDevicePropertyNames(store, deviceId);
  return Promise.all(propertyNames.map(propertyName =>
    logPropertyIfEligible(store, deviceId, propertyName, settings[propertyName], time)
  ));
}

function logDeviceProperties(store, device, time, properties) {
  const settings = getDeviceLogSettings();
  return logDeviceState(store, settings, device.id, time)
    .then(() => updateDeviceState(store, device, time, properties));
}

function saveDeviceLog(store, time = Date.now()) {
  const deviceLogSettings = getDeviceLogSettings();

  const outageLog = getOutageLog(store);
  cleanOutageLog(store);
  const saveOutageLogs = outageLog
    // fixes issue with unknown devices crashing the server.
    .filter(pathSatisfies(isNotNil, ['deviceIdentification', 'type']))
    .map(logOutage(store));

  const logDeviceStates = getDeviceIds(store)
    .filter(isDeviceConnected(store))
    .map(deviceId => logDeviceState(store, deviceLogSettings, deviceId, time)
  );

  return allP([...saveOutageLogs, logDeviceStates]);
}

module.exports = {
  logDeviceProperties,
  saveDeviceLog,
};
