'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader } = require('monet');

const bootstrapDevice = require('./devices/bootstrap');

const bootstrap = connection => reader(
  ({ store, deviceSettings, messageHub, periodicActions }) => bootstrapDevice(connection)
    .run({ messageHub, periodicActions })
    .mergeMap((commDevice) => {
      const otherCommDevice = store.get(commDevice.deviceId);

      if (otherCommDevice !== null) {
        // terminate other connection
        commDevice.connection.log(
          `Replacing existing connection ${otherCommDevice.connection.connectionId} for device ${commDevice.deviceId}`
        );
        return otherCommDevice.connection.close()
          .mapTo(commDevice);
      }

      return Observable.of(commDevice);
    })
    .mergeMap((commDevice) => {
      store.add(commDevice.deviceId, commDevice);

      // ad-hoc middleware to remove commDevice from store
      connection.use({
        handleClose() { store.remove(commDevice.deviceId) },
      });

      return deviceSettings.loadSettings(commDevice.deviceId)
        .mergeMap(unmsSettings => commDevice.setSetup(unmsSettings));
    })
);

module.exports = bootstrap;
