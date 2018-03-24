'use strict';

const { weave } = require('ramda-adjunct');

const createDeviceMetadata = require('./createDeviceMetadata');
const removeDeviceMetadata = require('./removeDeviceMetadata');
const setDecryptionFlag = require('./setDecryptionFlag');
const unsetDecryptionFlag = require('./unsetDecryptionFlag');
const setRestartTimestamp = require('./setRestartTimestamp');
const unsetRestartTimestamp = require('./unsetRestartTimestamp');

exports.register = (server, messageHub, messages) => {
  const { dal } = server.plugins;

  const createDeviceMetadataBound = weave(createDeviceMetadata, { dal, messageHub });
  const removeDeviceMetadataBound = weave(removeDeviceMetadata, { dal, messageHub });
  const setDecryptionFlagBound = weave(setDecryptionFlag, { dal, messageHub });
  const unsetDecryptionFlagBound = weave(unsetDecryptionFlag, { dal, messageHub });
  const setRestartTimestampBound = weave(setRestartTimestamp, { dal, messageHub });
  const unsetRestartTimestampBound = weave(unsetRestartTimestamp, { dal, messageHub });

  const {
    deviceSaved, deviceRemoved, deviceRefreshed, deviceConnectionSuccess, deviceConnectionFailure, deviceOutageStopped,
    deviceRestarted,
  } = messages;
  messageHub.subscribe(deviceSaved, createDeviceMetadataBound);
  messageHub.subscribe(deviceRemoved, removeDeviceMetadataBound);
  messageHub.subscribe(deviceRefreshed, unsetDecryptionFlagBound);
  messageHub.subscribe(deviceConnectionSuccess, unsetDecryptionFlagBound);
  messageHub.subscribe(deviceConnectionFailure, setDecryptionFlagBound);
  messageHub.subscribe(deviceRestarted, setRestartTimestampBound);
  messageHub.subscribe(deviceOutageStopped, unsetRestartTimestampBound);
};
