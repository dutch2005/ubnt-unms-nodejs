'use strict';

const { weave } = require('ramda-adjunct');

const viewModule = require('./view');
const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');

function register(server, options) {
  const { user: service, eventLog } = server.plugins;
  const config = server.settings.app;

  const view = {
    getUser: weave(viewModule.getUser, { service }),
    putUser: weave(viewModule.putUser, { service }),
    getUserProfile: weave(viewModule.getUserProfile, { service }),
    updateUserProfile: weave(viewModule.updateUserProfile, { service }),
    login: weave(viewModule.login, { service, eventLog, config }),
    loginTotpAuth: weave(viewModule.loginTotpAuth, { service, eventLog, config }),
    logout: weave(viewModule.logout, { service }),
    getTotpAuth: weave(viewModule.getTotpAuth, { service }),
    setTotpAuth: weave(viewModule.setTotpAuth, { service }),
    requestPasswordReset: weave(viewModule.requestPasswordReset, { service }),
    resetPasswordUsingToken: weave(viewModule.resetPasswordUsingToken, { service }),
    checkPasswordStrength: weave(viewModule.checkPasswordStrength, { service }),
    createMobileDevice: weave(viewModule.createMobileDevice, { service }),
  };

  registerRoutes(server, options, view);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiUserV2.1',
  version: '1.0.0',
  dependencies: ['user', 'eventLog'],
};
