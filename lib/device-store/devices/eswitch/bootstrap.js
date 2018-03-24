'use strict';

const { Reader: reader } = require('monet');

const { parseSysInfoMessage } = require('./transformers/socket/parsers');
const { eswitchDeviceStub } = require('./transformers/device/parsers');

const createPingMiddleware = require('../../backends/ubridge/middlewares/ping');
const createEventsMiddleware = require('./middlewares/events');
const parseMessagesMiddleware = require('./middlewares/parse-messages');

const createCommDevice = require('./factory');

/**
 * @param {WebSocketConnection} connection
 * @param {CorrespondenceIncomingMessage} sysInfoMessage
 * @return {Reader.<Observable.<CommDevice>>}
 */
const bootstrapConnection = (connection, sysInfoMessage) => reader(
  ({ messageHub, periodicActions }) => {
    const sysInfo = parseSysInfoMessage(sysInfoMessage);
    const cmEswitchStub = eswitchDeviceStub(sysInfo);

    connection.use(parseMessagesMiddleware); // handle incoming olt messages

    const commDevice = createCommDevice(connection, sysInfo);

    return commDevice.buildDevice(cmEswitchStub)
      .map((cmEswitch) => {
        connection.use(createEventsMiddleware({ messageHub, cmEswitch, commDevice }));
        connection.use(createPingMiddleware({ periodicActions, commDevice }));

        return commDevice;
      });
  }
);

module.exports = bootstrapConnection;
