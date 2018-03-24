'use strict';

const {
  configureAndSendTest, configureAndSendAdminInvite, configureAndSendAdminRevoke, configureAndSendEventNotification,
  configureAndSendForgottenPasswordResetLink, configureAndSendNewEmailNotification,
  configureAndSendOldEmailNotification,
} = require('./index');
const { registerPlugin } = require('../util/hapi');
const handlers = require('./handlers');

/*
 * Hapijs Plugin definition
 */
function register(server) {
  const { messageHub } = server.plugins;

  const pluginApi = {
    configureAndSendTest,
    configureAndSendAdminInvite,
    configureAndSendForgottenPasswordResetLink,
    configureAndSendEventNotification,
    configureAndSendAdminRevoke,
    configureAndSendNewEmailNotification,
    configureAndSendOldEmailNotification,
  };

  server.expose(pluginApi);

  messageHub.registerHandlers(handlers);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'mail',
  version: '1.0.0',
  dependencies: ['messageHub'],
};
