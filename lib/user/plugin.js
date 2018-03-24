'use strict';

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../util/hapi');

const service = require('./service');

function register(server) {
  const { dal, DB, mail, messageHub } = server.plugins;
  const config = server.settings.app;

  const pluginApi = {
    getUser: weave(service.getUser, { dal }),
    getUsers: weave(service.getUsers, { dal }),
    updateUser: weave(service.updateUser, { dal }),
    updateUserWithAuth: weave(service.updateUserWithAuth, { dal, messageHub }),
    createUser: weave(service.createUser, { dal, messageHub }),
    getUserProfile: weave(service.getUserProfile, { dal }),
    updateUserProfile: weave(service.updateUserProfile, { dal }),
    countUsers: weave(service.countUsers, { dal }),
    reinviteUser: weave(service.reinviteUser, { DB, mail, dal }),
    deleteUser: weave(service.deleteUser, { DB, dal, messageHub }),

    login: weave(service.login, { dal, DB }),
    loginTotp: weave(service.loginTotp, { dal, DB }),
    logout: weave(service.logout, { DB }),
    generateTwoFactorAuthSecret: weave(service.generateTwoFactorAuthSecret, { dal, DB }),
    setTotpAuth: weave(service.setTotpAuth, { dal }),
    requestPasswordReset: weave(service.requestPasswordReset, { dal, DB, messageHub }),
    createMobileDevice: weave(service.createMobileDevice, { dal, config, DB }),
    resetPasswordUsingToken: weave(service.resetPasswordUsingToken, { dal, DB }),
    checkPasswordStrength: service.checkPasswordStrength,
  };

  server.expose(pluginApi);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'user',
  version: '1.0.0',
  dependencies: ['dal', 'DB', 'mail', 'messageHub'],
};
