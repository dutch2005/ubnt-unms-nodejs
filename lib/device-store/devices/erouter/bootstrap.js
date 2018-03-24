'use strict';

const { Reader: reader } = require('monet');

const { parseSysInfoMessage } = require('../../backends/vyatta/transformers/socket/parsers');
const { edgeMaxDeviceStub } = require('../../backends/vyatta/transformers/device/parsers');

const createPingMiddleware = require('../../backends/vyatta/middlewares/ping');
const parseMessagesMiddleware = require('../../backends/vyatta/middlewares/parse-messages');
const createNormalizeInterfacesMiddleware = require('../../backends/vyatta/middlewares/normalize-interfaces');
const createEventsMiddleware = require('./middlewares/events');

const createCommDevice = require('./factory');

/**
 * @param {WebSocketConnection} connection
 * @param {CorrespondenceIncomingMessage} sysInfoMessage
 * @return {Reader.<Observable.<CommDevice>>}
 */
const bootstrapConnection = (connection, sysInfoMessage) => reader(
  ({ messageHub, periodicActions }) => {
    const sysInfo = parseSysInfoMessage(sysInfoMessage);
    const cmErouterStub = edgeMaxDeviceStub(sysInfo);

    connection.use(parseMessagesMiddleware); // handle incoming erouter messages
    connection.use(createNormalizeInterfacesMiddleware()); // normalize PPPoE interface names

    const commDevice = createCommDevice(connection, sysInfo);

    return commDevice.buildDevice(cmErouterStub)
      .map((cmErouter) => {
        // PROTOCOL V1
        // older protocol versions won't send mac as part of sysInfo message and we won't have deviceId
        // can be removed when we stop supporting V1 udapi-bridge protocol
        if (commDevice.deviceId === null) {
          commDevice.deviceId = cmErouter.identification.id;
        }

        connection.use(createEventsMiddleware({ messageHub, cmErouter, commDevice }));
        connection.use(createPingMiddleware({ periodicActions, commDevice }));

        return commDevice;
      });
  }
);

module.exports = bootstrapConnection;
