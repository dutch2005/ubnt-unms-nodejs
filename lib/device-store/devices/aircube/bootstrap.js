'use strict';

const { Reader: reader } = require('monet');
const { gte } = require('semver');

const { parseSysInfoMessage } = require('./transformers/socket/parsers');
const { airCubeDeviceStub } = require('./transformers/device/parsers');

const createCommDevice = require('./factory');
const parseMessagesMiddleware = require('./middlewares/parse-messages');
const createPeriodicEventsMiddleware = require('./middlewares/periodic-events');
const createEventsMiddleware = require('./middlewares/events');
const createPingMiddleware = require('../../backends/ubridge/middlewares/ping');

/**
 * @param {WebSocketConnection} connection
 * @param {CorrespondenceIncomingMessage} sysInfoMessage
 * @return {Reader.<Observable.<CommDevice>>}
 */
const bootstrapConnection = (connection, sysInfoMessage) => reader(
  ({ messageHub, periodicActions }) => {
    const sysInfo = parseSysInfoMessage(sysInfoMessage);
    const cmAirCubeStub = airCubeDeviceStub(sysInfo);

    connection.use(parseMessagesMiddleware); // handle incoming airCube messages

    const commDevice = createCommDevice(connection, sysInfo);

    return commDevice.buildDevice(cmAirCubeStub)
      .map((cmAirCube) => {
        connection.use(createPeriodicEventsMiddleware({ messageHub, periodicActions, cmAirCube, commDevice }));
        connection.use(createPingMiddleware({ periodicActions, commDevice }));

        if (gte(sysInfo.firmwareVersion, '1.1.2-dev')) {
          connection.use(createEventsMiddleware({ messageHub, commDevice }));
        }

        return commDevice;
      });
  }
);

module.exports = bootstrapConnection;
