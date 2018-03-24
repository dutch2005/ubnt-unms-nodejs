'use strict';

const { Reader: reader } = require('monet');

const configChangeHandler = ({ deviceId }) => reader(
  ({ backups, settings }) => {
    const { autoBackups } = settings.getSettings();

    if (autoBackups) {
      backups.deviceBackup.scheduleBackup(deviceId);
    }
  }
);

module.exports = configChangeHandler;
