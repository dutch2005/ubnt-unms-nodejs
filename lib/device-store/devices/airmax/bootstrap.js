'use strict';

const { Reader: reader } = require('monet');

const { parseSysInfoMessage } = require('../../backends/airos/transformers/socket/parsers');
const { airMaxDeviceStub } = require('./transformers/device/parsers');
const { AirMaxSeriesEnum } = require('../../../enums');

const createPingMiddleware = require('../../backends/ubridge/middlewares/ping');
const parseMessagesMiddleware = require('../../backends/airos/middlewares/parse-messages');
const createInterfaceThroughputMiddleware = require('./middlewares/interface-throughput');
const createConfigCheckMiddleware = require('./middlewares/config-check');
const createAcEventsMiddleware = require('./middlewares/AC/events');
const createMEventsMiddleware = require('./middlewares/M/events');
const createMInterfaceStatsMiddleware = require('./middlewares/M/interface-stats');

const createCommDevice = require('./factory');

/**
 * @param {WebSocketConnection} connection
 * @param {CorrespondenceIncomingMessage} sysInfoMessage
 * @return {Reader.<Observable.<CommDevice>>}
 */
const bootstrapConnection = (connection, sysInfoMessage) => reader(
  ({ messageHub, periodicActions }) => {
    const sysInfo = parseSysInfoMessage(sysInfoMessage);
    const cmAirMaxStub = airMaxDeviceStub(sysInfo);

    connection.use(parseMessagesMiddleware); // handle incoming olt messages

    const commDevice = createCommDevice(connection, sysInfo);

    return commDevice.buildDevice(cmAirMaxStub)
      .map((cmAirMax) => {
        const series = cmAirMax.airmax.series;
        if (series === AirMaxSeriesEnum.M) {
          connection.use(createMInterfaceStatsMiddleware({ periodicActions, commDevice }));
        }
        connection.use(createInterfaceThroughputMiddleware());
        switch (series) {
          case AirMaxSeriesEnum.AC:
            connection.use(createAcEventsMiddleware({ messageHub, periodicActions, cmAirMax, commDevice }));
            break;
          case AirMaxSeriesEnum.M:
            connection.use(createMEventsMiddleware({ messageHub, periodicActions, cmAirMax, commDevice }));
            break;
          default:
            // nothing
        }
        connection.use(createConfigCheckMiddleware({ messageHub, periodicActions, commDevice }));
        connection.use(createPingMiddleware({ periodicActions, commDevice }));

        return commDevice;
      });
  }
);

module.exports = bootstrapConnection;
